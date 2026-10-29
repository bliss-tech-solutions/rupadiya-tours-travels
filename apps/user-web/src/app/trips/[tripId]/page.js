'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  MapPin, 
  ShieldCheck, 
  User, 
  Info, 
  AlertCircle,
  Clock,
  Sparkles,
  ChevronRight,
  Layers,
  Check
} from 'lucide-react';
import { api } from '../../../lib/api';
import { formatDate, formatTime } from '../../../lib/dateUtils';
import { useToast } from '../../../components/ui/Toast';

// SVGs for Steering Wheel and Passenger Silhouettes matching RedBus style
const SteeringWheelIcon = () => (
  <svg className="w-6 h-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="3" />
    <line x1="12" y1="2" x2="12" y2="9" />
    <line x1="4" y1="17" x2="9.5" y2="13.5" />
    <line x1="20" y1="17" x2="14.5" y2="13.5" />
  </svg>
);

const FemaleIcon = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="6" r="3" />
    <path d="M10 10h4l1.5 7h-2.5v5h-2v-5H8.5L10 10z" />
  </svg>
);

const MaleIcon = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="6" r="3" />
    <path d="M9 10h6v6h-1.5v6h-3v-6H9v-6z" />
  </svg>
);

export default function TripSeatSelectionPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const tripId = params.tripId;

  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [layoutMode, setLayoutMode] = useState('sleeper'); // 'sleeper' | 'seater'

  useEffect(() => {
    // Zero sign-in requirement for browsing and selecting seats
    async function loadTrip() {
      try {
        const res = await api.getTrip(tripId);
        setTrip(res.data);
        const bType = res.data?.bus?.busType?.toLowerCase() || '';
        const bLayout = res.data?.bus?.layoutType || '';
        const hasSleeperSeats = res.data?.seats?.some(s => s.seatNumber.startsWith('L') || s.seatNumber.startsWith('U') || s.category === 'SLEEPER');
        if (hasSleeperSeats || bLayout === '2+1' || (bType.includes('sleeper') && !bType.includes('seater'))) {
          setLayoutMode('sleeper');
        } else {
          setLayoutMode('seater');
        }
      } catch (err) {
        addToast(err.message || 'Unable to load trip', 'error');
      } finally {
        setLoading(false);
      }
    }
    loadTrip();
  }, [tripId, addToast]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50">
        <h2 className="text-xl font-bold text-slate-800">Trip not found</h2>
        <button onClick={() => router.push('/')} className="mt-4 px-5 py-2.5 bg-sky-500 text-white rounded-xl text-sm font-semibold">
          Return to search
        </button>
      </div>
    );
  }

  const seats = trip.seats || [];
  const baseFare = trip.baseFare || 510;

  // Helper to find seat data by seatNumber or index
  const findSeat = (seatId, fallbackIndex) => {
    return (
      seats.find(s => s.seatNumber === seatId) ||
      seats.find(s => s.seatNumber === String(fallbackIndex)) ||
      { seatNumber: seatId, status: 'AVAILABLE', fare: baseFare }
    );
  };

  // Sleeper Berth Pairs for Side-by-Side Validation:
  // In 1+2 sleeper: Left is single. Right has double berths:
  // Lower: (L2, L3), (L5, L6), (L8, L9), (L11, L12), (L14, L15), (L17, L18)
  // Upper: (U2, U3), (U5, U6), (U8, U9), (U11, U12), (U14, U15), (U17, U18)
  const getAdjacentSeatCode = (seatCode) => {
    if (layoutMode === 'sleeper') {
      const deck = seatCode.startsWith('U') ? 'U' : 'L';
      const num = parseInt(seatCode.replace(/\D/g, ''), 10);
      const pairMap = {
        2: 3, 3: 2,
        5: 6, 6: 5,
        8: 9, 9: 8,
        11: 12, 12: 11,
        14: 15, 15: 14,
        17: 18, 18: 17
      };
      if (pairMap[num]) {
        return `${deck}${pairMap[num]}`;
      }
      return null;
    } else {
      const num = parseInt(seatCode, 10);
      const rowOffset = (num - 1) % 4;
      if (rowOffset === 0) return (num + 1).toString();
      if (rowOffset === 1) return (num - 1).toString();
      if (rowOffset === 2) return (num + 1).toString();
      if (rowOffset === 3) return (num - 1).toString();
      return null;
    }
  };

  const areSeatsSideBySide = (seatA, seatB) => {
    if (layoutMode === 'sleeper') {
      const deckA = seatA.startsWith('U') ? 'U' : 'L';
      const deckB = seatB.startsWith('U') ? 'U' : 'L';
      if (deckA !== deckB) return false;
      const numA = parseInt(seatA.replace(/\D/g, ''), 10);
      const numB = parseInt(seatB.replace(/\D/g, ''), 10);
      const min = Math.min(numA, numB);
      const max = Math.max(numA, numB);
      return (
        (min === 2 && max === 3) ||
        (min === 5 && max === 6) ||
        (min === 8 && max === 9) ||
        (min === 11 && max === 12) ||
        (min === 14 && max === 15) ||
        (min === 17 && max === 18)
      );
    } else {
      const numA = parseInt(seatA, 10);
      const numB = parseInt(seatB, 10);
      const min = Math.min(numA, numB);
      const max = Math.max(numA, numB);
      const rowA = Math.floor((numA - 1) / 4);
      const rowB = Math.floor((numB - 1) / 4);
      if (rowA !== rowB) return false;
      const offsetMin = (min - 1) % 4;
      return (offsetMin === 0 && max === min + 1) || (offsetMin === 2 && max === min + 1);
    }
  };

  const isAdjacentToFemalePassenger = (seatNumber) => {
    const adjNum = getAdjacentSeatCode(seatNumber);
    if (!adjNum) return false;
    const adjSeat = findSeat(adjNum, parseInt(adjNum.replace(/\D/g, ''), 10) || 1);
    return adjSeat?.status === 'BOOKED' && adjSeat?.passenger?.gender === 'female';
  };

  const isAdjacentToMalePassenger = (seatNumber) => {
    const adjNum = getAdjacentSeatCode(seatNumber);
    if (!adjNum) return false;
    const adjSeat = findSeat(adjNum, parseInt(adjNum.replace(/\D/g, ''), 10) || 1);
    return adjSeat?.status === 'BOOKED' && adjSeat?.passenger?.gender === 'male';
  };

  const handleSeatClick = (seatObj, seatCode) => {
    const actualCode = seatObj?.seatNumber || seatCode;
    if (seatObj.status === 'BOOKED') {
      const isFemale = seatObj.passenger?.gender === 'female';
      addToast(`This berth is booked by a ${isFemale ? 'female' : 'male'} passenger.`, 'info', 'Berth Sold');
      return;
    }

    const isAlreadySelected = selectedSeats.includes(actualCode);

    if (isAlreadySelected) {
      setSelectedSeats(prev => prev.filter(s => s !== actualCode));
      return;
    }

    if (selectedSeats.length >= 6) {
      addToast('You can select a maximum of 6 seats per booking.', 'warning', 'Limit Reached');
      return;
    }

    // Safety policy warning for female adjacent seat
    if (isAdjacentToFemalePassenger(actualCode)) {
      addToast(
        `Seat ${actualCode} is adjacent to an already booked female passenger. Female traveler preference will apply.`,
        'info',
        'Adjacent Female Policy'
      );
    }

    setSelectedSeats(prev => [...prev, actualCode]);
  };

  // Proceed to Boarding & Dropping Points selection (No prices or hold timer yet!)
  const handleProceed = () => {
    if (selectedSeats.length === 0) {
      addToast('Please select at least one seat to proceed.', 'warning', 'Select Seats');
      return;
    }

    const flowData = {
      tripId,
      trip,
      selectedSeats,
      baseFare,
      totalPrice: selectedSeats.length * baseFare,
      routeLabel: `${trip.route?.fromCity?.name || 'Rupadiya'} → ${trip.route?.toCity?.name || 'Ahmedabad'}`
    };

    sessionStorage.setItem('rupadiya_booking_flow', JSON.stringify(flowData));
    sessionStorage.setItem('rupadiya_checkout', JSON.stringify(flowData));
    router.push(`/boarding-points/${tripId}`);
  };

  // 6 Rows Sleeper Definition (1+2 per row)
  const sleeperRows = [
    { rowIdx: 1, lowerLeft: 'L1', lowerRight: ['L2', 'L3'], upperLeft: 'U1', upperRight: ['U2', 'U3'] },
    { rowIdx: 2, lowerLeft: 'L4', lowerRight: ['L5', 'L6'], upperLeft: 'U4', upperRight: ['U5', 'U6'] },
    { rowIdx: 3, lowerLeft: 'L7', lowerRight: ['L8', 'L9'], upperLeft: 'U7', upperRight: ['U8', 'U9'] },
    { rowIdx: 4, lowerLeft: 'L10', lowerRight: ['L11', 'L12'], upperLeft: 'U10', upperRight: ['U11', 'U12'] },
    { rowIdx: 5, lowerLeft: 'L13', lowerRight: ['L14', 'L15'], upperLeft: 'U13', upperRight: ['U14', 'U15'] },
    { rowIdx: 6, lowerLeft: 'L16', lowerRight: ['L17', 'L18'], upperLeft: 'U16', upperRight: ['U17', 'U18'] },
  ];

  // Seater 10 Rows (2+2)
  const seaterRows = [];
  const alphabet = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  for (let r = 0; r < 10; r++) {
    const s1Code = String(r * 4 + 1);
    const s2Code = String(r * 4 + 2);
    const s3Code = String(r * 4 + 3);
    const s4Code = String(r * 4 + 4);
    seaterRows.push({
      rowLetter: alphabet[r],
      left: [s1Code, s2Code],
      right: [s3Code, s4Code]
    });
  }

  // Helper to render individual sleeper berth matching Image 1
  const renderSleeperBerth = (berthCode, fallbackNum) => {
    const seatObj = findSeat(berthCode, fallbackNum);
    const actualSeatCode = seatObj.seatNumber || berthCode;
    const isBooked = seatObj.status === 'BOOKED';
    const isBookedFemale = isBooked && seatObj.passenger?.gender === 'female';
    const isBookedMale = isBooked && !isBookedFemale;
    const isSelected = selectedSeats.includes(actualSeatCode) || selectedSeats.includes(berthCode);
    const isAdjFemale = !isBooked && (isAdjacentToFemalePassenger(actualSeatCode) || isAdjacentToFemalePassenger(berthCode));
    const isAdjMale = !isBooked && (isAdjacentToMalePassenger(actualSeatCode) || isAdjacentToMalePassenger(berthCode));

    let containerStyle = '';
    let pillowStyle = '';
    let label = `₹${baseFare}`;
    let isSold = false;

    if (isSelected) {
      containerStyle = 'bg-emerald-600 border-2 border-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-400';
      pillowStyle = 'bg-white/80';
      label = actualSeatCode;
    } else if (isBookedFemale) {
      containerStyle = 'bg-pink-100 border border-pink-200 cursor-not-allowed';
      pillowStyle = 'bg-pink-200';
      label = 'Sold';
      isSold = true;
    } else if (isBookedMale) {
      containerStyle = 'bg-indigo-50 border border-indigo-200 cursor-not-allowed';
      pillowStyle = 'bg-indigo-200';
      label = 'Sold';
      isSold = true;
    } else if (isAdjFemale) {
      containerStyle = 'bg-white border-2 border-pink-500 hover:bg-pink-50/40 text-pink-500';
      pillowStyle = 'bg-pink-100';
    } else if (isAdjMale) {
      containerStyle = 'bg-white border-2 border-blue-500 hover:bg-blue-50/40 text-blue-500';
      pillowStyle = 'bg-blue-100';
    } else {
      // Available
      containerStyle = 'bg-white border-2 border-emerald-600 hover:border-emerald-700 hover:bg-emerald-50/20';
      pillowStyle = 'bg-emerald-100';
    }

    return (
      <div key={actualSeatCode} className="flex flex-col items-center">
        <button
          type="button"
          onClick={() => handleSeatClick(seatObj, actualSeatCode)}
          disabled={isBooked}
          className={`w-11 sm:w-12 h-20 sm:h-22 rounded-lg flex flex-col items-center justify-between py-2 transition-all relative ${containerStyle}`}
          title={`${actualSeatCode} · ${isBooked ? 'Booked' : isSelected ? 'Selected' : 'Available'}`}
        >
          {/* Top of berth / occupant icon */}
          <div className="pt-1 flex items-center justify-center">
            {isBookedFemale && <FemaleIcon className="w-3.5 h-3.5 text-pink-400" />}
            {isBookedMale && <MaleIcon className="w-3.5 h-3.5 text-indigo-400" />}
            {isAdjFemale && !isSelected && <FemaleIcon className="w-3.5 h-3.5 text-pink-500" />}
            {isAdjMale && !isSelected && <MaleIcon className="w-3.5 h-3.5 text-blue-500" />}
            {isSelected && <Check className="w-4 h-4 text-white stroke-[3]" />}
          </div>

          {/* Bottom Headrest/Pillow bar matching Image 1 */}
          <div className={`w-6 sm:w-7 h-1.5 rounded-full ${pillowStyle}`} />
        </button>

        {/* Fare or Sold tag below berth */}
        <span className={`text-[11px] mt-1 font-semibold select-none ${
          isSold ? 'text-slate-400' : isSelected ? 'text-emerald-700 font-bold' : 'text-slate-500'
        }`}>
          {label}
        </span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-28">
      {/* Top Navbar Header */}
      <div className="sticky top-0 md:top-20 z-30 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-full hover:bg-slate-100 transition text-slate-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <h1 className="text-base font-bold text-slate-900">
              {trip.bus?.name || 'Rupadiya Intercity Express'}
            </h1>
            <p className="text-[11px] text-slate-500">
              {trip.departureTime ? formatDate(trip.departureTime, 'medium') + ' · ' : ''}
              {trip.bus?.busType || 'AC Sleeper 2+1'} · Step 1: Select Seats
            </p>
          </div>
          
          {/* Coach View Toggle Button */}
          <button
            onClick={() => setLayoutMode(prev => prev === 'sleeper' ? 'seater' : 'sleeper')}
            className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1"
            title="Toggle between Sleeper & Seater Coach View"
          >
            <Layers className="w-3.5 h-3.5 text-sky-500" />
            <span className="hidden sm:inline">{layoutMode === 'sleeper' ? 'Sleeper View' : 'Seater View'}</span>
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column (7 cols): Coach Decks & Know Your Seat Types Legend */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* SLEEPER 2-DECK LAYOUT (Image 1) */}
            {layoutMode === 'sleeper' ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-7 shadow-sm">
                
                {/* 2 Decks Side-by-Side Container */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  
                  {/* LOWER DECK (with steering wheel at top right) */}
                  <div className="bg-[#f8f9fa] border border-slate-200/90 rounded-2xl p-4 sm:p-5">
                    <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
                      <h3 className="text-sm font-bold text-slate-900">Lower deck</h3>
                      <div className="flex items-center gap-1.5" title="Driver Cabin">
                        <SteeringWheelIcon />
                      </div>
                    </div>

                    {/* 6 Rows: 1 Berth on left, Aisle, 2 Berths on right */}
                    <div className="space-y-3.5">
                      {sleeperRows.map((row) => (
                        <div key={`lower-row-${row.rowIdx}`} className="flex items-center justify-between gap-2">
                          {/* Single Berth Left */}
                          <div>
                            {renderSleeperBerth(row.lowerLeft, (row.rowIdx - 1) * 3 + 1)}
                          </div>

                          {/* Aisle Walkway */}
                          <div className="w-4 sm:w-6" />

                          {/* Double Berths Right */}
                          <div className="flex items-center gap-2">
                            {row.lowerRight.map((bCode, idx) => 
                              renderSleeperBerth(bCode, (row.rowIdx - 1) * 3 + 2 + idx)
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* UPPER DECK */}
                  <div className="bg-[#f8f9fa] border border-slate-200/90 rounded-2xl p-4 sm:p-5">
                    <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
                      <h3 className="text-sm font-bold text-slate-900">Upper deck</h3>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                        Top Berth
                      </span>
                    </div>

                    {/* 6 Rows: 1 Berth on left, Aisle, 2 Berths on right */}
                    <div className="space-y-3.5">
                      {sleeperRows.map((row) => (
                        <div key={`upper-row-${row.rowIdx}`} className="flex items-center justify-between gap-2">
                          {/* Single Berth Left */}
                          <div>
                            {renderSleeperBerth(row.upperLeft, 18 + (row.rowIdx - 1) * 3 + 1)}
                          </div>

                          {/* Aisle Walkway */}
                          <div className="w-4 sm:w-6" />

                          {/* Double Berths Right */}
                          <div className="flex items-center gap-2">
                            {row.upperRight.map((bCode, idx) => 
                              renderSleeperBerth(bCode, 18 + (row.rowIdx - 1) * 3 + 2 + idx)
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* 2-Seat Side-by-Side Status Notice */}
                {selectedSeats.length === 2 && (
                  <div className={`mt-6 p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 ${
                    areSeatsSideBySide(selectedSeats[0], selectedSeats[1])
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}>
                    <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                    <span>
                      {areSeatsSideBySide(selectedSeats[0], selectedSeats[1])
                        ? `Berths [${selectedSeats.join(', ')}] are side-by-side. Eligible for mixed male & female booking.`
                        : `Berths [${selectedSeats.join(', ')}] are not side-by-side. Under safety policy, separated berths must be booked for the same gender (Male with Male, or Female with Female).`}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              /* SEATER 2+2 COACH LAYOUT */
              <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Seater Coach (2+2)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">
                    <span>Driver Cabin</span>
                    <SteeringWheelIcon />
                  </div>
                </div>

                <div className="space-y-3.5">
                  {seaterRows.map((row) => (
                    <div key={row.rowLetter} className="flex items-center justify-between">
                      {/* Left 2 Seats */}
                      <div className="flex items-center gap-2 sm:gap-3">
                        {row.left.map((sCode) => {
                          const sObj = findSeat(sCode, parseInt(sCode, 10));
                          const actualCode = sObj.seatNumber || sCode;
                          const isBooked = sObj.status === 'BOOKED';
                          const isBookedFemale = isBooked && sObj.passenger?.gender === 'female';
                          const isBookedMale = isBooked && !isBookedFemale;
                          const isSelected = selectedSeats.includes(actualCode);
                          const isFemaleAdj = !isBooked && isAdjacentToFemalePassenger(actualCode);

                          let sClass = '';
                          if (isSelected) {
                            sClass = 'bg-emerald-600 text-white font-bold ring-2 ring-emerald-400 shadow-md';
                          } else if (isBookedFemale) {
                            sClass = 'bg-pink-100 text-pink-700 border-2 border-pink-300 cursor-not-allowed';
                          } else if (isBookedMale) {
                            sClass = 'bg-indigo-50 text-indigo-700 border-2 border-indigo-200 cursor-not-allowed';
                          } else if (isFemaleAdj) {
                            sClass = 'bg-white border-2 border-pink-500 text-pink-600 hover:bg-pink-50';
                          } else {
                            sClass = 'bg-white border-2 border-emerald-600 text-slate-800 hover:bg-slate-50';
                          }

                          return (
                            <button
                              key={actualCode}
                              onClick={() => handleSeatClick(sObj, actualCode)}
                              disabled={isBooked}
                              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${sClass}`}
                            >
                              {actualCode}
                            </button>
                          );
                        })}
                      </div>

                      {/* Row Letter */}
                      <span className="text-xs font-black text-slate-300 w-6 text-center select-none">
                        {row.rowLetter}
                      </span>

                      {/* Right 2 Seats */}
                      <div className="flex items-center gap-2 sm:gap-3">
                        {row.right.map((sCode) => {
                          const sObj = findSeat(sCode, parseInt(sCode, 10));
                          const actualCode = sObj.seatNumber || sCode;
                          const isBooked = sObj.status === 'BOOKED';
                          const isBookedFemale = isBooked && sObj.passenger?.gender === 'female';
                          const isBookedMale = isBooked && !isBookedFemale;
                          const isSelected = selectedSeats.includes(actualCode);
                          const isFemaleAdj = !isBooked && isAdjacentToFemalePassenger(actualCode);

                          let sClass = '';
                          if (isSelected) {
                            sClass = 'bg-emerald-600 text-white font-bold ring-2 ring-emerald-400 shadow-md';
                          } else if (isBookedFemale) {
                            sClass = 'bg-pink-100 text-pink-700 border-2 border-pink-300 cursor-not-allowed';
                          } else if (isBookedMale) {
                            sClass = 'bg-indigo-50 text-indigo-700 border-2 border-indigo-200 cursor-not-allowed';
                          } else if (isFemaleAdj) {
                            sClass = 'bg-white border-2 border-pink-500 text-pink-600 hover:bg-pink-50';
                          } else {
                            sClass = 'bg-white border-2 border-emerald-600 text-slate-800 hover:bg-slate-50';
                          }

                          return (
                            <button
                              key={actualCode}
                              onClick={() => handleSeatClick(sObj, actualCode)}
                              disabled={isBooked}
                              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${sClass}`}
                            >
                              {actualCode}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* "KNOW YOUR SEAT TYPES" CARD MATCHING IMAGE 2 EXACTLY */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 text-center mb-6">
                Know your seat types
              </h3>

              <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                {/* Header Row */}
                <div className="bg-slate-50/70 px-6 py-3.5 flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Seat Types</span>
                  <span>Sleeper</span>
                </div>

                {/* Row 1: Available */}
                <div className="px-6 py-4 flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-semibold text-slate-800">
                    Available
                  </span>
                  <div className="w-9 h-14 rounded-md border-2 border-emerald-600 bg-white flex flex-col items-center justify-end pb-1.5">
                    <div className="w-5 h-1.5 rounded-full bg-emerald-100" />
                  </div>
                </div>

                {/* Row 2: Already booked */}
                <div className="px-6 py-4 flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-semibold text-slate-800">
                    Already booked
                  </span>
                  <div className="w-9 h-14 rounded-md bg-slate-100 border border-slate-200 flex flex-col items-center justify-end pb-1.5">
                    <div className="w-5 h-1.5 rounded-full bg-slate-200" />
                  </div>
                </div>

                {/* Row 3: Available only for female passenger */}
                <div className="px-6 py-4 flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-semibold text-slate-800">
                    Available only for female passenger
                  </span>
                  <div className="w-9 h-14 rounded-md border-2 border-pink-500 bg-white flex flex-col items-center justify-between py-1.5">
                    <FemaleIcon className="w-3 h-3 text-pink-500" />
                    <div className="w-5 h-1.5 rounded-full bg-pink-100" />
                  </div>
                </div>

                {/* Row 4: Booked by female passenger */}
                <div className="px-6 py-4 flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-semibold text-slate-800">
                    Booked by female passenger
                  </span>
                  <div className="w-9 h-14 rounded-md bg-pink-100 border border-pink-200 flex flex-col items-center justify-between py-1.5 relative">
                    <div className="relative">
                      <FemaleIcon className="w-3 h-3 text-pink-400" />
                      <span className="absolute inset-0 flex items-center justify-center text-[11px] text-pink-300 font-bold select-none">✕</span>
                    </div>
                    <div className="w-5 h-1.5 rounded-full bg-pink-200" />
                  </div>
                </div>

                {/* Row 5: Available only for male passenger */}
                <div className="px-6 py-4 flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-semibold text-slate-800">
                    Available only for male passenger
                  </span>
                  <div className="w-9 h-14 rounded-md border-2 border-blue-500 bg-white flex flex-col items-center justify-between py-1.5">
                    <MaleIcon className="w-3 h-3 text-blue-500" />
                    <div className="w-5 h-1.5 rounded-full bg-blue-100" />
                  </div>
                </div>

                {/* Row 6: Booked by male passenger */}
                <div className="px-6 py-4 flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-semibold text-slate-800">
                    Booked by male passenger
                  </span>
                  <div className="w-9 h-14 rounded-md bg-indigo-50 border border-indigo-200 flex flex-col items-center justify-between py-1.5 relative">
                    <div className="relative">
                      <MaleIcon className="w-3 h-3 text-indigo-400" />
                      <span className="absolute inset-0 flex items-center justify-center text-[11px] text-indigo-300 font-bold select-none">✕</span>
                    </div>
                    <div className="w-5 h-1.5 rounded-full bg-indigo-200" />
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* Right Column (5 cols): Desktop Sticky Sidebar (No amount or boarding dropdown here) */}
          <div className="hidden lg:block lg:col-span-5 sticky top-28 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
              <div className="pb-4 border-b border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 bg-sky-50 px-2.5 py-1 rounded-full">
                  Step 1 of 4
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-2">
                  {trip.route?.fromCity?.name || 'Rupadiya'} → {trip.route?.toCity?.name || 'Ahmedabad'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {trip.bus?.name || 'Rupadiya Intercity Bus'} · {trip.bus?.busType || 'AC Sleeper'}
                </p>
              </div>

              {/* Selected Seats chips */}
              <div className="py-4 border-b border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-600">Selected Seats:</span>
                  <span className="text-xs font-bold text-slate-900">
                    {selectedSeats.length > 0 ? `${selectedSeats.length} Seat${selectedSeats.length > 1 ? 's' : ''}` : 'None selected'}
                  </span>
                </div>
                
                {selectedSeats.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedSeats.map(num => (
                      <span key={num} className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                        Berth {num}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Click berths on Lower or Upper deck to select</p>
                )}
              </div>

              {/* Desktop Proceed Button (Navigates to Boarding Points Screen) */}
              <button
                onClick={handleProceed}
                disabled={selectedSeats.length === 0}
                className={`w-full mt-4 py-4 rounded-2xl font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 ${
                  selectedSeats.length > 0
                    ? 'bg-sky-500 hover:bg-sky-600 text-white shadow-sky-500/25 active:scale-98 cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span>Select Boarding & Dropping Points →</span>
              </button>

              <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-500" />
                <span>Next: Boarding points & passenger details</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Floating Bottom Action Bar for Mobile (< lg) (No amount shown) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 py-3 px-4 sm:px-6 safe-bottom shadow-lg shadow-slate-900/10">
        <div className="max-w-md sm:max-w-xl mx-auto flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">Seats Chosen</span>
            <span className="text-sm font-bold text-slate-900 leading-tight truncate block">
              {selectedSeats.length > 0 ? selectedSeats.join(', ') : 'None'}
            </span>
          </div>

          <button
            onClick={handleProceed}
            disabled={selectedSeats.length === 0}
            className={`px-6 py-3.5 rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-1.5 flex-shrink-0 ${
              selectedSeats.length > 0
                ? 'bg-sky-500 hover:bg-sky-600 text-white shadow-sky-500/30 active:scale-95'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <span>Select Boarding Points →</span>
          </button>
        </div>
      </div>
    </div>
  );
}
