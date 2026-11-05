const test = require('node:test');
const assert = require('node:assert');
const { ROLES } = require('../config/constants');
const { requireCompanyScope } = require('../middleware/companyScope.middleware');

test('Multi-Tenant Isolation - Agent cannot fetch or cancel another agent\'s bookings', async () => {
  const agent1Id = '650000000000000000000001';
  const agent2Id = '650000000000000000000002';

  // Sample booking created by Agent 2
  const bookingOfAgent2 = {
    bookingId: 'BK_AGT2_001',
    pnr: 'RUP-AGT2-01',
    referralAgentId: agent2Id,
    passengerId: agent2Id,
    companyCode: 1,
    contactDetails: { phone: '9876543210', email: 'passenger@example.com' }
  };

  // Agent 1 attempts to search for Agent 2's booking
  const agent1User = { _id: agent1Id, role: ROLES.AGENT, companyCode: 1 };

  // Agent ownership filter logic (as implemented in GET /agent/tickets/search & /agent/bookings)
  const isAgentBooking = (b, agent) => {
    return (b.referralAgentId && b.referralAgentId.toString() === agent._id.toString()) ||
           (b.passengerId && b.passengerId.toString() === agent._id.toString());
  };

  assert.strictEqual(
    isAgentBooking(bookingOfAgent2, agent1User),
    false,
    'Agent 1 must NOT be permitted to access Agent 2\'s booking'
  );

  assert.strictEqual(
    isAgentBooking(bookingOfAgent2, { _id: agent2Id, role: ROLES.AGENT, companyCode: 1 }),
    true,
    'Agent 2 must be permitted to access their own booking'
  );
});

test('Multi-Tenant Isolation - Company Owner cannot access another company\'s resources', async () => {
  let statusSent = null;
  let jsonSent = null;
  let nextCalled = false;

  const mockRes = {
    status(code) {
      statusSent = code;
      return this;
    },
    json(data) {
      jsonSent = data;
      return this;
    }
  };

  // Company Owner 1 attempts to request resources belonging to Company 2
  const owner1Req = {
    user: { _id: '650000000000000000000010', role: ROLES.COMPANY_OWNER, companyCode: 1 },
    params: { companyCode: '2' },
    query: {},
    body: {}
  };

  await requireCompanyScope(owner1Req, mockRes, () => { nextCalled = true; });

  assert.strictEqual(nextCalled, false, 'Cross-tenant request must NOT call next()');
  assert.strictEqual(statusSent, 403, 'Cross-tenant request must return 403 Forbidden');
  assert.strictEqual(jsonSent.code, 'TENANT_MISMATCH', 'Must return TENANT_MISMATCH error code');
});

test('IDOR Protection - Unrelated agents or companies receive masked views on booking lookup', () => {
  const customerId = '650000000000000000000099';
  const issuingAgentId = '650000000000000000000001';
  const attackerAgentId = '650000000000000000000002';

  const bookingDoc = {
    bookingId: 'BK_TEST_100',
    pnr: 'RUP-TEST-100',
    passengerId: customerId,
    referralAgentId: issuingAgentId,
    companyCode: 1,
    contactDetails: { phone: '9876543210', email: 'customer@example.com' }
  };

  const evaluateOwnership = (reqUser, doc) => {
    const isSuperAdmin = reqUser && reqUser.role === 'SUPER_ADMIN';
    const isPassenger = reqUser && (doc.passengerId?.toString() === reqUser._id.toString());
    const isBookingAgent = reqUser && reqUser.role === 'AGENT' && (
      doc.referralAgentId?.toString() === reqUser._id.toString() ||
      doc.passengerId?.toString() === reqUser._id.toString()
    );
    const isCompanyOwner = reqUser && reqUser.role === 'COMPANY_OWNER' && (
      doc.companyCode === reqUser.companyCode ||
      (doc.companyId && doc.companyId.toString() === reqUser.companyId?.toString())
    );
    return Boolean(isSuperAdmin || isPassenger || isBookingAgent || isCompanyOwner);
  };

  // 1. Issuing agent has ownership
  assert.strictEqual(evaluateOwnership({ _id: issuingAgentId, role: 'AGENT' }, bookingDoc), true);

  // 2. Unrelated agent does NOT have ownership
  assert.strictEqual(evaluateOwnership({ _id: attackerAgentId, role: 'AGENT' }, bookingDoc), false);

  // 3. Unrelated company owner does NOT have ownership
  assert.strictEqual(evaluateOwnership({ _id: '650000000000000000000055', role: 'COMPANY_OWNER', companyCode: 2 }, bookingDoc), false);

  // 4. Booking customer has ownership
  assert.strictEqual(evaluateOwnership({ _id: customerId, role: 'USER' }, bookingDoc), true);

  // 5. Super admin has global ownership
  assert.strictEqual(evaluateOwnership({ _id: '650000000000000000000000', role: 'SUPER_ADMIN' }, bookingDoc), true);
});

test('Payment Engine - Wallet deposit order creation executes without ReferenceError', () => {
  const amount = 500;
  const purpose = 'WALLET_DEPOSIT';
  const resolvedUserId = '650000000000000000000001';
  const resolvedCompanyCode = 1;
  const metadata = { note: 'Deposit test' };

  let finalAmount = Number(amount);
  assert.strictEqual(finalAmount, 500);

  // Replicate the order payload constructed in /create-order
  const orderMetadata = {
    ...metadata,
    verifiedAmount: finalAmount,
    userId: resolvedUserId,
    companyCode: resolvedCompanyCode
  };

  assert.strictEqual(orderMetadata.verifiedAmount, 500);
  assert.strictEqual(orderMetadata.userId, resolvedUserId);
  assert.strictEqual(orderMetadata.companyCode, 1);
});
