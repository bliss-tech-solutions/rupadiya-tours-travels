export const HUB_CITY = { id: 'rupadiya', name: 'Rupadiya', state: 'Uttar Pradesh' };

export const SPOKE_CITIES = [
  { id: 'ahmedabad', name: 'Ahmedabad', state: 'Gujarat', baseFare: 1650, duration: '21h' },
  { id: 'vadodara', name: 'Vadodara', state: 'Gujarat', baseFare: 1550, duration: '20h' },
  { id: 'surat', name: 'Surat', state: 'Gujarat', baseFare: 1750, duration: '22h 30m' },
  { id: 'bangalore', name: 'Bengaluru', state: 'Karnataka', baseFare: 2400, duration: '32h' },
  { id: 'hyderabad', name: 'Hyderabad', state: 'Telangana', baseFare: 2100, duration: '28h' },
  { id: 'mumbai', name: 'Mumbai', state: 'Maharashtra', baseFare: 1950, duration: '25h' },
];

export const ALL_CITIES = [HUB_CITY, ...SPOKE_CITIES];

// Get allowed destination cities based on origin
export function getAllowedDestinations(fromId) {
  if (fromId === 'rupadiya') {
    return SPOKE_CITIES;
  }
  // If origin is any spoke, destination MUST be Rupadiya
  return [HUB_CITY];
}

// Get allowed origins based on destination
export function getAllowedOrigins(toId) {
  if (toId === 'rupadiya') {
    return SPOKE_CITIES;
  }
  return [HUB_CITY];
}

// Helper to check if corridor is valid
export function isValidCorridor(fromId, toId) {
  if (!fromId || !toId || fromId === toId) return false;
  return (fromId === 'rupadiya' && SPOKE_CITIES.some(s => s.id === toId)) ||
         (toId === 'rupadiya' && SPOKE_CITIES.some(s => s.id === fromId));
}

