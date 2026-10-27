const Tour = require('./tour.model');
const TourBooking = require('./tourBooking.model');
const { Wallet, WalletLedger } = require('../wallets/wallet.model');
const { TRANSACTION_TYPES, DEFAULT_GST_RATE } = require('../../config/constants');

function generateTourBookingId() {
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `TOUR-${rand}`;
}

const toursService = {
  async listTours(query = {}) {
    const filter = { isActive: true };
    if (query.destination) {
      filter.destination = new RegExp(query.destination, 'i');
    }
    if (query.category) {
      filter.category = query.category;
    }
    return Tour.find(filter).sort({ createdAt: -1 });
  },

  async getTourById(idOrSlug) {
    let tour = await Tour.findOne({ tourId: idOrSlug });
    if (!tour && idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
      tour = await Tour.findById(idOrSlug);
    }
    return tour;
  },

  async bookTour(payload) {
    const {
      tourId,
      travelers = [],
      numberOfTravelers,
      leadTraveler,
      paymentProvider = 'dummy',
      agentId = null,
      userId = null,
      specialRequests = ''
    } = payload;

    const tour = await this.getTourById(tourId);
    if (!tour || !tour.isActive) {
      throw new Error('Tour package not found or no longer active');
    }

    let finalTravelers = Array.isArray(travelers) && travelers.length > 0 ? travelers : [];
    if (finalTravelers.length === 0) {
      const count = numberOfTravelers || 1;
      finalTravelers = Array.from({ length: count }).map((_, idx) => ({
        name: idx === 0 && leadTraveler?.name ? leadTraveler.name : `Traveler ${idx + 1}`,
        age: 28,
        gender: 'female'
      }));
    }

    const departureDate = payload.departureDate || payload.travelDate || (tour.departureDates?.[0] ? tour.departureDates[0] : new Date());
    const contactEmail = payload.contactEmail || leadTraveler?.email || 'traveler@rupadiya.test';
    const contactPhone = payload.contactPhone || leadTraveler?.phone || '9876543210';

    const travelerCount = finalTravelers.length;
    const baseFareTotal = tour.basePrice * travelerCount;
    const gstAmount = Math.round(baseFareTotal * DEFAULT_GST_RATE);
    const totalAmount = baseFareTotal + gstAmount;

    // Tour commission for agent: 10% of base fare
    const commissionPerTraveler = Math.round(tour.basePrice * 0.10);
    const totalAgentCommission = agentId ? commissionPerTraveler * travelerCount : 0;

    let paymentStatus = 'PAID';
    const bookingId = generateTourBookingId();

    // If agent is paying using their wallet
    if (paymentProvider === 'agent_wallet') {
      if (!agentId) {
        throw new Error('Agent authentication required for wallet payment');
      }

      const agentWallet = await Wallet.findOne({ userId: agentId });
      if (!agentWallet || agentWallet.balance < totalAmount) {
        throw new Error(`Insufficient wallet balance. Required: ₹${totalAmount}, Available: ₹${agentWallet?.balance || 0}`);
      }

      // Deduct from agent wallet
      agentWallet.balance -= totalAmount;
      await agentWallet.save();

      await WalletLedger.create({
        walletId: agentWallet._id,
        userId: agentId,
        companyCode: 1,
        entryType: 'DEBIT',
        amount: totalAmount,
        transactionType: TRANSACTION_TYPES.TICKET_PURCHASE,
        referenceType: 'BOOKING',
        referenceId: bookingId,
        description: `Tour Package Booking - #${bookingId} (${tour.title})`,
        idempotencyKey: `TOUR_DEBIT_${bookingId}`,
        balanceAfter: agentWallet.balance
      });

      // Credit instant commission to agent wallet
      if (totalAgentCommission > 0) {
        agentWallet.balance += totalAgentCommission;
        await agentWallet.save();

        await WalletLedger.create({
          walletId: agentWallet._id,
          userId: agentId,
          companyCode: 1,
          entryType: 'CREDIT',
          amount: totalAgentCommission,
          transactionType: TRANSACTION_TYPES.TICKET_COMMISSION_CREDIT,
          referenceType: 'COMMISSION',
          referenceId: bookingId,
          description: `Tour Commission - #${bookingId} (${travelerCount} pax @ ₹${commissionPerTraveler})`,
          idempotencyKey: `TOUR_COMM_${bookingId}`,
          balanceAfter: agentWallet.balance
        });
      }
    }

    const booking = await TourBooking.create({
      bookingId,
      tourId: tour._id,
      userId: userId || null,
      bookedByAgentId: agentId || null,
      departureDate: new Date(departureDate),
      travelers: finalTravelers,
      contactEmail,
      contactPhone,
      baseFareTotal,
      gstAmount,
      totalAmount,
      agentCommission: totalAgentCommission,
      paymentStatus,
      paymentProvider,
      paymentDetails: {
        paymentId: `TXN_${Date.now()}`,
        paidAt: new Date()
      },
      specialRequests
    });

    return {
      success: true,
      booking: await TourBooking.findById(booking._id).populate('tourId'),
      cashbackCoupon: {
        code: `NEXTTOUR${Math.floor(100 + Math.random() * 900)}`,
        discountAmount: 250,
        message: 'Use this coupon on your next tour or bus booking to save ₹250!'
      }
    };
  },

  async createTour(data) {
    return Tour.create(data);
  },

  async updateTour(id, data) {
    return Tour.findByIdAndUpdate(id, data, { new: true });
  },

  async deleteTour(id) {
    return Tour.findByIdAndUpdate(id, { isActive: false }, { new: true });
  }
};

module.exports = toursService;
