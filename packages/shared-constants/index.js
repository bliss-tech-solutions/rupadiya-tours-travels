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
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  HELD: 'HELD',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  EXPIRED: 'EXPIRED'
};

const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  INITIATED: 'INITIATED',
  AUTHORIZED: 'AUTHORIZED',
  CAPTURED: 'CAPTURED',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  REFUND_PENDING: 'REFUND_PENDING',
  REFUNDED: 'REFUNDED',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED'
};

const PAYMENT_PROVIDERS = {
  RAZORPAY: 'RAZORPAY',
  AGENT_WALLET: 'AGENT_WALLET',
  DUMMY: 'dummy'
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
  TICKET_CANCELLATION_REFUND: 'TICKET_CANCELLATION_REFUND',
  CANCELLATION_FEE_OPERATOR_CREDIT: 'CANCELLATION_FEE_OPERATOR_CREDIT',
  ONLINE_REFUND_PROCESSED: 'ONLINE_REFUND_PROCESSED'
};

const REFUND_STATUS = {
  PENDING: 'PENDING',
  PROCESSED: 'PROCESSED',
  FAILED: 'FAILED',
  REJECTED: 'REJECTED'
};

const DEFAULT_BONUS_PER_SEAT = 20;
const DEFAULT_COMMISSION_TIERS = [
  { level: 1, name: 'Direct Agent (L1)', ratePerSeat: 100, bonusPerSeat: DEFAULT_BONUS_PER_SEAT },
  { level: 2, name: 'Tier 2 Referral (L2)', ratePerSeat: 100, bonusPerSeat: DEFAULT_BONUS_PER_SEAT },
  { level: 3, name: 'Regional Head (L3)', ratePerSeat: 100, bonusPerSeat: DEFAULT_BONUS_PER_SEAT },
  { level: 4, name: 'Zonal Lead (L4)', ratePerSeat: 200, bonusPerSeat: DEFAULT_BONUS_PER_SEAT },
  { level: 5, name: 'State Master (L5)', ratePerSeat: 300, bonusPerSeat: DEFAULT_BONUS_PER_SEAT }
];
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

function normalizeCityId(input) {
  if (!input) return '';
  const lower = input.toString().trim().toLowerCase();
  if (lower === 'rupadiya' || lower === 'rup') return 'rupadiya';
  if (lower === 'bengaluru' || lower === 'bangalore' || lower === 'blr') return 'bangalore';
  if (lower === 'ahmedabad' || lower === 'amd') return 'ahmedabad';
  if (lower === 'vadodara' || lower === 'baroda' || lower === 'bdq') return 'vadodara';
  if (lower === 'surat' || lower === 'st') return 'surat';
  if (lower === 'hyderabad' || lower === 'hyd') return 'hyderabad';
  if (lower === 'mumbai' || lower === 'bombay' || lower === 'bom') return 'mumbai';
  return lower;
}

function isValidCorridor(fromId, toId) {
  if (!fromId || !toId) return false;
  const f = normalizeCityId(fromId);
  const t = normalizeCityId(toId);
  if (f === 'rupadiya' && SPOKE_IDS.includes(t)) return true;
  if (SPOKE_IDS.includes(f) && t === 'rupadiya') return true;
  return false;
}

// Pre-defined 34 Fixed Passenger Ranking Franchise Companies (Ranks 1 to 34)
const FIXED_COMPANY_SPECS = [
  { rank: 1, code: 1, shortCode: 'Ntt', defaultName: 'Ntt Travels & Logistics', slug: 'ntt' },
  { rank: 2, code: 2, shortCode: 'Stt', defaultName: 'Stt Express', slug: 'stt' },
  { rank: 3, code: 3, shortCode: 'Mtt', defaultName: 'Mtt Transporters', slug: 'mtt' },
  { rank: 4, code: 4, shortCode: 'Bdtt', defaultName: 'Bdtt Roadlines', slug: 'bdtt' },
  { rank: 5, code: 5, shortCode: 'Jbltt', defaultName: 'Jbltt Travels', slug: 'jbltt' },
  { rank: 6, code: 6, shortCode: 'Dtt', defaultName: 'Dtt Express', slug: 'dtt' },
  { rank: 7, code: 7, shortCode: 'Ptt', defaultName: 'Ptt Transporters', slug: 'ptt' },
  { rank: 8, code: 8, shortCode: 'Skt', defaultName: 'Skt Travels', slug: 'skt' },
  { rank: 9, code: 9, shortCode: 'Mhtt', defaultName: 'Mhtt Roadlines', slug: 'mhtt' },
  { rank: 10, code: 10, shortCode: 'Blt', defaultName: 'Blt Express', slug: 'blt' },
  { rank: 11, code: 11, shortCode: 'Mkltt', defaultName: 'Mkltt Travels', slug: 'mkltt' },
  { rank: 12, code: 12, shortCode: 'Srm', defaultName: 'Srm Transporters', slug: 'srm' },
  { rank: 13, code: 13, shortCode: 'Slntt', defaultName: 'Slntt Roadlines', slug: 'slntt' },
  { rank: 14, code: 14, shortCode: 'Up', defaultName: 'Up Express', slug: 'up' },
  { rank: 15, code: 15, shortCode: 'Ram', defaultName: 'Ram Travels', slug: 'ram' },
  { rank: 16, code: 16, shortCode: 'Sbltt', defaultName: 'Sbltt Roadlines', slug: 'sbltt' },
  { rank: 17, code: 17, shortCode: 'Att', defaultName: 'Att Express', slug: 'att' },
  { rank: 18, code: 18, shortCode: 'Manv', defaultName: 'Manv Travels', slug: 'manv' },
  { rank: 19, code: 19, shortCode: 'Rstt', defaultName: 'Rstt Transporters', slug: 'rstt' },
  { rank: 20, code: 20, shortCode: 'Vapi', defaultName: 'Vapi Express', slug: 'vapi' },
  { rank: 21, code: 21, shortCode: 'Btt', defaultName: 'Btt Roadlines', slug: 'btt' },
  { rank: 22, code: 22, shortCode: 'Rntt', defaultName: 'Rntt Travels', slug: 'rntt' },
  { rank: 23, code: 23, shortCode: 'KKt', defaultName: 'KKt Express', slug: 'kkt' },
  { rank: 24, code: 24, shortCode: 'Kgtt', defaultName: 'Kgtt Roadlines', slug: 'kgtt' },
  { rank: 25, code: 25, shortCode: 'ASST', defaultName: 'ASST Travels', slug: 'asst' },
  { rank: 26, code: 26, shortCode: 'Lord', defaultName: 'Lord Express', slug: 'lord' },
  { rank: 27, code: 27, shortCode: 'BSST', defaultName: 'BSST Transporters', slug: 'bsst' },
  { rank: 28, code: 28, shortCode: 'Jktt', defaultName: 'Jktt Roadlines', slug: 'jktt' },
  { rank: 29, code: 29, shortCode: 'RRt', defaultName: 'RRt Travels', slug: 'rrt' },
  { rank: 30, code: 30, shortCode: 'Msn', defaultName: 'Msn Express', slug: 'msn' },
  { rank: 31, code: 31, shortCode: 'Hktt', defaultName: 'Hktt Roadlines', slug: 'hktt' },
  { rank: 32, code: 32, shortCode: 'Jsrm', defaultName: 'Jsrm Travels', slug: 'jsrm' },
  { rank: 33, code: 33, shortCode: 'Kltt', defaultName: 'Kltt Express', slug: 'kltt' },
  { rank: 34, code: 34, shortCode: 'Ott', defaultName: 'Ott Roadlines', slug: 'ott' }
];

const COMPANY_CODES = FIXED_COMPANY_SPECS.map(spec => ({
  rank: spec.rank,
  code: spec.code,
  shortCode: spec.shortCode,
  defaultName: spec.defaultName,
  slug: spec.slug
}));

module.exports = {
  ROLES,
  SEAT_STATUS,
  SEAT_CATEGORY,
  BOOKING_STATUS,
  PAYMENT_STATUS,
  PAYMENT_PROVIDERS,
  KYC_STATUS,
  WITHDRAWAL_STATUS,
  REFUND_STATUS,
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
  normalizeCityId,
  isValidCorridor,
  COMPANY_CODES,
  FIXED_COMPANY_SPECS
};

