const { WebSocketServer, WebSocket } = require('ws');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const ACCESS_COOKIE = 'rupadiya_access_token';

function readCookie(header, name) {
  if (!header) return null;
  const match = String(header).split(';').map(p => p.trim()).find(p => p.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function verifyAccessToken(token) {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, env.AUTH_ACCESS_SECRET);
    return { id: String(decoded.id), role: decoded.role, companyCode: decoded.companyCode ?? null };
  } catch {
    return null;
  }
}

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // ws -> Set(rooms)
    this.rooms = new Map();   // roomName -> Set(ws)
    this.pingInterval = null;
  }

  init(httpServer) {
    if (this.wss) return;

    this.wss = new WebSocketServer({ server: httpServer, path: '/ws' });

    console.log('[WebSocketService] WebSocket Server initialized on path /ws');

    this.wss.on('connection', (ws, req) => {
      ws.isAlive = true;
      const clientRooms = new Set();
      this.clients.set(ws, clientRooms);

      // Identify the user from the httpOnly access cookie (if the browser sent it).
      ws.user = verifyAccessToken(readCookie(req.headers.cookie, ACCESS_COOKIE));
      ws.queue = Promise.resolve();

      try {
        const url = new URL(req.url, 'http://localhost');
        const queryRoom = url.searchParams.get('room');
        if (queryRoom && this.canJoin(ws, queryRoom)) this.joinRoom(ws, queryRoom);
        const queryCompany = url.searchParams.get('companyCode');
        if (queryCompany && this.canJoin(ws, `company:${queryCompany}`)) this.joinRoom(ws, `company:${queryCompany}`);
      } catch (e) {}

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (raw) => {
        if (raw.length > 4096) return; // ignore oversized frames
        let msg;
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          return;
        }
        // Process sequentially so an 'auth' message is applied before the 'subscribe' that follows it.
        ws.queue = ws.queue.then(() => this.handleMessage(ws, msg)).catch(() => {});
      });

      ws.on('close', () => {
        this.cleanupClient(ws);
      });

      ws.on('error', () => {
        this.cleanupClient(ws);
      });

      // Welcome handshake
      ws.send(JSON.stringify({
        event: 'connected',
        message: 'Rupadiya Realtime WebSocket Connected',
        timestamp: Date.now()
      }));
    });

    // Keep-alive heartbeat ping every 30s
    this.pingInterval = setInterval(() => {
      if (!this.wss) return;
      this.wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
          this.cleanupClient(ws);
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  handleMessage(ws, msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.action === 'ping') {
      ws.send(JSON.stringify({ event: 'pong', timestamp: Date.now() }));
    } else if (msg.action === 'auth') {
      ws.user = verifyAccessToken(msg.token);
      ws.send(JSON.stringify({ event: ws.user ? 'authenticated' : 'auth_failed' }));
    } else if (msg.action === 'subscribe' && typeof msg.room === 'string') {
      if (!this.canJoin(ws, msg.room)) {
        ws.send(JSON.stringify({ event: 'subscribe_denied', room: msg.room }));
        return;
      }
      this.joinRoom(ws, msg.room);
      ws.send(JSON.stringify({ event: 'subscribed', room: msg.room }));
    } else if (msg.action === 'unsubscribe' && typeof msg.room === 'string') {
      this.leaveRoom(ws, msg.room);
      ws.send(JSON.stringify({ event: 'unsubscribed', room: msg.room }));
    }
  }

  /**
   * Room authorisation:
   *  - trip:<id>     public seat-availability channel (no personal data)
   *  - agent:<id>    that agent only
   *  - user:<id>     that user only
   *  - company:<n>   owner of company n, or super admin
   *  - admin:all     super admin only
   */
  canJoin(ws, room) {
    if (typeof room !== 'string' || room.length > 80) return false;
    const [kind, id] = room.split(':');
    if (kind === 'trip') return /^[a-f0-9]{24}$/i.test(id || '');
    const u = ws.user;
    if (!u) return false;
    if (u.role === 'SUPER_ADMIN') return true;
    if (kind === 'agent' || kind === 'user') return id === u.id;
    if (kind === 'company') return u.role === 'COMPANY_OWNER' && String(u.companyCode) === String(id);
    return false;
  }

  joinRoom(ws, room) {
    if (!room) return;
    const clientRooms = this.clients.get(ws);
    if (clientRooms) clientRooms.add(room);

    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    this.rooms.get(room).add(ws);
  }

  leaveRoom(ws, room) {
    const clientRooms = this.clients.get(ws);
    if (clientRooms) clientRooms.delete(room);

    const roomSet = this.rooms.get(room);
    if (roomSet) {
      roomSet.delete(ws);
      if (roomSet.size === 0) this.rooms.delete(room);
    }
  }

  cleanupClient(ws) {
    const clientRooms = this.clients.get(ws);
    if (clientRooms) {
      clientRooms.forEach((room) => {
        const roomSet = this.rooms.get(room);
        if (roomSet) {
          roomSet.delete(ws);
          if (roomSet.size === 0) this.rooms.delete(room);
        }
      });
    }
    this.clients.delete(ws);
  }

  broadcast(room, event, data) {
    const payload = JSON.stringify({ event, room, data, timestamp: Date.now() });
    const subscribers = this.rooms.get(room);
    if (subscribers && subscribers.size > 0) {
      subscribers.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
        }
      });
    }
  }

  broadcastToAll(event, data) {
    if (!this.wss) return;
    const payload = JSON.stringify({ event, data, timestamp: Date.now() });
    this.wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    });
  }

  /**
   * High-level broadcast for a confirmed booking
   */
  broadcastBookingConfirmed(booking, trip) {
    const tripId = (booking.tripId?._id || booking.tripId || trip?._id)?.toString();
    const companyCode = booking.companyCode || trip?.companyCode;
    const seatNumbers = booking.seatNumbers || [];

    const bookingPayload = {
      bookingId: booking.bookingId,
      pnr: booking.pnr,
      tripId,
      companyCode,
      seatNumbers,
      seatCount: seatNumbers.length,
      totalPayable: booking.fareBreakdown?.totalPayable,
      contactPhone: booking.contactDetails?.phone,
      passengerName: booking.passengers?.[0]?.name || 'Traveler',
      bookedAt: booking.createdAt || new Date()
    };

    // 1. Broadcast to trip room and all connected clients so seat map updates for all viewers
    if (tripId) {
      const bookedData = {
        tripId: String(tripId),
        seatNumbers,
        bookingId: booking.bookingId
      };
      this.broadcast(`trip:${tripId}`, 'SEATS_BOOKED', bookedData);
    }

    // 2. Broadcast to company room for company owner notification
    if (companyCode) {
      this.broadcast(`company:${companyCode}`, 'NEW_BOOKING_NOTIFICATION', bookingPayload);
    }

    // 3. Broadcast to super admins
    this.broadcast('admin:all', 'NEW_BOOKING_NOTIFICATION', bookingPayload);

    // 4. Broadcast to user private room
    if (booking.passengerId) {
      this.broadcast(`user:${booking.passengerId}`, 'BOOKING_CONFIRMED', bookingPayload);
    }
  }

  /**
   * Broadcast seat hold lock
   */
  broadcastSeatHeld(tripId, seatNumbers, expiresAt, clientRef = null) {
    const payload = {
      tripId: String(tripId),
      seatNumbers: (seatNumbers || []).map(s => String(s).trim()),
      expiresAt,
      // Opaque random id generated by the browser that created the hold, so that
      // browser can recognise its own hold and never warn "taken by another customer".
      clientRef: clientRef ? String(clientRef).slice(0, 64) : null
    };
    this.broadcast(`trip:${tripId}`, 'SEATS_HELD', payload);
  }

  /**
   * Broadcast seat hold release
   */
  broadcastSeatReleased(tripId, seatNumbers) {
    const payload = {
      tripId: String(tripId),
      seatNumbers: (seatNumbers || []).map(s => String(s).trim())
    };
    this.broadcast(`trip:${tripId}`, 'SEATS_RELEASED', payload);
  }

  /**
   * Send an event to one user's private rooms (agents listen on agent:<id>, others on user:<id>).
   */
  broadcastUser(userId, event, data) {
    if (!userId) return;
    this.broadcast(`agent:${userId}`, event, data);
    this.broadcast(`user:${userId}`, event, data);
  }

  /**
   * Broadcast commission credit to agent
   */
  broadcastCommissionEarned(agentId, data) {
    this.broadcast(`agent:${agentId}`, 'COMMISSION_EARNED', data);
  }

  /**
   * Broadcast seat fare pricing updates to active passengers & agents
   */
  broadcastSeatFaresUpdated(tripId, seatFares, minFare) {
    const payload = {
      tripId: String(tripId),
      seatFares,
      minFare,
      updatedAt: new Date().toISOString()
    };
    this.broadcast(`trip:${tripId}`, 'SEAT_FARES_UPDATED', payload);
  }
}

module.exports = new WebSocketService();

