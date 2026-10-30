const { WebSocketServer, WebSocket } = require('ws');

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

      // Support query parameter initial room (e.g. /ws?room=trip:123&company=1)
      try {
        const url = new URL(req.url, 'http://localhost');
        const queryRoom = url.searchParams.get('room');
        if (queryRoom) this.joinRoom(ws, queryRoom);
        const queryCompany = url.searchParams.get('companyCode');
        if (queryCompany) this.joinRoom(ws, `company:${queryCompany}`);
      } catch (e) {}

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.action === 'ping') {
            ws.send(JSON.stringify({ event: 'pong', timestamp: Date.now() }));
          } else if (msg.action === 'subscribe' && msg.room) {
            this.joinRoom(ws, msg.room);
            ws.send(JSON.stringify({ event: 'subscribed', room: msg.room }));
          } else if (msg.action === 'unsubscribe' && msg.room) {
            this.leaveRoom(ws, msg.room);
            ws.send(JSON.stringify({ event: 'unsubscribed', room: msg.room }));
          }
        } catch (err) {
          // Ignore malformed messages
        }
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

    // 1. Broadcast to trip room so seat map updates for all viewers
    if (tripId) {
      this.broadcast(`trip:${tripId}`, 'SEATS_BOOKED', {
        tripId,
        seatNumbers,
        bookingId: booking.bookingId
      });
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
  broadcastSeatHeld(tripId, seatNumbers, expiresAt) {
    this.broadcast(`trip:${tripId}`, 'SEATS_HELD', {
      tripId,
      seatNumbers,
      expiresAt
    });
  }

  /**
   * Broadcast seat hold release
   */
  broadcastSeatReleased(tripId, seatNumbers) {
    this.broadcast(`trip:${tripId}`, 'SEATS_RELEASED', {
      tripId,
      seatNumbers
    });
  }

  /**
   * Broadcast commission credit to agent
   */
  broadcastCommissionEarned(agentId, data) {
    this.broadcast(`agent:${agentId}`, 'COMMISSION_EARNED', data);
  }
}

module.exports = new WebSocketService();

