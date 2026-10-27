'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Bus, 
  MapPin, 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  Wallet, 
  CheckCircle2, 
  AlertCircle,
  CreditCard,
  ArrowRight,
  ShieldCheck,
  Check,
  Ticket
} from 'lucide-react';
import { api } from '../../lib/api';

const HUB_CITY = { id: 'rupadiya', name: 'Rupadiya' };
const SPOKE_CITIES = [
  { id: 'ahmedabad', name: 'Ahmedabad' },
  { id: 'vadodara', name: 'Vadodara' },
  { id: 'surat', name: 'Surat' },
  { id: 'bangalore', name: 'Bengaluru' },
  { id: 'hyderabad', name: 'Hyderabad' },
  { id: 'mumbai', name: 'Mumbai' },
];

export default function AgentBookingTerminalPage() {
  const [wallet, setWallet] = useState(null);
  const [fromCity, setFromCity] = useState('rupadiya');
  const [toCity, setToCity] = useState('ahmedabad');
  const [departureDate, setDepartureDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  const [trips, setTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  
  // Passenger info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerGender, setCustomerGender] = useState('male');
  const [customerAge, setCustomerAge] = useState('28');

  // Payment
  const [paymentMethod, setPaymentMethod] = useState('agent_wallet'); // 'agent_wallet' | 'online'
  const [bookingStatus, setBookingStatus] = useState(null); // null | 'success' | 'error'
  const [confirmedBooking, setConfirmedBooking] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    async function loadWallet() {
      try {
        if (typeof api.getMyWallet === 'function') {
          const res = await api.getMyWallet();
          const wData = res.data || res.wallet || { balance: res.balance || 0 };
          if (wData.balance == null && wData.availableBalance != null) {
            wData.balance = wData.availableBalance;
          }
          setWallet(wData);
        }
      } catch (e) {}
    }
    loadWallet();
  }, []);

  const handleSearchTrips = async (e) => {
    e?.preventDefault();
    setLoadingTrips(true);
    setSelectedTrip(null);
    setSelectedSeats([]);
    try {
      const res = await api.searchTrips(fromCity, toCity, departureDate);
      setTrips(res.data || []);
      if (res.data?.length > 0) {
        setSelectedTrip(res.data[0]);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error fetching trips');
    } finally {
      setLoadingTrips(false);
    }
  };

  useEffect(() => {
    handleSearchTrips();
  }, []);

  const baseFare = selectedTrip?.baseFare || 1650;
  const totalAmount = selectedSeats.length * baseFare;
  const estimatedCommission = Math.round(totalAmount * 0.05); // 5% direct commission

  const handleSeatClick = (seat) => {
    if (seat.status === 'BOOKED') return;
    const num = seat.seatNumber;
    if (selectedSeats.includes(num)) {
      setSelectedSeats(prev => prev.filter(s => s !== num));
    } else {
      if (selectedSeats.length >= 4) return;
      setSelectedSeats(prev => [...prev, num]);
    }
  };

  const handleBookTicket = async (e) => {
    e.preventDefault();
    if (selectedSeats.length === 0) {
      setErrorMsg('Please select at least one seat.');
      return;
    }
    if (!customerName.trim() || !customerPhone.trim()) {
      setErrorMsg('Please enter customer full name and phone number.');
      return;
    }

    if (paymentMethod === 'agent_wallet' && wallet && wallet.balance < totalAmount) {
      setErrorMsg(`Insufficient wallet balance. You have ₹${wallet.balance}, but booking total is ₹${totalAmount}.`);
      return;
    }

    setProcessing(true);
    setErrorMsg('');

    try {
      const holdRes = await api.holdSeats(selectedTrip._id, selectedSeats, {
        customerName,
        customerPhone,
      });

      const holdId = holdRes.data?.holdId || holdRes.data?._id;

      const payload = {
        holdId,
        tripId: selectedTrip._id,
        selectedSeats,
        passengers: selectedSeats.map((seatNum, idx) => ({
          seatNumber: seatNum,
          name: idx === 0 ? customerName : `${customerName} Companion ${idx + 1}`,
          age: parseInt(customerAge, 10) || 28,
          gender: customerGender,
        })),
        boardingPoint: selectedTrip.boardingPoints?.[0] || {
          name: 'Rupadiya Border Main Stand',
          landmark: 'Platform 1',
          time: selectedTrip.departureTime,
        },
        droppingPoint: selectedTrip.droppingPoints?.[0] || {
          name: 'Destination Central Stand',
          landmark: 'Platform 2',
          time: selectedTrip.arrivalTime,
        },
        primaryContact: {
          phone: customerPhone,
          email: 'walkin@rupadiya.test',
        },
        paymentProvider: paymentMethod === 'agent_wallet' ? 'agent_wallet' : 'dummy',
        totalAmount,
      };

      const confirmRes = await api.bookForCustomer(payload);
      setConfirmedBooking(confirmRes.data?.booking || confirmRes.data);
      setBookingStatus('success');

      // Refresh wallet balance
      if (typeof api.getMyWallet === 'function') {
        const wRes = await api.getMyWallet();
        const wData = wRes.data || wRes.wallet || { balance: wRes.balance || 0 };
        if (wData.balance == null && wData.availableBalance != null) {
          wData.balance = wData.availableBalance;
        }
        setWallet(wData);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to complete booking.');
      setBookingStatus('error');
    } finally {
      setProcessing(false);
    }
  };

  if (bookingStatus === 'success' && confirmedBooking) {
    return (
      <div className="max-w-xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block mb-1">
            Ticket Issued Successfully!
          </span>
          <h2 className="text-2xl font-black text-white">
            Booking ID: #{confirmedBooking.bookingId}
          </h2>
          <p className="text-xs text-slate-400 mt-2">
            Payment paid via <strong>{paymentMethod === 'agent_wallet' ? 'Agent Wallet Balance' : 'Online'}</strong>.
            Instant ₹{estimatedCommission} commission credited to your wallet!
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-400">Customer:</span>
            <span className="font-bold text-white">{customerName} ({customerPhone})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Corridor:</span>
            <span className="font-bold text-white">{fromCity} → {toCity}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Seats:</span>
            <span className="font-bold text-emerald-400">{selectedSeats.join(', ')}</span>
          </div>
          <div className="flex justify-between border-t border-slate-800 pt-2 text-sm font-black">
            <span className="text-white">Total Deducted:</span>
            <span className="text-emerald-400">₹{totalAmount}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              setBookingStatus(null);
              setSelectedSeats([]);
              setCustomerName('');
              setCustomerPhone('');
            }}
            className="flex-1 py-3 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
          >
            Book Another Customer
          </button>
          <Link
            href="/wallet"
            className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-200 font-bold text-xs"
          >
            Check Wallet Ledger
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Ticket className="w-3.5 h-3.5" />
            <span>Agent Walk-in Terminal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Book Customer Tickets</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Select Rupadiya corridors, hold seats, and pay instantly via Agent Wallet or Online Gateway.
          </p>
        </div>

        {/* Live Wallet Balance Pill */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Wallet Balance
            </span>
            <span className="text-lg font-black text-emerald-400">
              ₹{wallet?.balance != null ? wallet.balance.toLocaleString() : '15,000'}
            </span>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Terminal Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Route Selector & Bus Trips */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Corridor Selection Form */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Step 1: Choose Corridor & Date
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">From</label>
                <select
                  value={fromCity}
                  onChange={(e) => {
                    const newFrom = e.target.value;
                    setFromCity(newFrom);
                    if (newFrom !== 'rupadiya') setToCity('rupadiya');
                    else setToCity('ahmedabad');
                  }}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white"
                >
                  <option value="rupadiya">Rupadiya (Hub)</option>
                  {SPOKE_CITIES.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">To</label>
                <select
                  value={toCity}
                  onChange={(e) => setToCity(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white"
                >
                  {fromCity === 'rupadiya' ? (
                    SPOKE_CITIES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                  ) : (
                    <option value="rupadiya">Rupadiya (Hub)</option>
                  )}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Date</label>
                <input
                  type="date"
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white"
                />
              </div>
            </div>

            <button
              onClick={handleSearchTrips}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition"
            >
              Search Departures
            </button>
          </div>

          {/* Available Buses */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Step 2: Select Scheduled Departure
            </h3>

            {loadingTrips ? (
              <div className="py-6 text-center text-xs text-slate-500">Loading trips...</div>
            ) : trips.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">No scheduled departures found.</div>
            ) : (
              <div className="space-y-2.5">
                {trips.map((t) => {
                  const isSelected = selectedTrip?._id === t._id;
                  const depTime = new Date(t.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div
                      key={t._id}
                      onClick={() => { setSelectedTrip(t); setSelectedSeats([]); }}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500'
                          : 'border-slate-800 hover:border-slate-700 bg-slate-950'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-emerald-400 font-bold">
                          <Bus className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">{t.bus?.name || 'Rupadiya Intercity'}</div>
                          <div className="text-[10px] text-slate-400">{t.bus?.busType} · Departure: {depTime}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-black text-emerald-400">₹{t.baseFare || 1650}</span>
                        <span className="text-[10px] text-slate-400 block font-medium">per seat</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Seat Map for Selected Trip */}
          {selectedTrip && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Step 3: Select Seats (2+2 Layout)
                </h3>
                <span className="text-[10px] text-emerald-400 font-bold">
                  {selectedSeats.length} seats selected
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2.5 max-w-xs mx-auto py-2">
                {(selectedTrip.seats || []).slice(0, 40).map((seat) => {
                  const isSelected = selectedSeats.includes(seat.seatNumber);
                  const isBooked = seat.status === 'BOOKED';

                  return (
                    <button
                      key={seat.seatNumber}
                      type="button"
                      disabled={isBooked}
                      onClick={() => handleSeatClick(seat)}
                      className={`h-10 rounded-xl font-black text-xs transition-all ${
                        isSelected
                          ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30 scale-105'
                          : isBooked
                          ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                          : 'bg-slate-950 border border-slate-700 text-slate-300 hover:border-emerald-500'
                      }`}
                    >
                      {seat.seatNumber}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Walk-in Customer Form & Payment */}
        <div className="lg:col-span-5 space-y-6">
          <form onSubmit={handleBookTicket} className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-3">
              Step 4: Customer Details & Payment
            </h3>

            {/* Customer Name */}
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">Customer Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Suresh Kumar"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Customer Phone */}
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">Customer Mobile Number *</label>
              <input
                type="tel"
                required
                placeholder="9876543210"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Gender & Age */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Gender</label>
                <select
                  value={customerGender}
                  onChange={(e) => setCustomerGender(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Age</label>
                <input
                  type="number"
                  value={customerAge}
                  onChange={(e) => setCustomerAge(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white"
                />
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <label className="text-xs font-bold text-slate-400 block">Payment Deducted From</label>
              
              {/* Agent Wallet Option */}
              <div
                onClick={() => setPaymentMethod('agent_wallet')}
                className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                  paymentMethod === 'agent_wallet'
                    ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500'
                    : 'border-slate-800 bg-slate-950'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Wallet className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="text-xs font-bold text-white">Agent Wallet Balance</div>
                    <div className="text-[10px] text-slate-400">Available: ₹{wallet?.balance != null ? wallet.balance : 15000}</div>
                  </div>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  paymentMethod === 'agent_wallet' ? 'border-emerald-500 bg-emerald-500' : 'border-slate-700'
                }`}>
                  {paymentMethod === 'agent_wallet' && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                </div>
              </div>

              {/* Online Option */}
              <div
                onClick={() => setPaymentMethod('online')}
                className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                  paymentMethod === 'online'
                    ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500'
                    : 'border-slate-800 bg-slate-950'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <CreditCard className="w-4 h-4 text-sky-400" />
                  <div>
                    <div className="text-xs font-bold text-white">Customer Online Gateway</div>
                    <div className="text-[10px] text-slate-400">UPI / Card Payment</div>
                  </div>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  paymentMethod === 'online' ? 'border-emerald-500 bg-emerald-500' : 'border-slate-700'
                }`}>
                  {paymentMethod === 'online' && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                </div>
              </div>
            </div>

            {/* Price & Immediate Commission Summary */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Seats Selected:</span>
                <span className="font-bold text-white">{selectedSeats.length > 0 ? selectedSeats.join(', ') : 'None'}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Total Ticket Price:</span>
                <span className="font-bold text-white">₹{totalAmount}</span>
              </div>
              <div className="flex justify-between text-emerald-400 font-bold border-t border-slate-800 pt-2">
                <span>Your Instant Commission Cut (5%):</span>
                <span>+₹{estimatedCommission}</span>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={processing || selectedSeats.length === 0}
              className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processing ? (
                <span>Deducting & Generating Ticket...</span>
              ) : (
                <span>Confirm & Issue Ticket (₹{totalAmount}) →</span>
              )}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
