const { Wallet, WalletLedger } = require('../modules/wallets/wallet.model');

/**
 * Single source of truth for every wallet balance mutation.
 *
 * Guarantees:
 *  - Balance changes use atomic `$inc` (no read-modify-write lost updates).
 *  - Debits are guarded with `availableBalance >= amount` in the same atomic update,
 *    so concurrent debits can never overdraw a wallet.
 *  - Every mutation writes an immutable ledger row keyed by `idempotencyKey`.
 *    Replaying the same key is a no-op that returns the original ledger row.
 *  - When a MongoDB session (replica set transaction) is passed, wallet and ledger
 *    commit or roll back together. Without a session, a duplicate-key race on the
 *    ledger is compensated by reversing the balance change.
 */

class WalletError extends Error {
  constructor(message, code, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

function withSession(query, session) {
  if (session) query.session(session);
  return query;
}

async function ensureWallet({ userId, companyCode = null, companyId = null, ownerType = 'AGENT', session = null }) {
  // Upsert keeps creation race-free thanks to the unique index on userId.
  return withSession(
    Wallet.findOneAndUpdate(
      { userId },
      {
        $setOnInsert: {
          userId,
          companyCode,
          companyId,
          ownerType,
          availableBalance: 0,
          reservedBalance: 0
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ),
    session
  );
}

async function findExistingEntry(idempotencyKey, session) {
  return withSession(WalletLedger.findOne({ idempotencyKey }), session);
}

async function writeLedger(entry, session) {
  const [row] = await WalletLedger.create([entry], session ? { session } : {});
  return row;
}

function isDuplicateKey(err) {
  return err && (err.code === 11000 || String(err.message || '').includes('E11000'));
}

/**
 * Credit `amount` to a user's available balance.
 */
async function credit({
  userId,
  amount,
  transactionType,
  referenceType,
  referenceId,
  description,
  idempotencyKey,
  companyCode = null,
  companyId = null,
  ownerType = 'AGENT',
  session = null
}) {
  const value = roundMoney(amount);
  if (!userId) throw new WalletError('Wallet owner is required.', 'WALLET_OWNER_REQUIRED');
  if (!(value > 0)) throw new WalletError('Credit amount must be positive.', 'INVALID_AMOUNT');
  if (!idempotencyKey) throw new WalletError('idempotencyKey is required.', 'IDEMPOTENCY_KEY_REQUIRED');

  const existing = await findExistingEntry(idempotencyKey, session);
  if (existing) return { ledger: existing, wallet: null, duplicate: true };

  await ensureWallet({ userId, companyCode, companyId, ownerType, session });
  const wallet = await withSession(
    Wallet.findOneAndUpdate({ userId }, { $inc: { availableBalance: value } }, { new: true }),
    session
  );

  try {
    const ledger = await writeLedger({
      walletId: wallet._id,
      userId,
      companyId: companyId || wallet.companyId || null,
      companyCode: companyCode ?? wallet.companyCode ?? null,
      entryType: 'CREDIT',
      amount: value,
      balanceAfter: wallet.availableBalance,
      transactionType,
      referenceType,
      referenceId: String(referenceId),
      description,
      idempotencyKey
    }, session);
    return { ledger, wallet, duplicate: false };
  } catch (err) {
    if (isDuplicateKey(err) && !session) {
      // Lost a race with an identical request: undo our balance change.
      await Wallet.updateOne({ userId }, { $inc: { availableBalance: -value } });
      return { ledger: await findExistingEntry(idempotencyKey, null), wallet: null, duplicate: true };
    }
    throw err;
  }
}

/**
 * Debit `amount` from a user's available balance. Fails with INSUFFICIENT_BALANCE
 * instead of ever letting the balance go negative.
 */
async function debit({
  userId,
  amount,
  transactionType,
  referenceType,
  referenceId,
  description,
  idempotencyKey,
  companyCode = null,
  companyId = null,
  allowPartial = false,
  session = null
}) {
  let value = roundMoney(amount);
  if (!userId) throw new WalletError('Wallet owner is required.', 'WALLET_OWNER_REQUIRED');
  if (!(value > 0)) throw new WalletError('Debit amount must be positive.', 'INVALID_AMOUNT');
  if (!idempotencyKey) throw new WalletError('idempotencyKey is required.', 'IDEMPOTENCY_KEY_REQUIRED');

  const existing = await findExistingEntry(idempotencyKey, session);
  if (existing) return { ledger: existing, wallet: null, duplicate: true, amount: existing.amount };

  let wallet = await withSession(
    Wallet.findOneAndUpdate(
      { userId, isLocked: { $ne: true }, availableBalance: { $gte: value } },
      { $inc: { availableBalance: -value } },
      { new: true }
    ),
    session
  );

  if (!wallet && allowPartial) {
    // Used for clawbacks (e.g. commission reversal): take whatever is available, never below zero.
    const current = await withSession(Wallet.findOne({ userId }), session);
    const available = roundMoney(current?.availableBalance || 0);
    if (available > 0) {
      value = Math.min(value, available);
      wallet = await withSession(
        Wallet.findOneAndUpdate(
          { userId, availableBalance: { $gte: value } },
          { $inc: { availableBalance: -value } },
          { new: true }
        ),
        session
      );
    }
    if (!wallet) return { ledger: null, wallet: current, duplicate: false, amount: 0 };
  }

  if (!wallet) {
    const current = await withSession(Wallet.findOne({ userId }), session);
    if (current?.isLocked) {
      throw new WalletError('This wallet is locked. Please contact support.', 'WALLET_LOCKED', 423);
    }
    const available = roundMoney(current?.availableBalance || 0);
    throw new WalletError(
      `Insufficient wallet balance. Required: ₹${value.toLocaleString('en-IN')}, Available: ₹${available.toLocaleString('en-IN')}`,
      'INSUFFICIENT_BALANCE',
      402
    );
  }

  try {
    const ledger = await writeLedger({
      walletId: wallet._id,
      userId,
      companyId: companyId || wallet.companyId || null,
      companyCode: companyCode ?? wallet.companyCode ?? null,
      entryType: 'DEBIT',
      amount: value,
      balanceAfter: wallet.availableBalance,
      transactionType,
      referenceType,
      referenceId: String(referenceId),
      description,
      idempotencyKey
    }, session);
    return { ledger, wallet, duplicate: false, amount: value };
  } catch (err) {
    if (isDuplicateKey(err) && !session) {
      await Wallet.updateOne({ userId }, { $inc: { availableBalance: value } });
      const prior = await findExistingEntry(idempotencyKey, null);
      return { ledger: prior, wallet: null, duplicate: true, amount: prior?.amount || 0 };
    }
    throw err;
  }
}

module.exports = {
  WalletError,
  ensureWallet,
  credit,
  debit,
  roundMoney
};
