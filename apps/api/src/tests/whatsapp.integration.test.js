/**
 * WhatsApp integration: sender lease recovery after a restart, Connect taking over the sender,
 * delivery receipts, message id storage and the admin count statistics.
 * Uses a throwaway MongoDB database and a fake WhatsApp provider (no real network).
 */
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const os = require('os');
const mongoose = require('mongoose');

const BASE_URI = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = `rupadiya_wa_${crypto.randomBytes(4).toString('hex')}`;

const { NotificationJob, WorkerLease } = require('../modules/notifications/models');
const notificationService = require('../modules/notifications/notification.service');
const wa = require('../providers/whatsapp/BaileysProvider');

let connected = false;

test.before(async () => {
  try {
    await mongoose.connect(BASE_URI, { dbName: DB_NAME, serverSelectionTimeoutMS: 2000 });
    connected = true;
  } catch (e) {
    connected = false;
  }
});

test.after(async () => {
  if (connected) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

const LEASE_ID = 'notification-sender';

test('lease: a dead process on this machine is replaced at once (API restart)', async (t) => {
  if (!connected) return t.skip('MongoDB not available');
  await WorkerLease.deleteMany({});
  // Previous API process: same host, a pid that no longer exists, lease still unexpired.
  await WorkerLease.create({ _id: LEASE_ID, holder: `${os.hostname()}:999999:dead01`, expiresAt: new Date(Date.now() + 60000) });
  notificationService.isLeader = false;
  assert.strictEqual(await notificationService.acquireLease(), true, 'stale local lease taken over immediately');
  const lease = await WorkerLease.findById(LEASE_ID).lean();
  assert.strictEqual(lease.holder, notificationService.instanceId());
});

test('lease: a live instance on another machine keeps it; Connect claims it explicitly', async (t) => {
  if (!connected) return t.skip('MongoDB not available');
  await WorkerLease.deleteMany({});
  await WorkerLease.create({ _id: LEASE_ID, holder: 'other-host:1234:live01', expiresAt: new Date(Date.now() + 60000) });
  notificationService.isLeader = false;
  assert.strictEqual(await notificationService.acquireLease(), false, 'live remote holder is respected');

  await notificationService.claimLeadership();
  assert.strictEqual(notificationService.isLeader, true);
  assert.strictEqual((await WorkerLease.findById(LEASE_ID).lean()).holder, notificationService.instanceId(), 'admin Connect makes this server the sender');

  await notificationService.releaseLease();
  assert.strictEqual(await WorkerLease.countDocuments({ _id: LEASE_ID }), 0, 'lease released on shutdown');
});

test('sender stores the WhatsApp message id; receipts mark delivered and read', async (t) => {
  if (!connected) return t.skip('MongoDB not available');
  await NotificationJob.deleteMany({});
  let n = 0;
  const fakeWa = {
    isReady: () => true,
    async sendText() { n += 1; return { id: `WAMSG${n}` }; }
  };
  const fakeMail = { isConfigured: () => false };
  notificationService.setProviders({ whatsapp: fakeWa, email: fakeMail });
  notificationService.nextWhatsappAt = 0;

  const job = await NotificationJob.create({ event: 'BOOKING_CONFIRMED', audience: 'PASSENGER', channel: 'WHATSAPP', to: '9876543210', body: 'hi' });
  const r = await notificationService.processOnce();
  assert.strictEqual(r.sent, 1);
  let saved = await NotificationJob.findById(job._id).lean();
  assert.strictEqual(saved.status, 'SENT');
  assert.strictEqual(saved.waMessageId, 'WAMSG1', 'message id kept for delivery receipts');

  await wa.recordReceipt('WAMSG1', wa.ACK.DELIVERED);
  saved = await NotificationJob.findById(job._id).lean();
  assert.ok(saved.deliveredAt, 'delivered receipt recorded');
  assert.strictEqual(saved.readAt, null);

  await wa.recordReceipt('WAMSG1', wa.ACK.READ);
  saved = await NotificationJob.findById(job._id).lean();
  assert.ok(saved.readAt, 'read receipt recorded');

  await wa.recordReceipt('WAMSG1', wa.ACK.SERVER); // server ack alone is not "delivered"
  await wa.recordReceipt('UNKNOWN', wa.ACK.READ);   // unknown ids are ignored, never throw
});

test('stats: today counts, by message type, and a day-by-day history (counts only)', async (t) => {
  if (!connected) return t.skip('MongoDB not available');
  await NotificationJob.deleteMany({});
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 3600000);
  const mk = (extra) => ({ audience: 'PASSENGER', channel: 'WHATSAPP', to: '9876543210', body: 'x', event: 'BOOKING_CONFIRMED', ...extra });

  await NotificationJob.insertMany([
    mk({ status: 'SENT', sentAt: now, deliveredAt: now, readAt: now }),
    mk({ status: 'SENT', sentAt: now, deliveredAt: now }),
    mk({ status: 'SENT', sentAt: now }),
    mk({ status: 'FAILED', event: 'PASSENGER_BOARDED' }),
    mk({ status: 'PENDING', event: 'PASSENGER_BOARDED' }),
    mk({ status: 'SENT', sentAt: yesterday, deliveredAt: yesterday, createdAt: yesterday }),
    { audience: 'PASSENGER', channel: 'EMAIL', to: 'a@b.in', body: 'x', event: 'BOOKING_CONFIRMED', status: 'SENT' }
  ]);

  const s = await notificationService.whatsappStats(7);
  assert.strictEqual(s.today.total, 5);
  assert.strictEqual(s.today.sent, 3);
  assert.strictEqual(s.today.delivered, 2);
  assert.strictEqual(s.today.read, 1);
  assert.strictEqual(s.today.failed, 1);
  assert.strictEqual(s.today.waiting, 1);
  assert.strictEqual(s.queue.waiting, 1);
  assert.strictEqual(s.email.today, 1, 'email counted separately');

  const booked = s.byEventToday.find((e) => e.event === 'BOOKING_CONFIRMED');
  assert.strictEqual(booked.sent, 3);
  assert.strictEqual(booked.delivered, 2);

  assert.strictEqual(s.history.length, 7, 'one row per day, including empty days');
  assert.strictEqual(s.history[0].date, s.today.date, 'newest day first');
  assert.strictEqual(s.totals.sent, 4, 'today + yesterday');
  assert.strictEqual(s.totals.delivered, 3);
  assert.ok(!JSON.stringify(s).includes('9876543210'), 'no phone numbers or message content in the counts');
});

test('pairing: linked credentials are saved in order before the post-scan reconnect; device details shown', async (t) => {
  if (!connected) return t.skip('MongoDB not available');
  const { WhatsappAuth } = require('../modules/notifications/models');
  await WhatsappAuth.deleteMany({});
  wa.auth = null;
  wa.device = null;

  // Same flow as _open(): one in-memory auth state for the life of the session.
  wa.auth = await wa.useMongoAuthState();
  const { state, saveCreds } = wa.auth;
  assert.ok(!state.creds.me, 'fresh, unlinked credentials');

  // Phone scans the QR: Baileys merges the pairing result into the same creds object, then saves.
  Object.assign(state.creds, { me: { id: '919876543210:7@s.whatsapp.net', name: 'RBS', lid: '1234:7@lid' }, platform: 'smba' });
  saveCreds();
  for (let i = 0; i < 50; i += 1) state.keys.set({ 'pre-key': { [String(i)]: { public: Buffer.from([i]), private: Buffer.from([i]) } } });
  await wa.flushAuth(); // what the 515 handler awaits before reconnecting

  const saved = JSON.parse((await WhatsappAuth.findById('creds').lean()).value);
  assert.strictEqual(saved.me.id, '919876543210:7@s.whatsapp.net', 'linked credentials are in the database before reconnect');
  assert.strictEqual(await WhatsappAuth.countDocuments({ _id: /^pre-key-/ }), 50, 'all queued key writes finished');

  // A later write to the same key wins (writes stay in order).
  Object.assign(state.creds, { me: { ...state.creds.me, name: 'Rupadiya Bus Samiti' } });
  saveCreds();
  await wa.flushAuth();
  assert.strictEqual(JSON.parse((await WhatsappAuth.findById('creds').lean()).value).me.name, 'Rupadiya Bus Samiti');

  // After a restart the saved session and the device it is linked to are recognised.
  wa.auth = null;
  wa.device = null;
  await wa.saveMeta({ linkedAt: new Date('2026-11-25T10:00:00Z') });
  assert.strictEqual(await wa.hasSavedSession(), true);
  const dev = wa.deviceInfo();
  assert.strictEqual(dev.phone, 'WhatsApp Business · Android');
  assert.strictEqual(dev.deviceId, 7);
  assert.ok(dev.linkedAt, 'linked time kept');
  assert.strictEqual(dev.shownOnPhoneAs, 'Rupadiya Bus Samiti (Ubuntu)');
  assert.ok(wa.publicStatus().device, 'device included in the status sent to the admin page');

  await WhatsappAuth.deleteMany({});
  wa.auth = null;
  wa.device = null;
});

test('templates: formatted v2 render cleanly; empty lines dropped; untouched v1 upgraded, edited kept', async (t) => {
  if (!connected) return t.skip('MongoDB not available');
  const { MessageTemplate } = require('../modules/notifications/models');
  const v1 = require('../modules/notifications/defaultTemplates.v1');
  const v2 = require('../modules/notifications/defaultTemplates');
  const { render } = notificationService.constructor ? require('../modules/notifications/notification.service') : {};

  const data = {
    name: 'Mike Owen', pnr: 'RBS7K2M9Q', from: 'Rupaidiha', to: 'Ahmedabad', date: '26 Nov 2026', time: '09:30 PM',
    arrival: '27 Nov 2026, 11:30 PM', seats: 'L7', passengerList: 'Mike Owen (L7)', passengerCount: '1', infants: '',
    boarding: 'Rupaidiha Bus Stand', boardingTime: '09:30 PM', dropping: 'Ahmedabad Geeta Mandir', busNumber: 'UP40AT1001',
    companyName: 'NTT Travels', amount: '1,184', ticketUrl: 'https://rupadiya.in/ticket/BK1', bookUrl: 'https://rupadiya.in'
  };
  const tpl = v2.find((x) => x.event === 'BOOKING_CONFIRMED' && x.channel === 'WHATSAPP');
  const msg = render(tpl.body, data);
  assert.ok(msg.startsWith('🎫 *TICKET CONFIRMED*'), 'bold title first');
  assert.ok(msg.includes('🔖 *PNR:* RBS7K2M9Q'));
  assert.ok(msg.includes('💳 *Amount paid:* ₹1,184'));
  assert.ok(!msg.includes('{{'), 'no unfilled placeholders');
  assert.ok(!msg.includes('Infants'), 'line with only empty placeholders is dropped');
  assert.ok(!/\n{3,}/.test(msg), 'no runs of blank lines');
  assert.ok(render('👶 *Infants:* {{infants}}', { infants: '1 on lap' }).includes('1 on lap'), 'kept when filled');

  // Every v2 template renders without leftover placeholders given full sample data.
  const full = { ...data, infants: '1 on lap', refundAmount: '900', receiptNo: 'CR-1', utr: 'UTR1', boarded: 30, noShow: 1, total: 31, dropped: 30, managerName: 'Vikram', changeText: 'Boarding point changed: A → B.', reason: 'Late', managerPhone: '(+91 98765 43210)' };
  for (const x of v2) assert.ok(!render(x.body, full).includes('{{'), `${x.event}/${x.audience}/${x.channel} fully filled`);

  // Upgrade: one stored template still the v1 default, one edited by an admin.
  await MessageTemplate.deleteMany({});
  const v1Boarded = v1.find((x) => x.event === 'PASSENGER_BOARDED');
  await MessageTemplate.create({ key: 'PASSENGER_BOARDED:PASSENGER:WHATSAPP', event: 'PASSENGER_BOARDED', audience: 'PASSENGER', channel: 'WHATSAPP', body: v1Boarded.body, enabled: true });
  await MessageTemplate.create({ key: 'PAYOUT_PAID:AGENT:WHATSAPP', event: 'PAYOUT_PAID', audience: 'AGENT', channel: 'WHATSAPP', body: 'Custom text written by RBS admin {{amount}}', enabled: false });
  await notificationService.ensureTemplates();
  const boarded = await MessageTemplate.findOne({ key: 'PASSENGER_BOARDED:PASSENGER:WHATSAPP' }).lean();
  assert.ok(boarded.body.includes('*WELCOME ABOARD!*'), 'untouched old default upgraded to the formatted version');
  const custom = await MessageTemplate.findOne({ key: 'PAYOUT_PAID:AGENT:WHATSAPP' }).lean();
  assert.strictEqual(custom.body, 'Custom text written by RBS admin {{amount}}', 'admin-edited template kept');
  assert.strictEqual(custom.enabled, false, 'admin on/off choice kept');
  assert.strictEqual(await MessageTemplate.countDocuments({}), v2.length, 'all templates present');
});
