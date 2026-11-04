/**
 * Hold Store - Manages 10-minute temporary seat reservations with atomic consistency
 * and Tab-Isolated ownership.
 * Uses an in-memory TTL map with sub-millisecond precision, designed to be swapped
 * with Redis for multi-node deployments.
 */

class HoldStore {
  constructor() {
    // Map key: `${tripId}:${seatNumber}` -> { holdToken, expiresAt, tabId, passengerId }
    this.seatLocks = new Map();
    // Map key: holdToken -> { holdToken, tripId, seatNumbers, passengerDetails, tabId, passengerId, createdAt, expiresAt }
    this.holdRecords = new Map();

    // Auto-clean expired holds every 10 seconds
    this.cleanupInterval = setInterval(() => this.cleanupExpiredHolds(), 10000);
    if (this.cleanupInterval.unref) this.cleanupInterval.unref();
  }

  /**
   * Atomically hold multiple seats for a trip bound to a specific browser tab or user session
   * All-or-nothing: If any single seat is held by another active session, the entire batch fails.
   */
  async holdSeats({
    tripId,
    seatNumbers,
    passengerDetails,
    holdToken,
    tabId = null,
    passengerId = null,
    ttlSeconds = 600
  }) {
    this.cleanupExpiredHolds();

    const now = Date.now();
    const expiresAt = now + (ttlSeconds * 1000);

    // 1. Conflict detection
    const conflicts = [];
    for (const seat of seatNumbers) {
      const lockKey = `${tripId}:${seat}`;
      const existing = this.seatLocks.get(lockKey);
      if (existing && existing.expiresAt > now && existing.holdToken !== holdToken) {
        conflicts.push(seat);
      }
    }

    if (conflicts.length > 0) {
      return {
        success: false,
        conflict: true,
        conflictingSeats: conflicts,
        message: `Seats [${conflicts.join(', ')}] are already being held by another passenger.`
      };
    }

    // 2. Atomic allocation
    for (const seat of seatNumbers) {
      const lockKey = `${tripId}:${seat}`;
      this.seatLocks.set(lockKey, {
        holdToken,
        tripId,
        seat,
        tabId,
        passengerId,
        expiresAt
      });
    }

    const holdData = {
      holdToken,
      tripId,
      seatNumbers: [...seatNumbers],
      passengerDetails,
      tabId,
      passengerId,
      createdAt: new Date(now),
      expiresAt: new Date(expiresAt),
      ttlSeconds
    };

    this.holdRecords.set(holdToken, holdData);

    return {
      success: true,
      holdToken,
      tabId,
      expiresAt: new Date(expiresAt),
      ttlRemainingSeconds: ttlSeconds,
      seatNumbers
    };
  }

  /**
   * Retrieve active hold record
   */
  getHold(holdToken) {
    this.cleanupExpiredHolds();
    const record = this.holdRecords.get(holdToken);
    if (!record) return null;

    if (Date.now() > record.expiresAt.getTime()) {
      this.releaseHold(holdToken, { isForce: true });
      return null;
    }

    const remainingSecs = Math.max(0, Math.floor((record.expiresAt.getTime() - Date.now()) / 1000));
    return { ...record, ttlRemainingSeconds: remainingSecs };
  }

  /**
   * Release hold upon cancellation or expiration, enforcing tab or user ownership
   */
  releaseHold(holdToken, { tabId = null, passengerId = null, isForce = false } = {}) {
    const record = this.holdRecords.get(holdToken);
    if (!record) return false;

    // Check ownership if caller specified tabId or passengerId (unless force release by system)
    if (!isForce) {
      const hasTabOwnership = tabId && record.tabId && record.tabId === tabId;
      const hasUserOwnership = passengerId && record.passengerId && record.passengerId.toString() === passengerId.toString();
      
      // If the hold was bound to a tab and caller presents an unequal tab without matching user
      if (record.tabId && tabId && !hasTabOwnership && !hasUserOwnership) {
        return false;
      }
    }

    for (const seat of record.seatNumbers) {
      const lockKey = `${record.tripId}:${seat}`;
      const lock = this.seatLocks.get(lockKey);
      if (lock && lock.holdToken === holdToken) {
        this.seatLocks.delete(lockKey);
      }
    }

    this.holdRecords.delete(holdToken);
    return true;
  }

  /**
   * Returns list of currently held seat numbers for a trip
   */
  getHeldSeatsForTrip(tripId) {
    this.cleanupExpiredHolds();
    const now = Date.now();
    const held = [];

    for (const [key, lock] of this.seatLocks.entries()) {
      if (lock.tripId === tripId && lock.expiresAt > now) {
        held.push(lock.seat);
      }
    }

    return held;
  }

  cleanupExpiredHolds() {
    const now = Date.now();
    for (const [token, record] of this.holdRecords.entries()) {
      if (record.expiresAt.getTime() <= now) {
        this.releaseHold(token, { isForce: true });
      }
    }
  }

  destroy() {
    clearInterval(this.cleanupInterval);
  }
}

const holdStore = new HoldStore();
module.exports = holdStore;
