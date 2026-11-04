export const HUB_CITY = { id: 'rupadiya', name: 'Rupadiya', state: 'Uttar Pradesh' };

export const ROUTE_GROUPS = [
  {
    id: 'route-1-gujarat',
    name: 'Route 1 - Gujarat',
    cities: [
      { id: 'himatnagar', name: 'Himatnagar', state: 'Gujarat', baseFare: 1500, duration: '20h', distanceKm: 1150 },
      { id: 'ahmedabad', name: 'Ahmedabad', state: 'Gujarat', baseFare: 1650, duration: '21h', distanceKm: 1250 },
      { id: 'baroda', name: 'Baroda', alias: ['vadodara'], state: 'Gujarat', baseFare: 1550, duration: '20h', distanceKm: 1180 },
      { id: 'ankleshwar', name: 'Ankleshwar', state: 'Gujarat', baseFare: 1650, duration: '21h 30m', distanceKm: 1260 },
      { id: 'surat', name: 'Surat', state: 'Gujarat', baseFare: 1750, duration: '22h 30m', distanceKm: 1320 },
      { id: 'vapi', name: 'Vapi', state: 'Gujarat', baseFare: 1850, duration: '24h', distanceKm: 1420 }
    ]
  },
  {
    id: 'route-2-saurashtra',
    name: 'Route 2 - Saurashtra',
    cities: [
      { id: 'ambli-bopal', name: 'Ambli Bopal', alias: ['ambli bopal', 'bopal'], state: 'Gujarat', baseFare: 1680, duration: '21h 15m', distanceKm: 1255 },
      { id: 'chotila', name: 'Chotila', state: 'Gujarat', baseFare: 1800, duration: '23h', distanceKm: 1380 },
      { id: 'rajkot', name: 'Rajkot', state: 'Gujarat', baseFare: 1900, duration: '24h 30m', distanceKm: 1440 },
      { id: 'jamnagar', name: 'Jamnagar', state: 'Gujarat', baseFare: 2050, duration: '26h', distanceKm: 1520 }
    ]
  },
  {
    id: 'route-3-south',
    name: 'Route 3 - South',
    cities: [
      { id: 'hyderabad', name: 'Hyderabad', state: 'Telangana', baseFare: 2150, duration: '28h', distanceKm: 1450 },
      { id: 'bangalore', name: 'Bangalore', alias: ['bengaluru'], state: 'Karnataka', baseFare: 2400, duration: '32h', distanceKm: 1820 }
    ]
  },
  {
    id: 'route-4-maharashtra-goa',
    name: 'Route 4 - Maharashtra / Goa',
    cities: [
      { id: 'nashik', name: 'Nashik', state: 'Maharashtra', baseFare: 1800, duration: '22h', distanceKm: 1280 },
      { id: 'mumbai', name: 'Mumbai', alias: ['bombay'], state: 'Maharashtra', baseFare: 1950, duration: '25h', distanceKm: 1420 },
      { id: 'pune', name: 'Pune', state: 'Maharashtra', baseFare: 2050, duration: '26h 30m', distanceKm: 1500 },
      { id: 'goa', name: 'Goa', alias: ['panaji'], state: 'Goa', baseFare: 2500, duration: '33h', distanceKm: 1890 }
    ]
  }
];

export const SPOKE_CITIES = ROUTE_GROUPS.flatMap(g => g.cities.map(c => ({
  ...c,
  routeGroupId: g.id,
  routeName: g.name
})));

export const ALL_CITIES = [HUB_CITY, ...SPOKE_CITIES];

// Normalize city identifiers for lookup
export function normalizeCityId(input) {
  if (!input) return '';
  const lower = input.toString().trim().toLowerCase().replace(/[()]/g, '').trim();
  if (lower === 'rupadiya' || lower.includes('rupadiya')) return 'rupadiya';
  if (lower === 'baroda' || lower === 'vadodara') return 'baroda';
  if (lower === 'ambli bopal' || lower === 'ambli-bopal' || lower === 'bopal') return 'ambli-bopal';
  if (lower === 'bangalore' || lower === 'bengaluru') return 'bangalore';
  if (lower === 'mumbai' || lower === 'bombay') return 'mumbai';
  return lower;
}

// Get allowed destination cities based on origin
export function getAllowedDestinations(fromId) {
  const norm = normalizeCityId(fromId);
  if (norm === 'rupadiya') {
    return SPOKE_CITIES;
  }
  // If origin is any spoke, destination MUST be Rupadiya
  return [HUB_CITY];
}

// Get allowed origins based on destination
export function getAllowedOrigins(toId) {
  const norm = normalizeCityId(toId);
  if (norm === 'rupadiya') {
    return SPOKE_CITIES;
  }
  return [HUB_CITY];
}

// Helper to check if corridor is valid
export function isValidCorridor(fromId, toId) {
  if (!fromId || !toId) return false;
  const f = normalizeCityId(fromId);
  const t = normalizeCityId(toId);
  if (f === t) return false;
  return (f === 'rupadiya' && SPOKE_CITIES.some(s => s.id === t || s.alias?.includes(t))) ||
         (t === 'rupadiya' && SPOKE_CITIES.some(s => s.id === f || s.alias?.includes(f)));
}
