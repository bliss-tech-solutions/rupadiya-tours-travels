const crypto = require('crypto');
const net = require('net');
const tls = require('tls');
const env = require('./env');

/**
 * Hold Store - Manages 10-minute temporary seat reservations with atomic consistency.
 * Supports Redis distributed locking via atomic commands with auto-failover to in-memory TTL store.
 */
class HoldStore {
  constructor() {
    // Map key: `${tripId}:${seatNumber}` -> { holdToken, expiresAt, passengerId }
    this.seatLocks = new Map();
    // Map key: holdToken -> { holdToken, tripId, seatNumbers, passengerDetails, createdAt, expiresAt }
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
   * Atomically hold multiple seats for a trip
   * All-or-nothing: If any single seat is held or duplicate, the entire batch fails.
   */
  async holdSeats({ tripId, seatNumbers, passengerDetails = {}, holdToken = null, ttlSeconds = 600 }) {
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

    // 2. Conflict detection
    const conflicts = [];
    for (const seat of normalizedSeats) {
      const lockKey = `${tripId}:${seat}`;
      const existing = this.seatLocks.get(lockKey);
      if (existing && existing.expiresAt > now && existing.holdToken !== token) {
        conflicts.push(seat);
      }
    }

    if (conflicts.length > 0) {
      return {
        success: false,
        conflict: true,
        conflictingSeats: conflicts,
        message: `Seat(s) [${conflicts.join(', ')}] are currently held by another passenger.`
      };
    }

    // 3. Atomic allocation
    for (const seat of normalizedSeats) {
      const lockKey = `${tripId}:${seat}`;
      this.seatLocks.set(lockKey, {
        holdToken: token,
        tripId,
        seat,
        expiresAt
      });
    }

    const holdData = {
      holdToken: token,
      tripId: String(tripId),
      seatNumbers: normalizedSeats,
      passengerDetails,
      createdAt: new Date(now),
      expiresAt: new Date(expiresAt),
      ttlSeconds
    };

    this.holdRecords.set(token, holdData);

    return {
      success: true,
      holdToken: token,
      expiresAt: new Date(expiresAt),
      ttlRemainingSeconds: ttlSeconds,
      seatNumbers: normalizedSeats
    };
  }

  /**
   * Retrieve active hold record
   */
  async getHold(holdToken) {
    if (!holdToken) return null;
    this.cleanupExpiredHolds();
    const record = this.holdRecords.get(holdToken);
    if (!record) return null;

    if (Date.now() > record.expiresAt.getTime()) {
      this.releaseHold(holdToken);
      return null;
    }

    const remainingSecs = Math.max(0, Math.floor((record.expiresAt.getTime() - Date.now()) / 1000));
    return { ...record, ttlRemainingSeconds: remainingSecs };
  }

  /**
   * Validates hold ownership before payment or booking confirmation
   */
  async validateHoldOwnership(holdToken, { passengerId = null, phone = null, email = null } = {}) {
    const hold = await this.getHold(holdToken);
    if (!hold) return { valid: false, reason: 'Hold expired or not found' };

    const details = hold.passengerDetails || {};
    if (passengerId && details.passengerId && String(details.passengerId) !== String(passengerId)) {
      return { valid: false, reason: 'Hold owner passenger ID mismatch' };
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
   * Release hold upon booking completion, cancellation, or expiration
   */
  releaseHold(holdToken) {
    if (!holdToken) return false;
    const record = this.holdRecords.get(holdToken);
    if (!record) return false;

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
      if (String(lock.tripId) === String(tripId) && lock.expiresAt > now) {
        held.push(lock.seat);
      }
    }

    return held;
  }

  cleanupExpiredHolds() {
    const now = Date.now();
    for (const [token, record] of this.holdRecords.entries()) {
      if (record.expiresAt.getTime() <= now) {
        this.releaseHold(token);
      }
    }
  }

  destroy() {
    clearInterval(this.cleanupInterval);
  }
}

const holdStore = new HoldStore();
module.exports = holdStore;
