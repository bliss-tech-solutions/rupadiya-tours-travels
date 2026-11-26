/**
 * Default message templates (v2 — formatted for WhatsApp). Super admins can edit them in the admin
 * portal (WhatsApp page). On start-up ensureTemplates() inserts missing ones and upgrades stored
 * templates that are still an untouched older default; templates an admin edited are never changed.
 *
 * WhatsApp formatting: *bold*  _italic_  ~strike~. A line whose placeholders are all empty is
 * dropped automatically (e.g. "👶 {{infants}}" disappears when there are no infants).
 *
 * Placeholders: {{name}} {{pnr}} {{from}} {{to}} {{date}} {{time}} {{arrival}} {{seats}}
 * {{passengerCount}} {{passengerList}} {{boarding}} {{boardingTime}} {{dropping}} {{busNumber}}
 * {{companyName}} {{amount}} {{refundAmount}} {{ticketUrl}} {{bookUrl}} {{agentName}} {{receiptNo}}
 * {{utr}} {{boarded}} {{noShow}} {{total}} {{dropped}} {{managerName}} {{infants}} {{changeText}}
 * {{reason}} {{managerPhone}}
 */
const LINE = '━━━━━━━━━━━━━━━━━━';

module.exports = [
  // ---------------------------------------------------------------- booking confirmed
  {
    event: 'BOOKING_CONFIRMED', audience: 'PASSENGER', channel: 'WHATSAPP',
    body: `🎫 *TICKET CONFIRMED*
_Rupadiya Bus Samiti_
${LINE}

Namaste *{{name}}* 🙏
Your bus ticket is booked successfully.

🔖 *PNR:* {{pnr}}
🚌 *{{from}} ➜ {{to}}*
📅 *Date:* {{date}}
🕘 *Departure:* {{time}}
🏁 *Arrival:* {{arrival}}
💺 *Seat(s):* {{seats}}
👥 *Passengers:* {{passengerList}}
👶 *Infants:* {{infants}}

📍 *Boarding:* {{boarding}} · {{boardingTime}}
🏁 *Dropping:* {{dropping}}
🚍 *Bus:* {{busNumber}} · {{companyName}}
💳 *Amount paid:* ₹{{amount}}

${LINE}
📲 *Your boarding pass (QR):*
{{ticketUrl}}

✅ Reach the boarding point *15 min early*
🪪 Carry a valid *photo ID*
📱 Show the *QR code* to the bus manager

_Happy journey!_ 🚌✨`
  },
  {
    event: 'BOOKING_CONFIRMED', audience: 'PASSENGER', channel: 'EMAIL',
    subject: '🎫 Ticket confirmed · PNR {{pnr}} · {{from}} → {{to}} · {{date}}',
    body: `Namaste {{name}},

Your bus ticket is confirmed. Have a safe journey!

PNR: {{pnr}}
Route: {{from}} → {{to}}
Date: {{date}}
Departure: {{time}}
Arrival: {{arrival}}
Seat(s): {{seats}}
Passengers: {{passengerList}}
Infants: {{infants}}

Boarding point: {{boarding}} ({{boardingTime}})
Dropping point: {{dropping}}
Bus: {{busNumber}} · {{companyName}}
Amount paid: ₹{{amount}}

Your boarding pass (QR code) — view, download or print:
{{ticketUrl}}

Before you travel
• Reach the boarding point 15 minutes before departure.
• Carry a valid government photo ID.
• Show the QR code to the bus manager while boarding.

Rupadiya Bus Samiti`
  },

  // ---------------------------------------------------------------- cancellation & refund
  {
    event: 'BOOKING_CANCELLED', audience: 'PASSENGER', channel: 'WHATSAPP',
    body: `❌ *TICKET CANCELLED*
_Rupadiya Bus Samiti_
${LINE}

Hi *{{name}}*, your ticket has been cancelled.

🔖 *PNR:* {{pnr}}
🚌 {{from}} ➜ {{to}}
📅 {{date}} · {{time}}
💺 *Seat(s):* {{seats}}

💰 *Refund:* ₹{{refundAmount}}
_It reaches your original payment method in 5–7 working days._

🔁 Book again anytime: {{bookUrl}}`
  },
  {
    event: 'BOOKING_CANCELLED', audience: 'PASSENGER', channel: 'EMAIL',
    subject: 'Ticket cancelled · PNR {{pnr}}',
    body: `Hi {{name}},

Your ticket has been cancelled.

PNR: {{pnr}}
Route: {{from}} → {{to}}
Date: {{date}}, {{time}}
Seat(s): {{seats}}

Refund amount: ₹{{refundAmount}}
The refund reaches your original payment method in 5–7 working days.

Book again anytime: {{bookUrl}}

Rupadiya Bus Samiti`
  },
  {
    event: 'BOOKING_CANCELLED', audience: 'AGENT', channel: 'WHATSAPP',
    body: `⚠️ *TICKET CANCELLED*
_Booked by you_
${LINE}

🔖 *PNR:* {{pnr}}
👤 *Passenger:* {{name}}
🚌 {{from}} ➜ {{to}} · {{date}}
💺 *Seat(s):* {{seats}}

💰 *Refund:* ₹{{refundAmount}}
👛 Credited to your *agent wallet*

— Rupadiya Bus Samiti`
  },
  {
    event: 'REFUND_PROCESSED', audience: 'PASSENGER', channel: 'WHATSAPP',
    body: `💰 *REFUND PROCESSED*
_Rupadiya Bus Samiti_
${LINE}

Hi *{{name}}*, your refund has been sent ✅

🔖 *PNR:* {{pnr}}
💵 *Amount:* ₹{{refundAmount}}
🏦 *To:* your original payment method
⏳ *Arrives in:* 5–7 working days

_Thank you for your patience._ 🙏`
  },
  {
    event: 'REFUND_PROCESSED', audience: 'PASSENGER', channel: 'EMAIL',
    subject: 'Refund processed · ₹{{refundAmount}} · PNR {{pnr}}',
    body: `Hi {{name}},

Your refund has been processed.

PNR: {{pnr}}
Amount: ₹{{refundAmount}}
To: your original payment method
Arrives in: 5–7 working days

Thank you for your patience.

Rupadiya Bus Samiti`
  },

  // ---------------------------------------------------------------- agent
  {
    event: 'CASH_RECEIVED', audience: 'AGENT', channel: 'WHATSAPP',
    body: `✅ *CASH RECEIVED*
${LINE}

🏢 *{{companyName}}* office received your cash.

🔖 *PNR:* {{pnr}}
💵 *Amount:* ₹{{amount}}
🧾 *Receipt no:* {{receiptNo}}

🚌 Passengers on this ticket can now board.

— Rupadiya Bus Samiti`
  },
  {
    event: 'PAYOUT_PAID', audience: 'AGENT', channel: 'WHATSAPP',
    body: `💸 *PAYMENT SENT*
${LINE}

Your withdrawal has been paid ✅

💵 *Amount:* ₹{{amount}}
🏦 *To:* your bank account
🔢 *UTR:* {{utr}}

_It may take a few minutes to show in your bank._

— Rupadiya Bus Samiti`
  },

  // ---------------------------------------------------------------- journey (passenger)
  {
    event: 'PASSENGER_BOARDED', audience: 'PASSENGER', channel: 'WHATSAPP',
    body: `🚌 *WELCOME ABOARD!*
${LINE}

Hi *{{name}}* 👋 you have boarded your bus.

🚍 *Bus:* {{busNumber}}
🗺️ *Route:* {{from}} ➜ {{to}}
💺 *Seat:* {{seats}}
🏁 *Dropping:* {{dropping}}

Sit back, relax and enjoy the ride 😊
_Wishing you a safe journey!_

— Rupadiya Bus Samiti`
  },
  {
    event: 'JOURNEY_POINT_CHANGED', audience: 'PASSENGER', channel: 'WHATSAPP',
    body: `📍 *JOURNEY UPDATE*
_Rupadiya Bus Samiti_
${LINE}

Hi *{{name}}*,
🔄 {{changeText}}

🔖 *PNR:* {{pnr}}
🚍 *Bus:* {{busNumber}} ({{from}} ➜ {{to}})
💺 *Seat:* {{seats}}

📞 *Bus manager:* {{managerName}} {{managerPhone}}`
  },
  {
    event: 'PASSENGER_DROPPED', audience: 'PASSENGER', channel: 'WHATSAPP',
    body: `🏁 *YOU HAVE ARRIVED!*
${LINE}

Thank you for travelling with *Rupadiya Bus Samiti*, {{name}} 🙏
You have reached *{{dropping}}*.

We hope you had a comfortable journey 😊

⭐ Travelling again?
👉 Book your next trip: {{bookUrl}}`
  },

  // ---------------------------------------------------------------- journey (company / RBS)
  {
    event: 'TRIP_STARTED', audience: 'COMPANY', channel: 'WHATSAPP',
    body: `🚦 *JOURNEY STARTED*
${LINE}

🚍 *Bus:* {{busNumber}}
🗺️ *Route:* {{from}} ➜ {{to}}
📅 {{date}} · {{time}}

👥 *Boarded:* {{boarded}} / {{total}}
🚫 *No-show:* {{noShow}}
👨‍✈️ *Bus manager:* {{managerName}}`
  },
  {
    event: 'TRIP_STARTED', audience: 'ADMIN', channel: 'WHATSAPP',
    body: `🚦 *JOURNEY STARTED*
${LINE}

🏢 *Company:* {{companyName}}
🚍 *Bus:* {{busNumber}}
🗺️ *Route:* {{from}} ➜ {{to}}
📅 {{date}} · {{time}}

👥 *Boarded:* {{boarded}} / {{total}}
🚫 *No-show:* {{noShow}}
👨‍✈️ *Bus manager:* {{managerName}}`
  },
  {
    event: 'JOURNEY_POINT_CHANGED', audience: 'COMPANY', channel: 'WHATSAPP',
    body: `📍 *BOARDING / DROP CHANGE*
${LINE}

🚍 {{busNumber}} · {{from}} ➜ {{to}} · {{date}}
🔖 *PNR:* {{pnr}}
💺 *Seat:* {{seats}}
👤 *Passenger:* {{name}}

🔄 {{changeText}}
📝 *Reason:* {{reason}}
👨‍✈️ *By:* {{managerName}}`
  },
  {
    event: 'JOURNEY_POINT_CHANGED', audience: 'ADMIN', channel: 'WHATSAPP',
    body: `📍 *BOARDING / DROP CHANGE*
${LINE}

🏢 *Company:* {{companyName}}
🚍 {{busNumber}} · {{from}} ➜ {{to}} · {{date}}
🔖 *PNR:* {{pnr}}
💺 *Seat:* {{seats}}
👤 *Passenger:* {{name}}

🔄 {{changeText}}
📝 *Reason:* {{reason}}
👨‍✈️ *By:* {{managerName}}`
  },
  {
    event: 'TRIP_COMPLETED', audience: 'COMPANY', channel: 'WHATSAPP',
    body: `✅ *JOURNEY COMPLETED*
${LINE}

🚍 *Bus:* {{busNumber}}
🗺️ *Route:* {{from}} ➜ {{to}}
📅 {{date}}

👥 *Travelled:* {{boarded}}
🏁 *Dropped:* {{dropped}}
🚫 *No-show:* {{noShow}}`
  },
  {
    event: 'TRIP_COMPLETED', audience: 'ADMIN', channel: 'WHATSAPP',
    body: `✅ *JOURNEY COMPLETED*
${LINE}

🏢 *Company:* {{companyName}}
🚍 *Bus:* {{busNumber}}
🗺️ *Route:* {{from}} ➜ {{to}}
📅 {{date}}

👥 *Travelled:* {{boarded}}
🏁 *Dropped:* {{dropped}}
🚫 *No-show:* {{noShow}}`
  }
];
