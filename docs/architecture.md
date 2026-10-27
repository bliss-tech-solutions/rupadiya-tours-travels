# Rupadiya Platform — System Architecture & Engineering Specifications

## 1. System Topology

The Rupadiya Bus Booking Platform is built as an enterprise-grade modular monolith supporting four distinct operational roles with strict data boundaries:

```
+-------------------------------------------------------------------------+
|                  Next.js 14 Responsive Web Client                       |
|   (Mobile-First Bottom Sheets, Tablet Split-Pane, Desktop Multi-Col)   |
|   Roles: Passenger, Agent (L1-L5), Company Owner (#1-33), Super Admin   |
+------------------------------------+------------------------------------+
                                     |
                                REST API
                                     v
+-------------------------------------------------------------------------+
|                  Express.js Modular API (/api/v1)                       |
|   - JWT Authentication & Refresh Token Rotation                         |
|   - RBAC & Strict Company-Code Scoping Guard                            |
|   - 10-Minute Hold Engine & Atomic Lock Manager                         |
|   - 5-Tier Referral Tree & Commission Engine                            |
|   - Double-Entry Wallet Ledger & Idempotency Filter                     |
|   - Payment & Inventory Provider Interface Abstractions                 |
+-------------------+--------------------------------+--------------------+
                    |                                |
                    v                                v
+------------------------------------+   +--------------------------------+
|       MongoDB Database Store       |   |      Atomic 10-Min Hold Store  |
|  (Trips, 40 Seats, Bookings, PNR,  |   |   (Sub-ms TTL Lock Engine      |
|   Ledgers, 33 Companies, Audits)   |   |    for Active Seat Hold TTL)   |
+------------------------------------+   +--------------------------------+
```

---

## 2. Strict Role Isolation & Permissions Matrix

| Domain / Resource | Passenger | Agent (L1-L5) | Company Owner | Super Admin |
| :--- | :---: | :---: | :---: | :---: |
| **Search & 40-Seat Layout** | Read / Hold | Read / Hold | Read / Hold | Full Control |
| **Checkout & Booking** | Self | On Behalf / Ref | View Company Trips | Override / Cancel |
| **Wallet & Ledger** | - | Own Ledger | Company Revenue | Global Audit |
| **Commission Tree** | - | Own L1-L5 Tree | Company Margin | Configure Tier Rates |
| **Withdrawal Requests** | - | Request Payout | Approve / Reject | Policy Audit |
| **Fleet & Documents** | Public Info | Trip Status | Scoped Own Fleet | Master Registry |
| **33 Company Codes** | - | - | Scoped Own Code | Assign Owners |
| **GST / TCS Tax Reports** | Ticket Tax | TCS Summary | Company Tax Total | Master Remittance |

---

## 3. Concurrency-Safe 40-Seat Hold State Machine

Every bus trip contains exactly 40 seats indexed across 10 rows in a 2+2 layout.

$$\text{Seat Transitions: } \text{AVAILABLE} \xrightarrow{\text{holdSeats()}} \text{HELD (10m TTL)} \xrightarrow{\text{confirmBooking()}} \text{BOOKED}$$

- **Conflict Prevention**: If two concurrent requests target Seat `S12` within the same millisecond, the atomic lock allocates the seat to the first requester and immediately returns HTTP `409 Conflict` to the second requester with `conflictingSeats: ["S12"]`.
- **Automatic Expiration**: If the 10-minute hold timer expires before payment confirmation is verified, the hold lock releases automatically back to `AVAILABLE`.
- **Companion Overflow Bus**: When all 40 seats of a departure reach `HELD` or `BOOKED`, the system automatically activates companion overflow buses scheduled on that corridor.

---

## 4. Double-Entry Wallet & Ledger Accounting

Direct balance mutation without an audit trail is strictly forbidden. The wallet balance is an auditable projection:

$$\text{Balance}_{\text{Available}} = \sum \text{Credits} - \sum \text{Debits} - \text{ReservedBalance}$$

1. **Ticket Commission Credit**:
   - `DEBIT Platform Expense`
   - `CREDIT Agent Wallet (Idempotency Key: COMM_CREDIT_BK_XXXX_L1_AGENT)`
2. **Withdrawal Request Lock**:
   - `DEBIT Agent Available Balance`
   - `CREDIT Agent Reserved Balance (Locked for Maker-Checker review)`
3. **Withdrawal Rejection Refund**:
   - `DEBIT Agent Reserved Balance`
   - `CREDIT Agent Available Balance (Reason logged in audit trail)`

