/**
 * Rupadiya Bus Booking Platform - Shared Constants
 */

const ROLES = {
  PASSENGER: 'PASSENGER',
  AGENT: 'AGENT',
  COMPANY_OWNER: 'COMPANY_OWNER',
  SUPER_ADMIN: 'SUPER_ADMIN'
};

const SEAT_STATUS = {
  AVAILABLE: 'AVAILABLE',
  SELECTED: 'SELECTED',
  HELD: 'HELD',
  BOOKED: 'BOOKED',
  BLOCKED: 'BLOCKED'
};

const SEAT_CATEGORY = {
  STANDARD: 'STANDARD',
  SLEEPER: 'SLEEPER',
  FEMALE_ONLY: 'FEMALE_ONLY'
};

const BOOKING_STATUS = {
  HELD: 'HELD',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  EXPIRED: 'EXPIRED'
};

const PAYMENT_STATUS = {
  INITIATED: 'INITIATED',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED'
};

const PAYMENT_PROVIDERS = {
  DUMMY: 'dummy',
  RAZORPAY: 'razorpay'
};

const KYC_STATUS = {
  NOT_SUBMITTED: 'NOT_SUBMITTED',
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED'
};

const WITHDRAWAL_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PAID: 'PAID'
};

const TRANSACTION_TYPES = {
  TICKET_PURCHASE: 'TICKET_PURCHASE',
  TICKET_COMMISSION_CREDIT: 'TICKET_COMMISSION_CREDIT',
  COMMISSION_REVERSAL: 'COMMISSION_REVERSAL',
  WALLET_DEPOSIT: 'WALLET_DEPOSIT',
  WITHDRAWAL_LOCK: 'WITHDRAWAL_LOCK',
  WITHDRAWAL_SETTLED: 'WITHDRAWAL_SETTLED',
  WITHDRAWAL_REJECTED_REFUND: 'WITHDRAWAL_REJECTED_REFUND',
  TICKET_CANCELLATION_REFUND: 'TICKET_CANCELLATION_REFUND'
};

const DEFAULT_COMMISSION_TIERS = [
  { level: 1, name: 'Direct Agent (L1)', ratePerSeat: 100 },
  { level: 2, name: 'Tier 2 Referral (L2)', ratePerSeat: 100 },
  { level: 3, name: 'Regional Head (L3)', ratePerSeat: 100 },
  { level: 4, name: 'Zonal Lead (L4)', ratePerSeat: 200 },
  { level: 5, name: 'State Master (L5)', ratePerSeat: 300 }
];

const DEFAULT_BONUS_PER_SEAT = 20;
const DEFAULT_TCS_RATE = 0.01; // 1% TCS
const DEFAULT_GST_RATE = 0.05; // 5% GST for passenger transport

const SEAT_HOLD_DURATION_SECONDS = 600; // 10 minutes
const MINIMUM_WITHDRAWAL_AMOUNT = 500;
const MINIMUM_DEPOSIT_AMOUNT = 100;

const TOTAL_BUS_SEATS = 40;

const HUB_CITY = { id: 'rupadiya', name: 'Rupadiya', state: 'Uttar Pradesh', code: 'RUP' };

const SPOKE_CITIES = [
  { id: 'ahmedabad', name: 'Ahmedabad', state: 'Gujarat', code: 'AMD' },
  { id: 'vadodara', name: 'Vadodara', state: 'Gujarat', code: 'BDQ' },
  { id: 'surat', name: 'Surat', state: 'Gujarat', code: 'ST' },
  { id: 'bangalore', name: 'Bengaluru', state: 'Karnataka', code: 'BLR' },
  { id: 'hyderabad', name: 'Hyderabad', state: 'Telangana', code: 'HYD' },
  { id: 'mumbai', name: 'Mumbai', state: 'Maharashtra', code: 'BOM' }
];

const CITIES = [HUB_CITY, ...SPOKE_CITIES];

const SPOKE_IDS = SPOKE_CITIES.map(c => c.id);

function isValidCorridor(fromId, toId) {
  if (!fromId || !toId) return false;
  const f = fromId.toLowerCase();
  const t = toId.toLowerCase();
  if (f === 'rupadiya' && SPOKE_IDS.includes(t)) return true;
  if (SPOKE_IDS.includes(f) && t === 'rupadiya') return true;
  return false;
}

// Pre-defined 33 Company Codes
const COMPANY_CODES = Array.from({ length: 33 }, (_, idx) => {
  const code = idx + 1;
  return {
    code,
    defaultName: `Rupadiya Transporters Co. #${code.toString().padStart(2, '0')}`,
    slug: `comp-${code}`
  };
});

module.exports = {
  ROLES,
  SEAT_STATUS,
  SEAT_CATEGORY,
  BOOKING_STATUS,
  PAYMENT_STATUS,
  PAYMENT_PROVIDERS,
  KYC_STATUS,
  WITHDRAWAL_STATUS,
  TRANSACTION_TYPES,
  DEFAULT_COMMISSION_TIERS,
  DEFAULT_BONUS_PER_SEAT,
  DEFAULT_TCS_RATE,
  DEFAULT_GST_RATE,
  SEAT_HOLD_DURATION_SECONDS,
  MINIMUM_WITHDRAWAL_AMOUNT,
  MINIMUM_DEPOSIT_AMOUNT,
  TOTAL_BUS_SEATS,
  HUB_CITY,
  SPOKE_CITIES,
  SPOKE_IDS,
  CITIES,
  isValidCorridor,
  COMPANY_CODES
};

