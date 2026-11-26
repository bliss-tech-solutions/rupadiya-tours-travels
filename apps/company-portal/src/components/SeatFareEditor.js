'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  Layers, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  CheckSquare, 
  Square, 
  Calendar,
  Lock,
  Clock,
  Bus
} from 'lucide-react';
import { api } from '../lib/api';

export default function SeatFareEditor({ tripId, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  // Selection & Price adjustment state
  const [selectedSeats, setSelectedSeats] = useState(new Set());
  const [mode, setMode] = useState('SET'); // 'SET' | 'INCREASE' | 'DECREASE'
  const [valueType, setValueType] = useState('AMOUNT'); // 'AMOUNT' | 'PERCENT'
  const [inputValue, setInputValue] = useState('');
  const [selectedTripIds, setSelectedTripIds] = useState(new Set());
  const [activeDeck, setActiveDeck] = useState('ALL'); // 'ALL' | 'LOWER' | 'UPPER'

  useEffect(() => {
    loadSeatFares();
  }, [tripId]);

  async function loadSeatFares() {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getSeatFares(tripId);
      if (res && res.success) {
        setData(res);
        if (res.trip?.baseFare) {
          setInputValue(String(res.trip.baseFare));
        }
      } else {
        setError(res?.error || 'Failed to load seat fare data.');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to server.');
    } finally {
      setLoading(false);
    }
  }

  const seats = data?.seats || [];
  const lowerSeats = useMemo(() => seats.filter(s => (s.deck || 'LOWER').toUpperCase() === 'LOWER'), [seats]);
  const upperSeats = useMemo(() => seats.filter(s => (s.deck || '').toUpperCase() === 'UPPER'), [seats]);
  const hasUpperDeck = upperSeats.length > 0;
  // Sleeper coaches have berths (L/U prefixes or an upper deck); seater coaches are a flat 2+2 grid.
  const isSleeper = useMemo(
    () => hasUpperDeck || seats.some(s => /^[LU]/i.test(String(s.seatNumber))),
    [seats, hasUpperDeck]
  );

  // Group a deck's seats into rows → columns (A,B | aisle | C,D), matching the real bus layout.
  const rowsOf = (deckSeats) => {
    const m = new Map();
    deckSeats.forEach((s) => {
      const r = s.row ?? 0;
      if (!m.has(r)) m.set(r, {});
      m.get(r)[String(s.column || '').toUpperCase()] = s;
    });
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([row, cols]) => ({ row, cols }));
  };

  // Filtered seats based on active deck tab
  const visibleSeats = useMemo(() => {
    if (activeDeck === 'LOWER') return lowerSeats;
    if (activeDeck === 'UPPER') return upperSeats;
    return seats;
  }, [activeDeck, lowerSeats, upperSeats, seats]);

  // Selection handlers
  const toggleSeat = (seat) => {
    if (seat.status === 'BOOKED') return;
    setSelectedSeats(prev => {
      const next = new Set(prev);
      if (next.has(seat.seatNumber)) {
        next.delete(seat.seatNumber);
      } else {
        next.add(seat.seatNumber);
      }
      return next;
    });
  };

  const selectAll = () => {
    const available = seats.filter(s => s.status !== 'BOOKED').map(s => s.seatNumber);
    setSelectedSeats(new Set(available));
  };

  const selectUpper = () => {
    const availableUpper = upperSeats.filter(s => s.status !== 'BOOKED').map(s => s.seatNumber);
    setSelectedSeats(new Set(availableUpper));
  };

  const selectLower = () => {
    const availableLower = lowerSeats.filter(s => s.status !== 'BOOKED').map(s => s.seatNumber);
    setSelectedSeats(new Set(availableLower));
  };

  const clearSelection = () => {
    setSelectedSeats(new Set());
  };

  const toggleSiblingTrip = (id) => {
    setSelectedTripIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllSiblings = () => {
    if (selectedTripIds.size === (data?.otherTrips || []).length) {
      setSelectedTripIds(new Set());
    } else {
      setSelectedTripIds(new Set((data?.otherTrips || []).map(t => t._id)));
    }
  };

  // Preview calculations
  const numVal = parseFloat(inputValue) || 0;
  const previewChanges = useMemo(() => {
    if (!selectedSeats.size || !(numVal > 0)) return [];

    return seats
      .filter(s => selectedSeats.has(s.seatNumber) && s.status !== 'BOOKED')
      .map(s => {
        let after = s.fare;
        if (mode === 'SET') {
          after = valueType === 'PERCENT' ? Math.round(s.fare * (numVal / 100)) : numVal;
        } else if (mode === 'INCREASE') {
          after = valueType === 'PERCENT' ? Math.round(s.fare * (1 + numVal / 100)) : s.fare + numVal;
        } else if (mode === 'DECREASE') {
          after = valueType === 'PERCENT' ? Math.round(s.fare * (1 - numVal / 100)) : s.fare - numVal;
        }
        after = Math.max(1, Math.min(Math.round(after), data?.maxFare || s.fare * 5));
        return {
          seatNumber: s.seatNumber,
          deck: s.deck,
          before: s.fare,
          after,
          diff: after - s.fare
        };
      });
  }, [selectedSeats, mode, valueType, numVal, seats, data]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSeats.size) {
      setError('Please select at least one seat to modify its price.');
      return;
    }
    if (!(numVal > 0)) {
      setError('Please enter a valid positive number for the price adjustment.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        seatNumbers: Array.from(selectedSeats),
        mode,
        value: numVal,
        valueType,
        applyToTripIds: Array.from(selectedTripIds)
      };

      const res = await api.updateSeatFares(tripId, payload);
      if (res && res.success) {
        if (onSaved) {
          onSaved(res.message);
        }
        onClose();
      } else {
        setError(res?.error || 'Failed to update seat prices.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while saving seat prices.');
    } finally {
      setSubmitting(false);
    }
  };

  // One seat/berth tile in the layout. Keeps the same selected / booked / held colours.
  const renderTile = (seat) => {
    if (!seat) return <div className={isSleeper ? 'w-[72px] h-11' : 'w-12 h-12'} />;
    const isSelected = selectedSeats.has(seat.seatNumber);
    const isBooked = seat.status === 'BOOKED';
    const isHeld = seat.status === 'HELD';
    return (
      <button
        type="button"
        key={seat.seatNumber}
        onClick={() => toggleSeat(seat)}
        disabled={isBooked}
        title={`Seat ${seat.seatNumber} · ₹${seat.fare}`}
        className={`relative ${isSleeper ? 'w-[72px] h-11 rounded-lg' : 'w-12 h-12 rounded-xl'} border flex flex-col items-center justify-center transition select-none ${
          isBooked
            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-70'
            : isHeld
            ? 'bg-amber-50 border-amber-300 text-amber-700 cursor-not-allowed'
            : isSelected
            ? 'bg-indigo-600 border-indigo-700 text-white shadow-md shadow-indigo-500/20 cursor-pointer'
            : 'bg-white border-slate-200 text-slate-800 hover:border-indigo-300 hover:shadow-sm cursor-pointer'
        }`}
      >
        <span className="text-[11px] font-black leading-none">{seat.seatNumber}</span>
        <span className={`text-[9px] font-bold leading-tight ${isSelected ? 'text-indigo-100' : isBooked ? 'text-slate-400' : 'text-emerald-700'}`}>
          {isBooked ? 'Booked' : `₹${seat.fare}`}
        </span>
        {isSelected && <Check className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-indigo-600 text-white rounded-full stroke-[3]" />}
        {isBooked && <Lock className="absolute top-0.5 right-0.5 w-2.5 h-2.5 text-slate-400" />}
      </button>
    );
  };

  // A row = [A, B] · aisle · [C, D]; missing columns render as empty spacers (so 2+1 sleeper = 1+2).
  const renderDeck = (label, deckSeats) => {
    const rows = rowsOf(deckSeats);
    if (!rows.length) return null;
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-3 flex-1 min-w-[230px]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">{label}</span>
          <Bus className="w-3.5 h-3.5 text-slate-300" />
        </div>
        <div className="space-y-1.5">
          {rows.map(({ row, cols }) => (
            <div key={row} className="flex items-center justify-center gap-1.5">
              {renderTile(cols.A)}
              {renderTile(cols.B)}
              <div className="w-4" />
              {renderTile(cols.C)}
              {renderTile(cols.D)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Dynamic Seat Pricing</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Company Owner Only
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {data?.trip?.fromCity && data?.trip?.toCity
                  ? `${data.trip.fromCity} ➔ ${data.trip.toCity} · Base Fare: ₹${data.trip.baseFare}`
                  : 'Adjust individual or multi-seat prices to maximize occupancy'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-3 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 font-semibold">{error}</div>
            </div>
          )}

          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-xs font-medium">Loading seat chart and pricing parameters...</p>
            </div>
          ) : !data?.editable ? (
            <div className="py-16 text-center text-slate-500 space-y-3">
              <Lock className="w-10 h-10 text-amber-500 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">Seat Pricing Locked</h3>
              <p className="text-xs max-w-md mx-auto text-slate-500">
                {data?.lockedReason || 'This trip cannot be modified because it has departed or its chart is prepared.'}
              </p>
            </div>
          ) : (
            <>
              {/* Quick Select & Deck Filter Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">Select:</span>
                  <button
                    type="button"
                    onClick={selectAll}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition"
                  >
                    All Available
                  </button>
                  {hasUpperDeck && (
                    <>
                      <button
                        type="button"
                        onClick={selectLower}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition"
                      >
                        All Lower
                      </button>
                      <button
                        type="button"
                        onClick={selectUpper}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition"
                      >
                        All Upper
                      </button>
                    </>
                  )}
                  {selectedSeats.size > 0 && (
                    <button
                      type="button"
                      onClick={clearSelection}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 transition"
                    >
                      Clear ({selectedSeats.size})
                    </button>
                  )}
                </div>

                {hasUpperDeck && (
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setActiveDeck('ALL')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${activeDeck === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      Both Decks
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDeck('LOWER')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${activeDeck === 'LOWER' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      Lower ({lowerSeats.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDeck('UPPER')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${activeDeck === 'UPPER' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      Upper ({upperSeats.length})
                    </button>
                  </div>
                )}
              </div>

              {/* Interactive Seat Chart Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600 px-1">
                  <span>Interactive Seat Map (Click to Select / Deselect)</span>
                  <span className="text-indigo-600 font-semibold">{selectedSeats.size} seat{selectedSeats.size === 1 ? '' : 's'} selected</span>
                </div>

                <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-3xl overflow-x-auto">
                  {/* Driver / front of the bus */}
                  <div className="flex items-center justify-between max-w-[520px] mx-auto mb-2 px-1 text-[10px] font-bold text-slate-400">
                    <span className="inline-flex items-center gap-1">{isSleeper ? '2+1 Sleeper' : '2+2 Seater'} · {data?.trip?.bus?.busType || ''}</span>
                    <span className="inline-flex items-center gap-1"><Bus className="w-3.5 h-3.5" /> Front</span>
                  </div>
                  <div className={`flex ${isSleeper ? 'flex-col sm:flex-row' : ''} gap-4 justify-center min-w-[260px]`}>
                    {(activeDeck === 'UPPER'
                      ? [['Upper deck', upperSeats]]
                      : activeDeck === 'LOWER'
                      ? [['Lower deck', lowerSeats]]
                      : isSleeper
                      ? [['Lower deck', lowerSeats], ...(hasUpperDeck ? [['Upper deck', upperSeats]] : [])]
                      : [['Seater coach (2+2)', lowerSeats]]
                    ).map(([label, deckSeats]) => (
                      <React.Fragment key={label}>{renderDeck(label, deckSeats)}</React.Fragment>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-4 text-[11px] text-slate-500 px-2">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-white border border-slate-300 inline-block"></span> Available
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-indigo-600 inline-block"></span> Selected
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-slate-200 inline-block"></span> Booked (Locked)
                  </span>
                </div>
              </div>

              {/* Price Change Control Panel */}
              <div className="p-5 bg-gradient-to-br from-indigo-50/50 to-slate-50 rounded-3xl border border-indigo-100 space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-indigo-600" />
                  Price Adjustment Formula
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Mode */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Adjustment Action</label>
                    <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setMode('SET')}
                        className={`py-1.5 rounded-lg text-xs font-bold transition ${mode === 'SET' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        Set Exact
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode('INCREASE')}
                        className={`py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-0.5 ${mode === 'INCREASE' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        <TrendingUp className="w-3 h-3" /> +Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode('DECREASE')}
                        className={`py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-0.5 ${mode === 'DECREASE' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        <TrendingDown className="w-3 h-3" /> −Less
                      </button>
                    </div>
                  </div>

                  {/* Value Type */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Unit</label>
                    <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setValueType('AMOUNT')}
                        className={`py-1.5 rounded-lg text-xs font-bold transition ${valueType === 'AMOUNT' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        ₹ Rupees
                      </button>
                      <button
                        type="button"
                        onClick={() => setValueType('PERCENT')}
                        className={`py-1.5 rounded-lg text-xs font-bold transition ${valueType === 'PERCENT' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        % Percent
                      </button>
                    </div>
                  </div>

                  {/* Input value */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      {mode === 'SET' ? 'New Price' : 'Adjustment Value'} ({valueType === 'AMOUNT' ? '₹' : '%'})
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={data?.maxFare || 10000}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder={valueType === 'AMOUNT' ? 'e.g. 1450' : 'e.g. 15'}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Live Old -> New Preview */}
                {previewChanges.length > 0 && (
                  <div className="p-3 bg-white rounded-2xl border border-indigo-100 text-xs">
                    <div className="font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Impact Preview ({previewChanges.length} seats):</span>
                      <span className="text-[11px] text-slate-400 font-normal">Fares clamped between ₹1 and ₹{data?.maxFare}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pt-1">
                      {previewChanges.map(c => (
                        <span key={c.seatNumber} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px]">
                          <strong className="text-slate-800">{c.seatNumber}</strong>: 
                          <span className="line-through text-slate-400">₹{c.before}</span>
                          ➔
                          <strong className="text-emerald-700 font-extrabold">₹{c.after}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sibling Trips Multi-Apply Option */}
              {data?.otherTrips?.length > 0 && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                        Also apply this pricing rule to upcoming trips?
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Applies the same seat prices to trips scheduled on the same bus and route.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={selectAllSiblings}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      {selectedTripIds.size === data.otherTrips.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1">
                    {data.otherTrips.map(ot => {
                      const isChecked = selectedTripIds.has(ot._id);
                      const d = new Date(ot.departureTime);
                      const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' });
                      const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

                      return (
                        <div
                          key={ot._id}
                          onClick={() => toggleSiblingTrip(ot._id)}
                          className={`p-2 rounded-xl border text-xs flex items-center gap-2 cursor-pointer transition ${
                            isChecked ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300 shrink-0" />
                          )}
                          <div className="truncate">
                            <div>{dateStr} · {timeStr}</div>
                            <div className="text-[10px] text-slate-400 font-normal">
                              From ₹{ot.minFare} · {ot.bookedSeats} booked
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            {selectedSeats.size > 0 && previewChanges.length > 0 ? (
              <span>Ready to update <strong className="text-slate-800">{selectedSeats.size}</strong> seats{selectedTripIds.size ? ` on ${selectedTripIds.size + 1} trips` : ''}.</span>
            ) : (
              <span>Select seats to change prices.</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/80 transition"
            >
              Cancel
            </button>
            {data?.editable && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !selectedSeats.size || !(numVal > 0)}
                className="px-6 py-2 rounded-xl text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Seat Prices</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
