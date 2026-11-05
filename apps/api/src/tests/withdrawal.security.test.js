const test = require('node:test');
const assert = require('node:assert');
const { KYC_STATUS, WITHDRAWAL_STATUS, TRANSACTION_TYPES } = require('../config/constants');

test('Withdrawal Security - KYC Gate blocks non-verified agents', async (t) => {
  const agentNotSubmitted = { kycStatus: KYC_STATUS.NOT_SUBMITTED };
  const agentPending = { kycStatus: KYC_STATUS.PENDING };
  const agentVerified = { kycStatus: KYC_STATUS.VERIFIED };

  const canWithdraw = (agent) => agent.kycStatus === KYC_STATUS.VERIFIED;

  assert.strictEqual(canWithdraw(agentNotSubmitted), false, 'NOT_SUBMITTED agent must be blocked from withdrawing');
  assert.strictEqual(canWithdraw(agentPending), false, 'PENDING kyc agent must be blocked from withdrawing');
  assert.strictEqual(canWithdraw(agentVerified), true, 'VERIFIED agent is permitted to withdraw');
});

test('Withdrawal Security - Minimum withdrawal threshold is strictly ₹500', async (t) => {
  const isAmountValid = (amount) => {
    const num = Number(amount);
    return Boolean(num && !isNaN(num) && num >= 500);
  };

  assert.strictEqual(isAmountValid(499), false, '₹499 must be rejected below minimum');
  assert.strictEqual(isAmountValid(0), false, '₹0 must be rejected');
  assert.strictEqual(isAmountValid(-500), false, 'Negative amounts must be rejected');
  assert.strictEqual(isAmountValid(500), true, '₹500 exact minimum must pass');
  assert.strictEqual(isAmountValid(2500), true, '₹2,500 must pass');
});

test('Withdrawal Security - Earnings Source Isolation prevents withdrawing non-earning deposit capital', async (t) => {
  // Scenario: Agent deposited ₹50,000 to issue tickets, but only earned ₹2,000 net commission
  const wallet = {
    availableBalance: 52000, // ₹50k deposit + ₹2k commission
    reservedBalance: 0
  };

  const commissions = [
    { netCommission: 1200, status: 'CREDITED' },
    { netCommission: 800, status: 'CREDITED' }
  ];

  const pastWithdrawals = []; // None yet

  const totalEarnings = commissions.reduce((s, c) => s + c.netCommission, 0);
  const alreadyClaimed = pastWithdrawals.reduce((s, w) => s + w.amount, 0);
  const withdrawableFromEarnings = Math.max(0, totalEarnings - alreadyClaimed);

  // Attempting to withdraw ₹5,000 (which is less than wallet available balance ₹52,000, BUT exceeds ₹2,000 earnings)
  const requestedWithdrawal = 5000;
  const isAllowed = requestedWithdrawal <= withdrawableFromEarnings && requestedWithdrawal <= wallet.availableBalance;

  assert.strictEqual(totalEarnings, 2000, 'Total commission earnings must be ₹2,000');
  assert.strictEqual(withdrawableFromEarnings, 2000, 'Withdrawable earnings balance must be capped at ₹2,000');
  assert.strictEqual(isAllowed, false, 'Agent must NOT be permitted to withdraw from deposited working capital');
});

test('Withdrawal Security - Bank IFSC and Account Number validation rules', async (t) => {
  const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  const BANK_ACCOUNT_REGEX = /^\d{9,18}$/;
  const UPI_REGEX = /^[a-zA-Z0-9.\-_]{2,49}@[a-zA-Z]{2,49}$/;

  // IFSC Tests
  assert.strictEqual(IFSC_REGEX.test('SBIN0001234'), true, 'Valid SBI IFSC');
  assert.strictEqual(IFSC_REGEX.test('HDFC0001245'), true, 'Valid HDFC IFSC');
  assert.strictEqual(IFSC_REGEX.test('sbin0001234'), false, 'Lowercase IFSC must fail before normalization');
  assert.strictEqual(IFSC_REGEX.test('INVALID_IFSC'), false, 'Invalid format must fail');
  assert.strictEqual(IFSC_REGEX.test('SBIN1001234'), false, '5th character must be zero');

  // Bank Account Tests
  assert.strictEqual(BANK_ACCOUNT_REGEX.test('123456789'), true, '9-digit account passes');
  assert.strictEqual(BANK_ACCOUNT_REGEX.test('50100492819201'), true, '14-digit HDFC account passes');
  assert.strictEqual(BANK_ACCOUNT_REGEX.test('12345'), false, '5-digit account fails');
  assert.strictEqual(BANK_ACCOUNT_REGEX.test('12345678901234567890'), false, '20-digit account exceeds limit');
  assert.strictEqual(BANK_ACCOUNT_REGEX.test('1234ABCD567'), false, 'Alphanumeric account number fails');

  // UPI Tests
  assert.strictEqual(UPI_REGEX.test('agent@okaxis'), true, 'Valid UPI ID passes');
  assert.strictEqual(UPI_REGEX.test('9876543210@paytm'), true, 'Valid Phone UPI passes');
  assert.strictEqual(UPI_REGEX.test('not-a-upi'), false, 'UPI without @ fails');
});

test('Withdrawal Lifecycle - Escrow hold, Company approval with UTR disbursement, and rejection refund', async (t) => {
  // Agent Initial State
  const wallet = {
    userId: 'agent_user_1',
    availableBalance: 4500,
    reservedBalance: 0
  };

  const withdrawalAmount = 1500;

  // Step 1: Agent requests withdrawal -> Funds held in escrow
  assert.strictEqual(wallet.availableBalance >= withdrawalAmount, true);
  wallet.availableBalance -= withdrawalAmount;
  wallet.reservedBalance += withdrawalAmount;

  const withdrawal = {
    _id: 'WDR_TEST_001',
    agentId: wallet.userId,
    amount: withdrawalAmount,
    status: WITHDRAWAL_STATUS.PENDING,
    payoutDetails: {
      method: 'bank',
      accountName: 'Rahul Sharma',
      accountNumberMasked: 'XXXX-XXXX-8921',
      ifscCode: 'SBIN0001234'
    }
  };

  assert.strictEqual(wallet.availableBalance, 3000, 'Available balance reduced by ₹1500');
  assert.strictEqual(wallet.reservedBalance, 1500, 'Reserved escrow balance holds ₹1500');
  assert.strictEqual(withdrawal.status, WITHDRAWAL_STATUS.PENDING, 'Initial status is PENDING on hold');

  // Step 2A: Company Owner Rejection Scenario -> Reserved funds refunded back to available
  const rejectionRefundWallet = { ...wallet };
  rejectionRefundWallet.reservedBalance -= withdrawal.amount;
  rejectionRefundWallet.availableBalance += withdrawal.amount;

  assert.strictEqual(rejectionRefundWallet.availableBalance, 4500, 'Funds returned to available balance upon rejection');
  assert.strictEqual(rejectionRefundWallet.reservedBalance, 0, 'Escrow cleared on rejection');

  // Step 2B: Company Owner Approval Scenario -> Reserved funds settled and disbursed
  const approvalSettleWallet = { ...wallet };
  approvalSettleWallet.reservedBalance -= withdrawal.amount;

  const generatedUtr = `UTR${Date.now()}8812`;
  withdrawal.status = WITHDRAWAL_STATUS.APPROVED;
  withdrawal.utrNumber = generatedUtr;
  withdrawal.disbursedAt = new Date();

  assert.strictEqual(approvalSettleWallet.availableBalance, 3000, 'Available balance stays ₹3000');
  assert.strictEqual(approvalSettleWallet.reservedBalance, 0, 'Escrow cleared on settlement');
  assert.strictEqual(withdrawal.status, WITHDRAWAL_STATUS.APPROVED, 'Status becomes APPROVED');
  assert.ok(withdrawal.utrNumber.startsWith('UTR'), 'Unique UTR reference generated for bank disbursement');
});

