class InventoryProvider {
  async searchTrips(criteria) {
    throw new Error('searchTrips() must be implemented');
  }

  async getSeatLayout(tripId) {
    throw new Error('getSeatLayout() must be implemented');
  }

  async holdSeats(request) {
    throw new Error('holdSeats() must be implemented');
  }

  async confirmBooking(request) {
    throw new Error('confirmBooking() must be implemented');
  }

  async cancelBooking(request) {
    throw new Error('cancelBooking() must be implemented');
  }
}

module.exports = InventoryProvider;

