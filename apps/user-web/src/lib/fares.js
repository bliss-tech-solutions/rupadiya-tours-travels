/**
 * Helper utilities for per-seat pricing and quote breakdowns
 */

export function seatFareList(selectedSeats = [], tripSeats = [], defaultBaseFare = 0) {
  if (!Array.isArray(selectedSeats)) return [];

  const seatMap = new Map();
  if (Array.isArray(tripSeats)) {
    for (const s of tripSeats) {
      if (s?.seatNumber) {
        seatMap.set(String(s.seatNumber).trim().toLowerCase(), Number(s.fare) || Number(defaultBaseFare) || 0);
      }
    }
  }

  return selectedSeats.map((seatNum) => {
    const code = String(seatNum).trim();
    const lc = code.toLowerCase();
    const fare = seatMap.has(lc) ? seatMap.get(lc) : (Number(defaultBaseFare) || 0);
    return {
      seatNumber: code,
      fare
    };
  });
}

export function sumFares(seatFares = []) {
  if (!Array.isArray(seatFares)) return 0;
  return seatFares.reduce((sum, item) => {
    if (typeof item === 'number') return sum + item;
    return sum + (Number(item?.fare) || 0);
  }, 0);
}

export function fareLineLabel(seatFares = []) {
  if (!Array.isArray(seatFares) || seatFares.length === 0) {
    return 'Base Fare';
  }

  const fares = seatFares.map(s => (typeof s === 'number' ? s : Number(s?.fare) || 0));
  const count = fares.length;
  const firstFare = fares[0];
  const allEqual = fares.every(f => f === firstFare);

  if (allEqual) {
    return `Seat fares (${count} × ₹${firstFare.toLocaleString('en-IN')})`;
  }

  return `Seat fares (${count} seats)`;
}
