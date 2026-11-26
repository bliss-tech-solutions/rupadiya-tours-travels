/**
 * Previous (v1) default templates — kept only so ensureTemplates() can recognise templates that
 * were never edited by an admin and upgrade them to the current defaults. Do not edit.
 */
module.exports = [
  {
    event: 'BOOKING_CONFIRMED', audience: 'PASSENGER', channel: 'WHATSAPP',
    body: `🚌 *Rupadiya Bus Samiti — Ticket Confirmed*

Namaste {{name}}, your ticket is booked.

PNR: *{{pnr}}*
{{from}} → {{to}}
Date: {{date}}, {{time}}
Seats: {{seats}}
Boarding: {{boarding}} ({{boardingTime}})
Dropping: {{dropping}}
Bus: {{busNumber}} · {{companyName}}
Amount: ₹{{amount}}

Show this ticket (QR) to the bus manager while boarding:
{{ticketUrl}}

Happy journey! 🙏`
  },
  {
    event: 'BOOKING_CONFIRMED', audience: 'PASSENGER', channel: 'EMAIL',
    subject: 'Ticket confirmed · PNR {{pnr}} · {{from}} → {{to}}',
    body: `Namaste {{name}},

Your bus ticket is confirmed.

PNR: {{pnr}}
Route: {{from}} → {{to}}
Date & time: {{date}}, {{time}}
Seats: {{seats}}
Boarding point: {{boarding}} ({{boardingTime}})
Dropping point: {{dropping}}
Bus: {{busNumber}} · {{companyName}}
Amount paid: ₹{{amount}}

View / print your ticket with QR code: {{ticketUrl}}

Please reach the boarding point 15 minutes before departure with a valid photo ID.

Rupadiya Bus Samiti`
  },
  {
    event: 'BOOKING_CANCELLED', audience: 'PASSENGER', channel: 'WHATSAPP',
    body: `❌ *Ticket Cancelled*

{{name}}, your ticket PNR *{{pnr}}* ({{from}} → {{to}}, {{date}}) has been cancelled.
Refund: ₹{{refundAmount}}

Rupadiya Bus Samiti`
  },
  {
    event: 'BOOKING_CANCELLED', audience: 'PASSENGER', channel: 'EMAIL',
    subject: 'Ticket cancelled · PNR {{pnr}}',
    body: `{{name}},

Your ticket PNR {{pnr}} ({{from}} → {{to}}, {{date}}) has been cancelled.
Refund amount: ₹{{refundAmount}}

Rupadiya Bus Samiti`
  },
  {
    event: 'BOOKING_CANCELLED', audience: 'AGENT', channel: 'WHATSAPP',
    body: `Ticket PNR *{{pnr}}* ({{from}} → {{to}}, {{date}}) booked by you was cancelled. Refund ₹{{refundAmount}} goes to your agent wallet.`
  },
  {
    event: 'REFUND_PROCESSED', audience: 'PASSENGER', channel: 'WHATSAPP',
    body: `💰 Refund of ₹{{refundAmount}} for PNR *{{pnr}}* has been processed to your original payment method. It may take 5-7 working days to reflect.

Rupadiya Bus Samiti`
  },
  {
    event: 'REFUND_PROCESSED', audience: 'PASSENGER', channel: 'EMAIL',
    subject: 'Refund processed · PNR {{pnr}}',
    body: `Your refund of ₹{{refundAmount}} for PNR {{pnr}} has been processed to your original payment method. It may take 5-7 working days to reflect.

Rupadiya Bus Samiti`
  },
  {
    event: 'CASH_RECEIVED', audience: 'AGENT', channel: 'WHATSAPP',
    body: `✅ {{companyName}} office received ₹{{amount}} cash for PNR *{{pnr}}*. Receipt: {{receiptNo}}. Passengers on this ticket can now board.`
  },
  {
    event: 'PASSENGER_BOARDED', audience: 'PASSENGER', channel: 'WHATSAPP',
    body: `🚌 Welcome aboard, {{name}}! You have boarded bus {{busNumber}} ({{from}} → {{to}}), seat {{seats}}. Your journey has started. Wishing you a safe trip!`
  },
  {
    event: 'TRIP_STARTED', audience: 'COMPANY', channel: 'WHATSAPP',
    body: `🚌 *Journey started* · {{busNumber}} {{from}} → {{to}} ({{date}} {{time}})
Boarded: {{boarded}} / {{total}} · No-show: {{noShow}}
Bus manager: {{managerName}}`
  },
  {
    event: 'TRIP_STARTED', audience: 'ADMIN', channel: 'WHATSAPP',
    body: `🚌 *Journey started* · {{companyName}} · {{busNumber}} {{from}} → {{to}} ({{date}} {{time}})
Boarded: {{boarded}} / {{total}} · No-show: {{noShow}}
Bus manager: {{managerName}}`
  },
  {
    event: 'JOURNEY_POINT_CHANGED', audience: 'PASSENGER', channel: 'WHATSAPP',
    body: `🚌 *Journey update* · PNR {{pnr}}

Namaste {{name}}, {{changeText}}
Bus {{busNumber}} ({{from}} → {{to}}), seat {{seats}}.
Bus manager: {{managerName}} {{managerPhone}}`
  },
  {
    event: 'JOURNEY_POINT_CHANGED', audience: 'COMPANY', channel: 'WHATSAPP',
    body: `📍 *Boarding / drop change* · {{busNumber}} {{from}} → {{to}} ({{date}})
PNR {{pnr}} · Seat {{seats}} · {{name}}
{{changeText}}
Reason: {{reason}}
Bus manager: {{managerName}}`
  },
  {
    event: 'JOURNEY_POINT_CHANGED', audience: 'ADMIN', channel: 'WHATSAPP',
    body: `📍 *Boarding / drop change* · {{companyName}} · {{busNumber}} {{from}} → {{to}} ({{date}})
PNR {{pnr}} · Seat {{seats}} · {{name}}
{{changeText}}
Reason: {{reason}}
Bus manager: {{managerName}}`
  },
  {
    event: 'PASSENGER_DROPPED', audience: 'PASSENGER', channel: 'WHATSAPP',
    body: `🙏 Thank you for travelling with Rupadiya Bus Samiti, {{name}}! You have reached {{dropping}}. We hope you had a comfortable journey.

Book your next trip: {{bookUrl}}`
  },
  {
    event: 'TRIP_COMPLETED', audience: 'COMPANY', channel: 'WHATSAPP',
    body: `✅ *Journey completed* · {{busNumber}} {{from}} → {{to}} ({{date}})
Travelled: {{boarded}} · Dropped: {{dropped}} · No-show: {{noShow}}`
  },
  {
    event: 'TRIP_COMPLETED', audience: 'ADMIN', channel: 'WHATSAPP',
    body: `✅ *Journey completed* · {{companyName}} · {{busNumber}} {{from}} → {{to}} ({{date}})
Travelled: {{boarded}} · Dropped: {{dropped}} · No-show: {{noShow}}`
  },
  {
    event: 'PAYOUT_PAID', audience: 'AGENT', channel: 'WHATSAPP',
    body: `💸 Your withdrawal of ₹{{amount}} has been paid to your bank account. UTR: {{utr}}. — Rupadiya Bus Samiti`
  }
];
