# Rupadiya Bus Booking Platform

Production-grade, mobile-responsive intercity bus booking and transport platform built with **Next.js 14**, **Tailwind CSS**, **Express.js**, **MongoDB**, and **Redis/In-Memory hold store**.

---

## 🌟 Platform Highlights

- **4 Role-Specific Workspaces**:
  - **Passenger**: Search routes, interactive 40-seat coach map, 10-minute atomic temporary holds, multi-channel checkout (Dummy simulation & Razorpay test flow), digital E-Ticket with QR code, and cancellation with dynamic refund policy.
  - **Agent**: 5-tier referral hierarchy tree, level 1 to 5 commission engine with 1% TCS withholding, KYC submission, immutable double-entry wallet ledger, and payout withdrawal requests.
  - **Company Owner**: Strictly company-scoped (Company Codes 1 to 33) fleet management, vehicle RC/Fitness/Insurance compliance alerts, agent withdrawal reviews (Approve/Reject with ledger refund), annual passenger target tracking, and P&L reports.
  - **Super Admin**: Master control center for all 33 transport company codes, route & fare matrix, global bus fleet, trip scheduler, KYC verification queue, commission tier editor, 5% GST & 1% TCS tax audit exports, and security audit logs.
- **Strict 40-Seat Bus Layout (2+2 across 10 rows)**:
  - Female-only safety seats (seats 1, 2, 5, 6) with client and server gender validation.
  - Real-time seat statuses: `AVAILABLE`, `SELECTED`, `HELD` (animated pulse), `BOOKED`, `BLOCKED`.
  - Automatic companion overflow bus triggers when primary departure reaches capacity.
- **Race-Condition-Proof 10-Minute Hold Engine**:
  - Millisecond-precision atomic locks prevent double bookings during checkout.
- **Double-Entry Wallet & Ledger**:
  - Mutable balances are derived and reconciled from immutable ledger audit entries with unique idempotency keys.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js** v18+ (tested on Node v24)
- **MongoDB** v6+ (running on `mongodb://127.0.0.1:27017/rupadiya`)

### 2. Install Dependencies
```bash
# Install root, API, and Web dependencies
cd apps/api && npm install
cd ../web && npm install
```

### 3. Seed the Database
Seeds all 4 test roles, 33 company codes, intercity routes, fleet buses, scheduled trips, commission tiers, and promo offers:
```bash
cd apps/api
npm run seed
```

### 4. Start the Application
In terminal 1 (Backend API):
```bash
cd apps/api
npm start
# API starts at http://localhost:4000
```

In terminal 2 (Next.js Frontend):
```bash
cd apps/web
npm run dev
# Frontend starts at http://localhost:3000
```

---

## 🔑 Pre-Seeded Test Credentials

All test accounts share the password: **`Password123!`**
*(Use the **1-Click Test Role Switcher** on the navbar or login screen for instant inspection)*

| Role | Email | Scope / Details |
| :--- | :--- | :--- |
| **Super Admin** | `admin@rupadiya.test` | Global master control, 33 companies, routes, audit logs |
| **Company Owner** | `owner@rupadiya.test` | Company Code #01, fleet management, withdrawal approvals |
| **Booking Agent** | `agent@rupadiya.test` | Master Agent (`RUP-MASTER`), L1-L5 referral tree, wallet ledger |
| **Passenger** | `passenger@rupadiya.test` | Active bookings, PNR history, E-Ticket cancellation |

---

## 📁 Monorepo Structure

```
rupadiya-platform/
├── apps/
│   ├── web/                              # Next.js 14+ App Router, Tailwind CSS
│   │   ├── src/app/
│   │   │   ├── (public)/                 # Home search, search results, 40-seat map, offers, calendar
│   │   │   ├── (auth)/                   # Role-aware login & register
│   │   │   ├── (passenger)/              # 10-min checkout, payment simulator, E-Tickets
│   │   │   ├── (agent)/                  # Dashboard, wallet ledger, earnings, network, KYC
│   │   │   ├── (owner)/                  # Company fleet, agent approvals, company wallet
│   │   │   └── (admin)/                  # Master dashboard, 33 companies, commission config
│   │   └── src/components/
│   │       ├── seat-map/BusSeatMap.js    # 40-seat interactive bus layout
│   │       └── navigation/Navbar.js      # Responsive navbar with 1-click test role switcher
│   │
│   └── api/                              # Production Express REST API
│       ├── src/config/                   # MongoDB connection, 10-min atomic holdStore
│       ├── src/middleware/               # JWT auth, RBAC, strict company-code scoping
│       ├── src/modules/                  # Modular domain monolith
│       ├── src/providers/                # Payment & Inventory provider interfaces
│       └── src/utils/seed.js             # Master idempotent seed generator
│
└── packages/
    ├── shared-constants/                 # Roles, SeatStatus, 33 Company Codes
    └── shared-validation/                # Shared validation helpers
```

