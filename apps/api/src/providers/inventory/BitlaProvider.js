const InventoryProvider = require('./InventoryProvider');

class BitlaProvider extends InventoryProvider {
  constructor() {
    super();
    this.name = 'bitla';
  }

  async searchTrips() {
    throw new Error('Bitla software integration provider is not configured. Partner API key and access contract pending.');
  }

  async getSeatLayout() {
    throw new Error('Bitla software integration provider is not configured.');
  }

  async holdSeats() {
    throw new Error('Bitla software integration provider is not configured.');
  }

  async confirmBooking() {
    throw new Error('Bitla software integration provider is not configured.');
  }

  async cancelBooking() {
    throw new Error('Bitla software integration provider is not configured.');
  }
}

module.exports = new BitlaProvider();

