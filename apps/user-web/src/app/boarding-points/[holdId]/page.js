'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  ArrowRight, 
  Bus,
  CheckCircle2, 
  Navigation,
  ShieldCheck
} from 'lucide-react';
import { useToast } from '../../../components/ui/Toast';

export default function BoardingPointsSelectionPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const holdId = params.holdId;

  const [checkoutData, setCheckoutData] = useState(null);
  const [selectedBoardingId, setSelectedBoardingId] = useState('');
  const [selectedDroppingId, setSelectedDroppingId] = useState('');

  useEffect(() => {
    const raw = sessionStorage.getItem('rupadiya_booking_flow') || sessionStorage.getItem('rupadiya_checkout');
    if (!raw) {
      router.push('/');
      return;
    }
    const data = JSON.parse(raw);
    setCheckoutData(data);

    // Default select first available boarding and dropping points
    if (data.trip?.boardingPoints?.length > 0) {
      setSelectedBoardingId(data.trip.boardingPoints[0].id || data.trip.boardingPoints[0]._id || '0');
    }
    if (data.trip?.droppingPoints?.length > 0) {
      setSelectedDroppingId(data.trip.droppingPoints[0].id || data.trip.droppingPoints[0]._id || '0');
    }
  }, [router]);

  if (!checkoutData) return null;

  const trip = checkoutData.trip;
  const boardingPoints = trip?.boardingPoints || [];
  const droppingPoints = trip?.droppingPoints || [];

  const handleProceedToTravelers = () => {
    const chosenBoarding = boardingPoints.find(
      (b) => (b.id || b._id || '0') === selectedBoardingId
    ) || boardingPoints[0];

    const chosenDropping = droppingPoints.find(
      (d) => (d.id || d._id || '0') === selectedDroppingId
    ) || droppingPoints[0];

    // Ensure times are properly populated to prevent any validation errors
    const depTime = new Date(trip.departureTime);
    const arrTime = new Date(trip.arrivalTime);

    const bpTime = new Date(depTime.getTime() + (chosenBoarding?.timeOffsetMinutes || 0) * 60000).toISOString();
    const dpTime = new Date(arrTime.getTime() + (chosenDropping?.timeOffsetMinutes || 0) * 60000).toISOString();

    const finalizedBoarding = {
      name: chosenBoarding?.name || 'Main Boarding Point',
      landmark: chosenBoarding?.landmark || 'Platform Stand',
      time: bpTime,
    };

    const finalizedDropping = {
      name: chosenDropping?.name || 'Main Dropping Point',
      landmark: chosenDropping?.landmark || 'Main Bus Stand',
      time: dpTime,
    };

    const updatedData = {
      ...checkoutData,
      boardingPoint: finalizedBoarding,
      droppingPoint: finalizedDropping,
    };

    sessionStorage.setItem('rupadiya_booking_flow', JSON.stringify(updatedData));
    sessionStorage.setItem('rupadiya_checkout', JSON.stringify(updatedData));
    router.push(`/checkout/${holdId}`);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16">
      {/* Sticky Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 md:top-20 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-700 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <h1 className="text-base font-black text-slate-900">Select Boarding & Dropping Points</h1>
            <p className="text-xs text-slate-500">Step 2 of 4 · Where will you board?</p>
          </div>
          <div className="w-9" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        
        {/* Step Indicator */}
        <div className="flex items-center justify-between px-2 mb-6 text-xs font-bold text-slate-400">
          <span className="text-emerald-600 flex items-center gap-1">✓ 1. Seats</span>
          <span className="text-sky-600 font-extrabold flex items-center gap-1">● 2. Boarding Points</span>
          <span>○ 3. Travelers</span>
          <span>○ 4. Payment</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column (7 cols): Points Selection */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* 1. Boarding Points Selection Card */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                  <Navigation className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Choose Onboarding Point</h2>
                  <p className="text-xs text-slate-400">Select where you will catch your bus</p>
                </div>
              </div>

              <div className="space-y-3">
                {boardingPoints.map((bp) => {
                  const id = bp.id || bp._id || '0';
                  const isSelected = selectedBoardingId === id;
                  const depTime = new Date(new Date(trip.departureTime).getTime() + (bp.timeOffsetMinutes || 0) * 60000)
                    .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div
                      key={id}
                      onClick={() => setSelectedBoardingId(id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'border-sky-500 bg-sky-50/50 ring-2 ring-sky-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-300'
                        }`}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">{bp.name}</h4>
                          <p className="text-xs text-slate-500">{bp.landmark || 'Main pickup spot'}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-black text-sky-600">{depTime}</span>
                        <span className="text-[10px] text-slate-400 block font-medium">Departure</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Dropping Points Selection Card */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Choose Dropping Point</h2>
                  <p className="text-xs text-slate-400">Select where you will arrive</p>
                </div>
              </div>

              <div className="space-y-3">
                {droppingPoints.map((dp) => {
                  const id = dp.id || dp._id || '0';
                  const isSelected = selectedDroppingId === id;
                  const arrTime = new Date(new Date(trip.arrivalTime).getTime() + (dp.timeOffsetMinutes || 0) * 60000)
                    .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div
                      key={id}
                      onClick={() => setSelectedDroppingId(id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300'
                        }`}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">{dp.name}</h4>
                          <p className="text-xs text-slate-500">{dp.landmark || 'Main terminus'}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-black text-emerald-600">{arrTime}</span>
                        <span className="text-[10px] text-slate-400 block font-medium">Est. Arrival</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mobile Proceed Button */}
            <div className="lg:hidden">
              <button
                onClick={handleProceedToTravelers}
                className="w-full py-4 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-2xl shadow-lg shadow-sky-500/25 transition active:scale-[0.99] flex items-center justify-center gap-2 text-base"
              >
                <span>Continue to Traveler Details</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Right Column (5 cols): Sticky Journey Sidebar */}
          <div className="hidden lg:block lg:col-span-5 sticky top-28 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
              
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 bg-sky-50 px-2.5 py-1 rounded-full">
                    Step 2 of 4
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-2">
                    {checkoutData.trip?.route?.fromCity?.name || 'Rupadiya'} → {checkoutData.trip?.route?.toCity?.name || 'Ahmedabad'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {checkoutData.trip?.bus?.name || 'Rupadiya Intercity Bus'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 font-medium">Seats</span>
                  <p className="text-sm font-bold text-slate-800">
                    [{checkoutData.selectedSeats?.join(', ')}]
                  </p>
                </div>
              </div>

              {/* Selected Points Preview */}
              <div className="space-y-3 pt-2 text-xs">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Boarding At</span>
                  <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                    {boardingPoints.find(b => (b.id || b._id || '0') === selectedBoardingId)?.name || 'Main Boarding Point'}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Dropping At</span>
                  <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                    {droppingPoints.find(d => (d.id || d._id || '0') === selectedDroppingId)?.name || 'Main Dropping Point'}
                  </span>
                </div>
              </div>

              {/* Desktop Proceed Button */}
              <button
                onClick={handleProceedToTravelers}
                className="w-full py-3.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-2xl shadow-md shadow-sky-500/25 transition active:scale-[0.99] flex items-center justify-center gap-2 text-sm"
              >
                <span>Continue to Traveler Details →</span>
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 pt-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Selected boarding point notified to driver</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
