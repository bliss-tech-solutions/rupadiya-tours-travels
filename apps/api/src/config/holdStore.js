const crypto = require('crypto');
const net = require('net');
const tls = require('tls');
const env = require('./env');

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

    // Auto-clean expired holds every 5 seconds
    this.cleanupInterval = setInterval(() => this.cleanupExpiredHolds(), 5000);
    if (this.cleanupInterval.unref) this.cleanupInterval.unref();
  }

  /**
   * Generates a cryptographically strong, unguessable 48-character token
   */
  generateToken() {
    return crypto.randomBytes(24).toString('hex');
  }

  /**
   * Atomically hold multiple seats for a trip bound to a specific browser tab or user session.
   * All-or-nothing: If any single seat is held by another active session, the entire batch fails.
   */
  async holdSeats({
    tripId,
    seatNumbers,
    passengerDetails = {},
    holdToken = null,
    tabId = null,
    passengerId = null,
    ttlSeconds = 600
  }) {
    this.cleanupExpiredHolds();

    if (!tripId) {
      return { success: false, message: 'Trip ID is required for seat hold.' };
    }

    if (!seatNumbers || !Array.isArray(seatNumbers) || seatNumbers.length === 0) {
      return { success: false, message: 'At least one seat must be selected.' };
    }

    // 1. Reject duplicate seat numbers in single request
    const normalizedSeats = seatNumbers.map(s => String(s).trim());
    const uniqueSeats = new Set(normalizedSeats);
    if (uniqueSeats.size !== normalizedSeats.length) {
      return {
        success: false,
        conflict: true,
        message: 'Duplicate seat numbers detected in the same hold request.'
      };
    }

    const token = holdToken || this.generateToken();
    const now = Date.now();
    const expiresAt = now + (ttlSeconds * 1000);

    // 2. Pre-check conflict for all requested seats
    const conflicts = [];
    for (const seat of normalizedSeats) {
      const lockKey = `${tripId}:${seat}`;
      const existing = this.seatLocks.get(lockKey);
      if (existing) {
        if (existing.expiresAt > now && existing.holdToken !== token) {
          conflicts.push(seat);
        }
      }
    }

    if (conflicts.length > 0) {
      return {
        success: false,
        conflict: true,
        message: `Seats [${conflicts.join(', ')}] are already held by another user.`,
        conflictedSeats: conflicts,
        conflictingSeats: conflicts
      };
    }

    // 3. Atomic allocation
    for (const seat of normalizedSeats) {
      const lockKey = `${tripId}:${seat}`;
      this.seatLocks.set(lockKey, {
        holdToken: token,
        tripId,
        seat,
        tabId,
        passengerId,
        expiresAt
      });
    }

    const holdData = {
      holdToken: token,
      tripId: String(tripId),
      seatNumbers: normalizedSeats,
      passengerDetails,
      tabId,
      passengerId,
      createdAt: new Date(now),
      expiresAt: new Date(expiresAt),
      ttlSeconds
    };

    this.holdRecords.set(token, holdData);

    return {
      success: true,
      holdToken: token,
      tabId,
      expiresAt: new Date(expiresAt),
      ttlRemainingSeconds: ttlSeconds,
      seatNumbers: normalizedSeats
    };
  }

  /**
   * Retrieves active hold record by token (Synchronous in-memory lookup)
   */
  getHold(holdToken) {
    if (!holdToken) return null;
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
   * Validates hold ownership before payment or booking confirmation
   */
  async validateHoldOwnership(holdToken, { passengerId = null, phone = null, email = null, tabId = null } = {}) {
    const hold = await this.getHold(holdToken);
    if (!hold) return { valid: false, reason: 'Hold expired or not found' };

    const details = hold.passengerDetails || {};
    if (passengerId && (details.passengerId || hold.passengerId)) {
      const storedId = String(details.passengerId || hold.passengerId);
      if (storedId !== String(passengerId)) {
        return { valid: false, reason: 'Hold owner passenger ID mismatch' };
      }
    }

    if (tabId && hold.tabId && hold.tabId !== tabId) {
      if (!passengerId || String(hold.passengerId) !== String(passengerId)) {
        return { valid: false, reason: 'Hold belongs to another browser tab' };
      }
    }

    if (phone && details.phone) {
      const clean1 = String(phone).replace(/\D/g, '').slice(-10);
      const clean2 = String(details.phone).replace(/\D/g, '').slice(-10);
      if (clean1 && clean2 && clean1 !== clean2) {
        return { valid: false, reason: 'Hold contact phone mismatch' };
      }
    }

    return { valid: true, hold };
  }

  /**
   * Release hold upon booking completion, cancellation, or expiration, enforcing tab or user ownership
   */
  releaseHold(holdToken, options = {}) {
    if (!holdToken) return false;
    const isForce = typeof options === 'boolean' ? options : Boolean(options.isForce);
    const tabId = typeof options === 'object' && options ? options.tabId : null;
    const passengerId = typeof options === 'object' && options ? options.passengerId : null;

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
    if (!tripId) return [];
    this.cleanupExpiredHolds();
    const now = Date.now();
    const held = [];
    const targetTrip = String(tripId).trim();

    for (const [key, lock] of this.seatLocks.entries()) {
      if (String(lock.tripId).trim() === targetTrip && lock.expiresAt > now) {
        held.push(String(lock.seat).trim());
      }
    }

    return Array.from(new Set(held));
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
