const InventoryProvider = require('./InventoryProvider');

class RedBusProvider extends InventoryProvider {
  constructor() {
    super();
    this.name = 'redbus';
  }

  async searchTrips() {
    throw new Error('RedBus integration provider is not configured. Partner API credentials and authorization pending.');
  }

  async getSeatLayout() {
    throw new Error('RedBus integration provider is not configured.');
  }

  async holdSeats() {
    throw new Error('RedBus integration provider is not configured.');
  }

  async confirmBooking() {
    throw new Error('RedBus integration provider is not configured.');
  }

  async cancelBooking() {
    throw new Error('RedBus integration provider is not configured.');
  }
}

module.exports = new RedBusProvider();

