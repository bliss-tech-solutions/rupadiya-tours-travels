const mongoose = require('mongoose');

/** Outbox: every message to send. Business code only enqueues; the sender worker delivers. */
const notificationJobSchema = new mongoose.Schema({
  event: { type: String, required: true, index: true },
  audience: { type: String, enum: ['PASSENGER', 'AGENT', 'COMPANY', 'ADMIN'], required: true },
  channel: { type: String, enum: ['WHATSAPP', 'EMAIL'], required: true },
  to: { type: String, required: true },
  subject: { type: String, default: '' },
  body: { type: String, required: true },
  html: { type: String, default: '' },
  dedupeKey: { type: String, default: null },   // same event never queued twice for the same recipient
  refType: { type: String, default: null },
  refId: { type: String, default: null },
  status: { type: String, enum: ['PENDING', 'SENDING', 'SENT', 'FAILED', 'EXPIRED', 'SKIPPED'], default: 'PENDING', index: true },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now, index: true },
  lockedAt: { type: Date, default: null },
  sentAt: { type: Date, default: null },
  // WhatsApp delivery receipts (from the phone): server ack → delivered → read.
  waMessageId: { type: String, default: null },
  deliveredAt: { type: Date, default: null },
  readAt: { type: Date, default: null },
  lastError: { type: String, default: null },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 3600 * 1000) }
}, { timestamps: true });
notificationJobSchema.index({ dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } });
notificationJobSchema.index({ status: 1, channel: 1, nextAttemptAt: 1 });
notificationJobSchema.index({ waMessageId: 1 }, { partialFilterExpression: { waMessageId: { $type: 'string' } } });
notificationJobSchema.index({ channel: 1, createdAt: -1 });

/** Editable message templates (super admin only). Placeholders like {{pnr}} are filled per event. */
const messageTemplateSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },   // EVENT:AUDIENCE:CHANNEL
  event: { type: String, required: true },
  audience: { type: String, required: true },
  channel: { type: String, enum: ['WHATSAPP', 'EMAIL'], required: true },
  subject: { type: String, default: '' },
  body: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

/** WhatsApp (Baileys) multi-device auth state, stored in MongoDB so a redeploy needs no rescan. */
const whatsappAuthSchema = new mongoose.Schema({
  _id: { type: String },
  value: { type: String, required: true }
}, { timestamps: true, collection: 'whatsapp_auth' });

/** Small key/value platform settings (e.g. admin notification numbers). */
const platformSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

/** Lease so only one API instance holds the WhatsApp connection and runs the sender. */
const workerLeaseSchema = new mongoose.Schema({
  _id: { type: String },
  holder: { type: String, required: true },
  expiresAt: { type: Date, required: true }
}, { collection: 'worker_leases' });

module.exports = {
  NotificationJob: mongoose.models.NotificationJob || mongoose.model('NotificationJob', notificationJobSchema),
  MessageTemplate: mongoose.models.MessageTemplate || mongoose.model('MessageTemplate', messageTemplateSchema),
  WhatsappAuth: mongoose.models.WhatsappAuth || mongoose.model('WhatsappAuth', whatsappAuthSchema),
  PlatformSetting: mongoose.models.PlatformSetting || mongoose.model('PlatformSetting', platformSettingSchema),
  WorkerLease: mongoose.models.WorkerLease || mongoose.model('WorkerLease', workerLeaseSchema)
};
