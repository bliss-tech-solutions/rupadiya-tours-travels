const QRCode = require('qrcode');
const { WhatsappAuth, NotificationJob } = require('../../modules/notifications/models');
const { toInternational } = require('../../utils/phone');

/**
 * WhatsApp sender for Rupadiya Bus Samiti's business number via Baileys (WhatsApp Web protocol).
 *
 *  - Only super admins can connect / disconnect it (QR scan from the admin portal).
 *  - Auth state lives in MongoDB (collection `whatsapp_auth`), so restarts / redeploys keep the session.
 *  - QR codes and status changes are pushed only to the `admin:all` WebSocket room.
 *  - Delivery receipts (delivered / read) are written back to the NotificationJob that sent the message.
 *
 * NOTE: Baileys is an unofficial client. Keep volumes low (the sender throttles) and use
 * non-spammy templates; the provider can later be swapped for the official WhatsApp Cloud API.
 */

// Quiet logger for Baileys that still prints real errors to the API console (prefixed [WhatsApp]).
const errText = (obj, msg) => {
  if (typeof obj === 'string') return obj;
  const e = obj?.err || obj?.error || obj;
  return [msg, e?.message || (typeof e === 'object' ? '' : e)].filter(Boolean).join(' — ');
};
const silentLogger = {
  level: 'error',
  child() { return silentLogger; },
  trace() {}, debug() {}, info() {}, warn() {},
  error(obj, msg) { console.warn('[WhatsApp]', errText(obj, msg)); },
  fatal(obj, msg) { console.error('[WhatsApp] FATAL', errText(obj, msg)); }
};
const log = (...args) => console.log('[WhatsApp]', ...args);

// Phone that the RBS number runs on (creds.platform from WhatsApp at pairing time).
const PHONE_PLATFORM = {
  android: 'Android phone',
  iphone: 'iPhone',
  ios: 'iPhone',
  smba: 'WhatsApp Business · Android',
  smbi: 'WhatsApp Business · iPhone',
  web: 'WhatsApp Web',
  windows: 'Windows desktop',
  macos: 'Mac desktop',
  kaios: 'KaiOS phone'
};
const LINKED_AS = { os: 'Ubuntu', browser: 'Rupadiya Bus Samiti' };

// Baileys close codes we treat specially (DisconnectReason).
const CODE = { LOGGED_OUT: 401, CONNECTION_REPLACED: 440, RESTART_REQUIRED: 515, TIMED_OUT: 408, BAD_SESSION: 500 };

// WebMessageInfo.Status: 2 = server ack, 3 = delivered to phone, 4 = read, 5 = played
const ACK = { SERVER: 2, DELIVERED: 3, READ: 4, PLAYED: 5 };

// India numbers are stored as 10 digits, Nepal numbers as 977 + 10 digits (see utils/phone.js).
function toJid(phone) {
  const intl = toInternational(phone);
  return intl ? `${intl}@s.whatsapp.net` : null;
}

const REASON_TEXT = {
  [CODE.LOGGED_OUT]: 'WhatsApp was logged out from the phone. Scan a new QR to reconnect.',
  [CODE.CONNECTION_REPLACED]: 'This WhatsApp session was opened somewhere else (another server or WhatsApp Web). Click Reconnect to take it back.',
  [CODE.TIMED_OUT]: 'The QR code expired before it was scanned. Click "Show QR" to get a new one.',
  [CODE.BAD_SESSION]: 'The saved session is corrupted. Unlink and scan a new QR.'
};

class BaileysProvider {
  constructor() {
    this.sock = null;
    this.status = 'DISCONNECTED';   // DISCONNECTED | CONNECTING | QR | CONNECTED | LOGGED_OUT
    this.qrDataUrl = null;
    this.qrAt = null;
    this.qrCount = 0;
    this.me = null;
    this.name = null;
    this.connectedAt = null;
    this.lastDisconnectAt = null;
    this.lastDisconnectReason = null;
    this.lastError = null;
    this.wantConnected = false;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.connecting = null;          // in-flight connect() promise (prevents duplicate sockets)
    this.onWhatsAppCache = new Map();
    this.lib = null;
    this.auth = null;                // in-memory auth state, reused across reconnects (see _open)
    this.writeChain = Promise.resolve();
    this.device = null;              // { platform, deviceId, lid, linkedAt }
  }

  deviceInfo() {
    if (!this.device) return null;
    const platform = String(this.device.platform || '').toLowerCase();
    return {
      phone: PHONE_PLATFORM[platform] || (platform ? platform : 'Unknown phone'),
      platform: platform || null,
      deviceId: this.device.deviceId ?? null,
      lid: this.device.lid || null,
      linkedAt: this.device.linkedAt || null,
      shownOnPhoneAs: `${LINKED_AS.browser} (${LINKED_AS.os})`
    };
  }

  /** Read the linked device details from the saved credentials. */
  deviceFromCreds(creds, linkedAt) {
    if (!creds?.me?.id) return null;
    const deviceMatch = /:(\d+)@/.exec(String(creds.me.id));
    return {
      platform: creds.platform || null,
      deviceId: deviceMatch ? Number(deviceMatch[1]) : null,
      lid: creds.me.lid || null,
      linkedAt: linkedAt || this.device?.linkedAt || null
    };
  }

  async loadLib() {
    if (!this.lib) this.lib = await import('@whiskeysockets/baileys');
    return this.lib;
  }

  broadcast(event, data = {}) {
    try {
      require('../../services/websocket.service').broadcast('admin:all', event, data);
    } catch (e) { /* realtime best-effort */ }
  }

  publicStatus() {
    return {
      status: this.status,
      connectedNumber: this.me ? String(this.me).split(':')[0].split('@')[0] : null,
      name: this.name,
      connectedAt: this.connectedAt,
      qr: this.status === 'QR' ? this.qrDataUrl : null,
      qrAt: this.status === 'QR' ? this.qrAt : null,
      lastDisconnectAt: this.lastDisconnectAt,
      lastDisconnectReason: this.lastDisconnectReason,
      reconnectAttempts: this.reconnectAttempts,
      autoReconnect: this.wantConnected,
      device: this.deviceInfo(),
      lastError: this.lastError
    };
  }

  setStatus(status, extra = {}) {
    this.status = status;
    Object.assign(this, extra);
    this.broadcast('WHATSAPP_STATUS', this.publicStatus());
  }

  isReady() {
    return this.status === 'CONNECTED' && Boolean(this.sock);
  }

  async hasSavedSession() {
    const [doc, meta] = await Promise.all([WhatsappAuth.findById('creds').lean(), WhatsappAuth.findById('meta').lean()]);
    if (!doc) return false;
    try {
      // A session only counts once the phone actually linked (creds.me is set after the scan).
      const creds = JSON.parse(doc.value);
      if (!creds?.me?.id) return false;
      if (!this.device) {
        const linkedAt = meta ? JSON.parse(meta.value)?.linkedAt : null;
        this.device = this.deviceFromCreds(creds, linkedAt);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  /** Remember when the phone was linked (kept with the session; cleared on unlink). */
  async saveMeta(meta) {
    await WhatsappAuth.updateOne({ _id: 'meta' }, { $set: { value: JSON.stringify(meta) } }, { upsert: true }).catch(() => {});
  }

  /** Wait until every queued auth-state write has reached MongoDB. */
  async flushAuth() {
    try { await this.writeChain; } catch (e) { /* individual writes already logged */ }
  }

  /** MongoDB-backed equivalent of Baileys' useMultiFileAuthState. */
  async useMongoAuthState() {
    const { initAuthCreds, BufferJSON, proto } = await this.loadLib();
    const read = async (id) => {
      const doc = await WhatsappAuth.findById(id).lean();
      return doc ? JSON.parse(doc.value, BufferJSON.reviver) : null;
    };
    // Writes are chained so they reach MongoDB in order, and so a reconnect can wait for them.
    const enqueue = (op) => {
      this.writeChain = this.writeChain.then(op).catch((e) => console.warn('[WhatsApp] auth save failed —', e.message));
      return this.writeChain;
    };
    const write = (id, data) => {
      const value = JSON.stringify(data, BufferJSON.replacer); // snapshot now, not when the write runs
      return enqueue(() => WhatsappAuth.updateOne({ _id: id }, { $set: { value } }, { upsert: true }));
    };
    const remove = (id) => enqueue(() => WhatsappAuth.deleteOne({ _id: id }));

    const creds = (await read('creds')) || initAuthCreds();
    return {
      state: {
        creds,
        keys: {
          get: async (type, ids) => {
            const out = {};
            await Promise.all(ids.map(async (id) => {
              let value = await read(`${type}-${id}`);
              if (type === 'app-state-sync-key' && value) value = proto.Message.AppStateSyncKeyData.fromObject(value);
              out[id] = value;
            }));
            return out;
          },
          set: async (data) => {
            const tasks = [];
            for (const category of Object.keys(data)) {
              for (const id of Object.keys(data[category])) {
                const value = data[category][id];
                const key = `${category}-${id}`;
                tasks.push(value ? write(key, value) : remove(key));
              }
            }
            await Promise.all(tasks);
          }
        }
      },
      saveCreds: () => write('creds', creds)
    };
  }

  /** Record a delivery receipt on the message that was sent. Never throws. */
  async recordReceipt(messageId, ack) {
    if (!messageId || !ack || ack < ACK.DELIVERED) return;
    const now = new Date();
    try {
      if (ack >= ACK.READ) {
        await NotificationJob.updateOne({ waMessageId: messageId, readAt: null }, { $set: { readAt: now } });
      }
      await NotificationJob.updateOne({ waMessageId: messageId, deliveredAt: null }, { $set: { deliveredAt: now } });
    } catch (e) { /* receipts are best-effort */ }
  }

  scheduleReconnect(delayMs) {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((e) => { this.lastError = e.message; });
    }, delayMs);
    if (this.reconnectTimer.unref) this.reconnectTimer.unref();
  }

  /** Start (or resume) the session. Emits a QR for the admin to scan when not yet linked. */
  async connect() {
    this.wantConnected = true;
    if (this.sock && ['CONNECTING', 'QR', 'CONNECTED'].includes(this.status)) return this.publicStatus();
    if (this.connecting) return this.connecting;
    this.connecting = this._open().finally(() => { this.connecting = null; });
    return this.connecting;
  }

  async _open() {
    const lib = await this.loadLib();
    const makeWASocket = lib.default || lib.makeWASocket;
    const { makeCacheableSignalKeyStore, fetchLatestBaileysVersion, Browsers } = lib;

    this.setStatus('CONNECTING', { lastError: null, qrDataUrl: null });
    // Reuse the same in-memory credentials across reconnects. Right after a QR scan WhatsApp restarts
    // the connection; re-reading from the database could pick up credentials saved *before* the
    // pairing finished and get the fresh link rejected.
    if (!this.auth) this.auth = await this.useMongoAuthState();
    const { state, saveCreds } = this.auth;
    let version;
    try {
      ({ version } = await fetchLatestBaileysVersion());
    } catch (e) { /* offline lookup: use the library default */ }

    const sock = makeWASocket({
      ...(version ? { version } : {}),
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, silentLogger) },
      logger: silentLogger,
      browser: Browsers.ubuntu(LINKED_AS.browser),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false
    });
    this.sock = sock;
    this.qrCount = 0;

    sock.ev.on('creds.update', saveCreds);

    // Delivery receipts for messages we sent.
    sock.ev.on('messages.update', (updates) => {
      for (const u of updates || []) {
        if (u?.key?.fromMe && u.update?.status) this.recordReceipt(u.key.id, Number(u.update.status));
      }
    });
    sock.ev.on('message-receipt.update', (receipts) => {
      for (const r of receipts || []) {
        if (!r?.key?.fromMe) continue;
        const ack = r.receipt?.readTimestamp ? ACK.READ : r.receipt?.receiptTimestamp ? ACK.DELIVERED : 0;
        this.recordReceipt(r.key.id, ack);
      }
    });

    sock.ev.on('connection.update', async (update) => {
      if (this.sock !== sock) return; // an older socket that was replaced
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          this.qrCount += 1;
          this.qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 300 });
          this.setStatus('QR', { qrAt: new Date() });
        } catch (e) {
          this.lastError = `QR render failed: ${e.message}`;
        }
      }

      if (update.isNewLogin) {
        // The phone just scanned the QR: pairing done, WhatsApp will now ask for a reconnect.
        const linkedAt = new Date();
        this.device = this.deviceFromCreds(state.creds, linkedAt) || { linkedAt };
        await this.saveMeta({ linkedAt });
        await saveCreds();
        log(`QR scanned — linked to ${state.creds?.me?.id || 'phone'} (${state.creds?.platform || 'unknown platform'}). Finishing setup…`);
        this.setStatus('CONNECTING', { qrDataUrl: null, lastError: null });
      }

      if (connection === 'open') {
        this.onWhatsAppCache.clear();
        this.reconnectAttempts = 0;
        this.device = this.deviceFromCreds(state.creds) || this.device;
        log(`connected as ${sock.user?.id || '?'}${sock.user?.name ? ` (${sock.user.name})` : ''} on ${this.deviceInfo()?.phone || 'phone'}`);
        this.setStatus('CONNECTED', {
          me: sock.user?.id || null,
          name: sock.user?.name || sock.user?.verifiedName || null,
          connectedAt: new Date(),
          qrDataUrl: null,
          lastError: null
        });
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        const wasQr = this.status === 'QR';
        this.sock = null;
        this.lastDisconnectAt = new Date();
        this.lastDisconnectReason = REASON_TEXT[code] || lastDisconnect?.error?.message || `Closed (code ${code || 'unknown'})`;

        log(`connection closed (code ${code || 'none'}): ${this.lastDisconnectReason}`);

        if (code === CODE.LOGGED_OUT || code === CODE.BAD_SESSION) {
          await this.flushAuth();
          await WhatsappAuth.deleteMany({});
          this.auth = null;
          this.device = null;
          this.wantConnected = false;
          this.setStatus('LOGGED_OUT', { me: null, name: null, connectedAt: null, qrDataUrl: null, lastError: REASON_TEXT[code] });
          return;
        }

        // Right after a successful scan WhatsApp asks for a fresh socket: reconnect immediately.
        if (code === CODE.RESTART_REQUIRED) {
          this.setStatus('CONNECTING', { qrDataUrl: null, lastError: null });
          await saveCreds();
          await this.flushAuth();        // the linked credentials must be stored before reconnecting
          this.scheduleReconnect(200);
          return;
        }

        // QR shown but nobody scanned it: stop instead of generating QR codes forever.
        if (wasQr && (code === CODE.TIMED_OUT || this.qrCount >= 5)) {
          this.wantConnected = false;
          this.setStatus('DISCONNECTED', { qrDataUrl: null, lastError: REASON_TEXT[CODE.TIMED_OUT] });
          return;
        }

        // Another session took over: don't fight it in a reconnect loop.
        if (code === CODE.CONNECTION_REPLACED) {
          this.wantConnected = false;
          this.setStatus('DISCONNECTED', { connectedAt: null, lastError: REASON_TEXT[code] });
          return;
        }

        this.setStatus('DISCONNECTED', { connectedAt: null, lastError: this.lastDisconnectReason });
        if (this.wantConnected) {
          // Network drop etc.: back off 2s, 4s, 8s … up to 60s.
          this.reconnectAttempts += 1;
          this.scheduleReconnect(Math.min(60000, 2000 * 2 ** Math.min(this.reconnectAttempts - 1, 5)));
        }
      }
    });

    return this.publicStatus();
  }

  /** Stop the socket but keep the linked session (used on shutdown / lease loss). */
  async stop() {
    this.wantConnected = false;
    clearTimeout(this.reconnectTimer);
    await this.flushAuth();
    const sock = this.sock;
    this.sock = null;
    try { sock?.end?.(undefined); } catch (e) { /* ignore */ }
    this.setStatus('DISCONNECTED', { connectedAt: null });
  }

  /** Unlink the device from WhatsApp and forget the session. */
  async logout() {
    this.wantConnected = false;
    clearTimeout(this.reconnectTimer);
    const sock = this.sock;
    this.sock = null;
    try { await sock?.logout?.(); } catch (e) { /* already closed */ }
    try { sock?.end?.(undefined); } catch (e) { /* ignore */ }
    await this.flushAuth();
    await WhatsappAuth.deleteMany({});
    this.auth = null;
    this.device = null;
    log('unlinked by admin');
    this.setStatus('LOGGED_OUT', { me: null, name: null, connectedAt: null, qrDataUrl: null, lastError: null });
  }

  /**
   * Send a text. Returns { id } (the WhatsApp message id, used for delivery receipts).
   * Throws { notConnected: true } when offline and { permanent: true } for numbers not on WhatsApp.
   */
  async sendText(phone, text) {
    if (!this.isReady()) {
      const err = new Error('WhatsApp is not connected.');
      err.notConnected = true;
      throw err;
    }
    const jid = toJid(phone);
    if (!jid) {
      const err = new Error(`Invalid phone number: ${phone}`);
      err.permanent = true;
      throw err;
    }
    if (!this.onWhatsAppCache.has(jid)) {
      try {
        const [result] = await this.sock.onWhatsApp(jid);
        this.onWhatsAppCache.set(jid, Boolean(result?.exists));
      } catch (e) {
        this.onWhatsAppCache.set(jid, true); // lookup failed: try to send anyway
      }
    }
    if (!this.onWhatsAppCache.get(jid)) {
      const err = new Error(`${phone} is not on WhatsApp.`);
      err.permanent = true;
      throw err;
    }
    const msg = await this.sock.sendMessage(jid, { text });
    return { id: msg?.key?.id || null };
  }
}

module.exports = new BaileysProvider();
module.exports.toJid = toJid;
module.exports.ACK = ACK;
