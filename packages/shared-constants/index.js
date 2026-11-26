/**
 * Rupadiya Bus Booking Platform - Shared Constants
 */

const ROLES = {
  PASSENGER: 'PASSENGER',
  AGENT: 'AGENT',
  COMPANY_OWNER: 'COMPANY_OWNER',
  SUPER_ADMIN: 'SUPER_ADMIN',
  BUS_MANAGER: 'BUS_MANAGER'
};

// Super admin levels: only PRIMARY may manage admin accounts and export user/passenger data.
const ADMIN_LEVELS = {
  PRIMARY: 'PRIMARY',
  STANDARD: 'STANDARD'
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
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
  CASH_PENDING: 'CASH_PENDING'      // agent cash ticket: money not yet handed to the company office
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
  PROCESSING: 'PROCESSING',        // approved, payout sent to bank, awaiting confirmation
  PAYOUT_FAILED: 'PAYOUT_FAILED',  // bank/RazorpayX rejected or reversed; owner can retry or reject
  APPROVED: 'APPROVED',            // money delivered to the agent (UTR recorded)
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
  ONLINE_REFUND_PROCESSED: 'ONLINE_REFUND_PROCESSED',
  ADMIN_ADJUSTMENT: 'ADMIN_ADJUSTMENT',
  COMPANY_TO_AGENT_TRANSFER: 'COMPANY_TO_AGENT_TRANSFER',
  AGENT_PAYOUT_FUNDING: 'AGENT_PAYOUT_FUNDING',
  AGENT_PAYOUT_FUNDING_REVERSAL: 'AGENT_PAYOUT_FUNDING_REVERSAL',
  AGENT_SERVICE_CHARGE: 'AGENT_SERVICE_CHARGE'
};

const REFUND_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
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

const HUB_CITY = { id: 'rupaidiha', name: 'Rupaidiha', alias: ['rupadiya', 'rup'], state: 'Uttar Pradesh', code: 'RUP' };

/**
 * 4 Corridors & 16 Spoke Cities grouped by regional routes
 */
const ROUTE_GROUPS = [
  {
    id: 'route-1-gujarat',
    name: 'Route 1 - Gujarat',
    cities: [
      { id: 'himatnagar', name: 'Himatnagar', state: 'Gujarat', code: 'HMT', baseFare: 1500, duration: '20h', distanceKm: 1150 },
      { id: 'ahmedabad', name: 'Ahmedabad', state: 'Gujarat', code: 'AMD', baseFare: 1650, duration: '21h', distanceKm: 1250 },
      { id: 'baroda', name: 'Baroda', alias: ['vadodara', 'bdq'], state: 'Gujarat', code: 'BDQ', baseFare: 1550, duration: '20h', distanceKm: 1180 },
      { id: 'ankleshwar', name: 'Ankleshwar', state: 'Gujarat', code: 'AKV', baseFare: 1650, duration: '21h 30m', distanceKm: 1260 },
      { id: 'surat', name: 'Surat', state: 'Gujarat', code: 'ST', baseFare: 1750, duration: '22h 30m', distanceKm: 1320 },
      { id: 'vapi', name: 'Vapi', state: 'Gujarat', code: 'VAPI', baseFare: 1850, duration: '24h', distanceKm: 1420 }
    ]
  },
  {
    id: 'route-2-saurashtra',
    name: 'Route 2 - Saurashtra',
    cities: [
      { id: 'ambli-bopal', name: 'Ambli Bopal', alias: ['ambli bopal', 'amblibopal', 'bopal'], state: 'Gujarat', code: 'BPL', baseFare: 1680, duration: '21h 15m', distanceKm: 1255 },
      { id: 'chotila', name: 'Chotila', state: 'Gujarat', code: 'CTL', baseFare: 1800, duration: '23h', distanceKm: 1380 },
      { id: 'rajkot', name: 'Rajkot', state: 'Gujarat', code: 'RJT', baseFare: 1900, duration: '24h 30m', distanceKm: 1440 },
      { id: 'jamnagar', name: 'Jamnagar', state: 'Gujarat', code: 'JMN', baseFare: 2050, duration: '26h', distanceKm: 1520 }
    ]
  },
  {
    id: 'route-3-south',
    name: 'Route 3 - South',
    cities: [
      { id: 'hyderabad', name: 'Hyderabad', state: 'Telangana', code: 'HYD', baseFare: 2150, duration: '28h', distanceKm: 1450 },
      { id: 'bangalore', name: 'Bangalore', alias: ['bengaluru', 'blr'], state: 'Karnataka', code: 'BLR', baseFare: 2400, duration: '32h', distanceKm: 1820 }
    ]
  },
  {
    id: 'route-4-maharashtra-goa',
    name: 'Route 4 - Maharashtra / Goa',
    cities: [
      { id: 'nashik', name: 'Nashik', state: 'Maharashtra', code: 'NSK', baseFare: 1800, duration: '22h', distanceKm: 1280 },
      { id: 'mumbai', name: 'Mumbai', alias: ['bombay', 'bom'], state: 'Maharashtra', code: 'BOM', baseFare: 1950, duration: '25h', distanceKm: 1420 },
      { id: 'pune', name: 'Pune', state: 'Maharashtra', code: 'PUN', baseFare: 2050, duration: '26h 30m', distanceKm: 1500 },
      { id: 'goa', name: 'Goa', alias: ['panaji', 'madgaon'], state: 'Goa', code: 'GOA', baseFare: 2500, duration: '33h', distanceKm: 1890 }
    ]
  }
];

// Flattened spoke cities list
const SPOKE_CITIES = ROUTE_GROUPS.flatMap(g => g.cities.map(c => ({
  id: c.id,
  name: c.name,
  state: c.state,
  code: c.code,
  baseFare: c.baseFare,
  duration: c.duration,
  distanceKm: c.distanceKm,
  routeGroupId: g.id,
  routeName: g.name
})));

const CITIES = [HUB_CITY, ...SPOKE_CITIES];

const SPOKE_IDS = SPOKE_CITIES.map(c => c.id);

function normalizeCityId(input) {
  if (!input) return '';
  const lower = input.toString().trim().toLowerCase().replace(/[()]/g, '').trim();

  // Hub aliases
  if (lower === 'rupaidiha' || lower.includes('rupaidiha') || lower === 'rupadiya' || lower === 'rup' || lower.includes('rupadiya')) return 'rupaidiha';

  // Route 1 - Gujarat
  if (lower === 'himatnagar' || lower === 'hmt') return 'himatnagar';
  if (lower === 'ahmedabad' || lower === 'amd') return 'ahmedabad';
  if (lower === 'baroda' || lower === 'vadodara' || lower === 'bdq') return 'baroda';
  if (lower === 'ankleshwar' || lower === 'akv') return 'ankleshwar';
  if (lower === 'surat' || lower === 'st') return 'surat';
  if (lower === 'vapi') return 'vapi';

  // Route 2 - Saurashtra
  if (lower === 'ambli bopal' || lower === 'ambli-bopal' || lower === 'amblibopal' || lower === 'bopal') return 'ambli-bopal';
  if (lower === 'chotila' || lower === 'ctl') return 'chotila';
  if (lower === 'rajkot' || lower === 'rjt') return 'rajkot';
  if (lower === 'jamnagar' || lower === 'jmn') return 'jamnagar';

  // Route 3 - South
  if (lower === 'hyderabad' || lower === 'hyd') return 'hyderabad';
  if (lower === 'bengaluru' || lower === 'bangalore' || lower === 'blr') return 'bangalore';

  // Route 4 - Maharashtra / Goa
  if (lower === 'nashik' || lower === 'nsk') return 'nashik';
  if (lower === 'mumbai' || lower === 'bombay' || lower === 'bom') return 'mumbai';
  if (lower === 'pune' || lower === 'pun') return 'pune';
  if (lower === 'goa' || lower === 'panaji' || lower === 'madgaon') return 'goa';

  return lower;
}

function isValidCorridor(fromId, toId) {
  if (!fromId || !toId) return false;
  const f = normalizeCityId(fromId);
  const t = normalizeCityId(toId);
  const isFHub = f === 'rupaidiha' || f === 'rupadiya';
  const isTHub = t === 'rupaidiha' || t === 'rupadiya';
  if (isFHub && (SPOKE_IDS.includes(t) || t === 'vadodara')) return true;
  if ((SPOKE_IDS.includes(f) || f === 'vadodara') && isTHub) return true;
  return false;
}

// 35 Fixed Passenger Ranking Franchise Companies (Ranks 1 to 35) with Share Capital 
const FIXED_COMPANY_SPECS = [
  { rank: 1, code: 1, shortCode: 'BDTT', defaultName: 'Bageshwari Darshan Tours and Travels', shareCapital: 650000, slug: 'bdtt' },
  { rank: 2, code: 2, shortCode: 'BTT', defaultName: 'Baijnath Tours and Travels', shareCapital: 215000, slug: 'btt' },
  { rank: 3, code: 3, shortCode: 'PDTT', defaultName: 'Pashupati Darshan Tours and Travels', shareCapital: 650000, slug: 'pdtt' },
  { rank: 4, code: 4, shortCode: 'JBLTT', defaultName: 'Jai Balaji Tours and Travels', shareCapital: 408000, slug: 'jbltt' },
  { rank: 5, code: 5, shortCode: 'JKTT', defaultName: 'Jai Krishna Tours and Travels', shareCapital: 160000, slug: 'jktt' },
  { rank: 6, code: 6, shortCode: 'KKTT', defaultName: 'Kalika Karnali Tours and Travels', shareCapital: 134250, slug: 'kktt' },
  { rank: 7, code: 7, shortCode: 'LSTT', defaultName: 'Lord Siddhartha Tours and Travels', shareCapital: 172500, slug: 'lstt' },
  { rank: 8, code: 8, shortCode: 'MNTT', defaultName: 'Manav Tours and Travels', shareCapital: 200000, slug: 'mntt' },
  { rank: 9, code: 9, shortCode: 'MHTT', defaultName: 'Mahabu Tours and Travels', shareCapital: 212500, slug: 'mhtt' },
  { rank: 10, code: 10, shortCode: 'MTR', defaultName: 'Malika Tours and Travels', shareCapital: 550000, slug: 'mtr' },
  { rank: 11, code: 11, shortCode: 'NTT', defaultName: 'Nepalgunj Tours and Travels', shareCapital: 650000, slug: 'ntt' },
  { rank: 12, code: 12, shortCode: 'PTT', defaultName: 'Panchakoshi Tours and Travels', shareCapital: 470000, slug: 'ptt' },
  { rank: 13, code: 13, shortCode: 'DLTT', defaultName: 'Dailekhi Tours and Travels', shareCapital: 171000, slug: 'dltt' },
  { rank: 14, code: 14, shortCode: 'SBLTT', defaultName: 'Shubha Bhagya Laxmi Tours and Travels', shareCapital: 153000, slug: 'sbltt' },
  { rank: 15, code: 15, shortCode: 'SSTT', defaultName: 'Surkhet Tours and Travels', shareCapital: 500000, slug: 'sstt' },
  { rank: 16, code: 16, shortCode: 'SRTT', defaultName: 'Shri Ram Tours and Travels', shareCapital: 190000, slug: 'srtt' },
  { rank: 17, code: 17, shortCode: 'STT', defaultName: 'Simtali Tours and Travels', shareCapital: 650000, slug: 'stt' },
  { rank: 18, code: 18, shortCode: 'VTT', defaultName: 'Vapi Tours and Travels', shareCapital: 250000, slug: 'vtt' },
  { rank: 19, code: 19, shortCode: 'ATT', defaultName: 'Aman Tours and Travels', shareCapital: 300000, slug: 'att' },
  { rank: 20, code: 20, shortCode: 'BLTT', defaultName: 'Bhagya Laxmi Tours and Travels', shareCapital: 340000, slug: 'bltt' },
  { rank: 21, code: 21, shortCode: 'MKTT', defaultName: 'Mahakailash Tours and Travels', shareCapital: 421000, slug: 'mktt' },
  { rank: 22, code: 22, shortCode: 'KGTT', defaultName: 'Karnali Gaurav Tours and Travels', shareCapital: 105500, slug: 'kgtt' },
  { rank: 23, code: 23, shortCode: 'RRTT', defaultName: 'Radhe Radhe Tours and Travels', shareCapital: 64500, slug: 'rrtt' },
  { rank: 24, code: 24, shortCode: 'RSTT', defaultName: 'Royal Simtali Tours and Travels', shareCapital: 200000, slug: 'rstt' },
  { rank: 25, code: 25, shortCode: 'SLTT', defaultName: 'Salyani Tours and Travels', shareCapital: 250000, slug: 'sltt' },
  { rank: 26, code: 26, shortCode: 'SSHKTT', defaultName: 'Shiva Shakti Tours and Travels', shareCapital: 390000, slug: 'sshkt' },
  { rank: 27, code: 27, shortCode: 'HKTT', defaultName: 'Hamro Karnali Tours and Travels', shareCapital: 130000, slug: 'hktt' },
  { rank: 28, code: 28, shortCode: 'OTT', defaultName: 'Omika Tours and Travels', shareCapital: 90000, slug: 'ott' },
  { rank: 29, code: 29, shortCode: 'KDTT', defaultName: 'Kailash Darshan Tours and Travels', shareCapital: 75000, slug: 'kdtt' },
  { rank: 30, code: 30, shortCode: 'RNTT', defaultName: 'Royal Naumule Tours and Travels', shareCapital: 252000, slug: 'rntt' },
  { rank: 31, code: 31, shortCode: 'SRDTT', defaultName: 'Jai Shriram Darshan Tours and Travels', shareCapital: 30300, slug: 'srdtt' },
  { rank: 32, code: 32, shortCode: 'NHS', defaultName: 'Mahasangh Transport', shareCapital: 140000, slug: 'nhs' },
  { rank: 33, code: 33, shortCode: 'GENG', defaultName: 'Narayan Bhandari Logistics', shareCapital: 35000, slug: 'geng' },
  { rank: 34, code: 34, shortCode: 'FTT', defaultName: 'Vishnu Sharma Travels', shareCapital: 30000, slug: 'ftt' },
  { rank: 35, code: 35, shortCode: 'HBG', defaultName: 'Vishnu Khatri (HBG) Transport', shareCapital: 30000, slug: 'hbg' }
];

const COMPANY_CODES = FIXED_COMPANY_SPECS.map(spec => ({
  rank: spec.rank,
  code: spec.code,
  shortCode: spec.shortCode,
  defaultName: spec.defaultName,
  shareCapital: spec.shareCapital,
  slug: spec.slug
}));

module.exports = {
  ROLES,
  ADMIN_LEVELS,
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
  ROUTE_GROUPS,
  SPOKE_CITIES,
  SPOKE_IDS,
  CITIES,
  normalizeCityId,
  isValidCorridor,
  COMPANY_CODES,
  FIXED_COMPANY_SPECS
};
