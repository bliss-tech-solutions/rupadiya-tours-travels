'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  Calendar, 
  Users, 
  ShieldCheck, 
  Sparkles,
  ArrowRight,
  Utensils
} from 'lucide-react';
import PhoneInput from '../../../components/ui/PhoneInput';
import { isValidPhone, PHONE_ERROR } from '../../../lib/phone';
import { api } from '../../../lib/api';
import { useToast } from '../../../components/ui/Toast';
import { getLocalDateString, formatDate } from '../../../lib/dateUtils';

export default function TourDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const tourId = params.tourId;

  const [tour, setTour] = useState(null);
  const [loading, setLoading] = useState(true);
  const [travelersCount, setTravelersCount] = useState(2);
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [selectedDepartureDate, setSelectedDepartureDate] = useState('');
  const [bookingInProgress, setBookingInProgress] = useState(false);

  useEffect(() => {
    async function loadTour() {
      try {
        const res = await api.getTour(tourId);
        const data = res.data || res.tour;
        setTour(data);
        
        // Handle departure dates from DB (departureDates array)
        if (data?.departureDates && data.departureDates.length > 0) {
          setSelectedDepartureDate(getLocalDateString(new Date(data.departureDates[0])));
        } else if (data?.upcomingDepartures && data.upcomingDepartures.length > 0) {
          setSelectedDepartureDate(getLocalDateString(new Date(data.upcomingDepartures[0])));
        } else {
          const d = new Date();
          d.setDate(d.getDate() + 5);
          setSelectedDepartureDate(getLocalDateString(d));
        }
      } catch (err) {
        addToast(err.message || 'Tour not found', 'error');
      } finally {
        setLoading(false);
      }
    }
    loadTour();
  }, [tourId, addToast]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!tour) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h2 className="text-xl font-bold text-slate-800">Tour package not found</h2>
        <Link href="/tours" className="mt-4 px-4 py-2 bg-sky-500 text-white rounded-xl text-sm font-semibold">
          Browse all tours
        </Link>
      </div>
    );
  }

  const unitPrice = tour.basePrice != null ? tour.basePrice : (tour.pricePerPerson || 4999);
  const totalPrice = travelersCount * unitPrice;
  const tourImage = tour.thumbnail || tour.coverImage || tour.images?.[0] || 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80';
  const location = tour.destination && tour.state && tour.destination !== tour.state 
    ? `${tour.destination}, ${tour.state}` 
    : (tour.state || tour.destination || 'India');
  const availableDates = tour.departureDates && tour.departureDates.length > 0 
    ? tour.departureDates 
    : tour.upcomingDepartures || [];

  const handleBookTour = async (e) => {
    e.preventDefault();
    if (!leadName.trim() || !isValidPhone(leadPhone)) {
      addToast(leadName.trim() ? PHONE_ERROR : 'Please enter lead traveler name and contact phone.', 'warning', 'Required');
      return;
    }

    setBookingInProgress(true);
    try {
      const payload = {
        tourId: tour.tourId || tour._id,
        departureDate: selectedDepartureDate,
        travelDate: selectedDepartureDate,
        numberOfTravelers: travelersCount,
        contactEmail: leadEmail || 'guest@example.com',
        contactPhone: leadPhone,
        leadTraveler: {
          name: leadName,
          phone: leadPhone,
          email: leadEmail || 'guest@example.com',
        },
        travelers: Array.from({ length: travelersCount }).map((_, i) => ({
          name: i === 0 ? leadName : `${leadName} Traveler ${i + 1}`,
          age: 28,
          gender: 'female',
        })),
        paymentMethod: 'online',
        paymentProvider: 'dummy',
      };

      const res = await api.bookTour(payload);
      addToast('Tour booking confirmed! Our tour manager will contact you.', 'success', 'Tour Confirmed');
      
      const bookingId = res.booking?.bookingId || res.data?.bookingId || 'TOUR-' + Math.floor(100000 + Math.random() * 900000);

      // Store confirmation and redirect to ticket pass
      sessionStorage.setItem('rupadiya_confirmed_ticket', JSON.stringify({
        booking: {
          bookingId,
          trip: {
            bus: { name: tour.title, busType: `${tour.durationDays} Days / ${location}` },
            departureTime: selectedDepartureDate,
          },
          boardingPoint: { name: `Rupaidiha Hub (Tour Express Terminal)`, time: selectedDepartureDate },
          seats: [{ seatNumber: `${travelersCount} Travelers (All In)` }],
          passengers: [{ name: leadName }],
        },
        cashbackCoupon: res.cashbackCoupon || {
          code: 'NEXTTRIP150',
          title: 'Flat ₹150 Cashback Coupon',
          description: 'Valid on your next bus journey or tour reservation.',
          discount: 150,
        },
      }));

      router.push(`/ticket/${bookingId}`);
    } catch (err) {
      addToast(err.message || 'Tour booking failed', 'error');
    } finally {
      setBookingInProgress(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      {/* Sticky Top Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 md:top-20 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/tours"
            className="flex items-center gap-2 text-slate-700 hover:text-slate-900 font-bold text-sm"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500" />
            <span>All Tours</span>
          </Link>
          <div className="text-center">
            <h1 className="text-base font-black text-slate-900">{tour.title}</h1>
            <p className="text-xs text-slate-500">{location}</p>
          </div>
          <div className="w-16" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Image, Inclusions, Itinerary */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Tour Hero Banner */}
            <div className="relative rounded-3xl overflow-hidden aspect-[16/10] shadow-md bg-slate-900">
              <img
                src={tourImage}
                alt={tour.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 text-white">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-400 block mb-1">
                  {location} · {tour.durationDays} Days / {tour.durationNights || tour.durationDays - 1} Nights
                </span>
                <h1 className="text-2xl sm:text-3xl font-black leading-tight">{tour.title}</h1>
              </div>
            </div>

            {/* Description & Overview */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-3">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">About This Experience</h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                {tour.subtitle || tour.description || 'All-inclusive curated escape across India with luxury coach transit and guided local exploration.'}
              </p>
            </div>

            {/* Inclusions & Highlights */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Package Inclusions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {tour.inclusions && tour.inclusions.length > 0 ? (
                  tour.inclusions.map((inc, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-xs text-slate-700 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span>{inc}</span>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="flex items-center gap-2.5 text-xs text-slate-700 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span>AC Luxury Coach Travel</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-slate-700 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span>Curated Resort Accommodation</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Day by Day Itinerary */}
            {tour.itinerary && tour.itinerary.length > 0 && (
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Day-by-Day Detailed Itinerary</h2>
                <div className="space-y-4">
                  {tour.itinerary.map((item, idx) => (
                    <div key={idx} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <span className="w-9 h-9 rounded-full bg-sky-50 text-sky-600 border border-sky-200 text-xs font-black flex items-center justify-center flex-shrink-0">
                          D{item.day || idx + 1}
                        </span>
                        {idx !== tour.itinerary.length - 1 && (
                          <div className="flex-1 w-0.5 bg-slate-200 my-1" />
                        )}
                      </div>
                      <div className="pb-4">
                        <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.description}</p>
                        {item.mealsIncluded && item.mealsIncluded.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-500">
                            <Utensils className="w-3 h-3 text-amber-500" />
                            <span>Meals: {item.mealsIncluded.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Sticky Booking Widget */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xl sticky top-36 space-y-6">
              
              <div className="flex items-baseline justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block">All-inclusive package price</span>
                  <div className="text-3xl font-black text-slate-900">
                    ₹{unitPrice.toLocaleString()} <span className="text-xs font-normal text-slate-500">/ traveler</span>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                  Instant Confirmation
                </span>
              </div>

              <form onSubmit={handleBookTour} className="space-y-4">
                {/* Departure Date Selector */}
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1.5">Scheduled Departure Date *</label>
                  {availableDates.length > 0 ? (
                    <select
                      value={selectedDepartureDate}
                      onChange={(e) => setSelectedDepartureDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-sky-500 cursor-pointer"
                    >
                      {availableDates.map((d, i) => {
                        const dateStr = getLocalDateString(new Date(d));
                        const display = formatDate(d, 'medium');
                        return (
                          <option key={i} value={dateStr}>
                            {display}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <input
                      type="date"
                      required
                      value={selectedDepartureDate}
                      onChange={(e) => setSelectedDepartureDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:border-sky-500 bg-white"
                    />
                  )}
                </div>

                {/* Number of Travelers */}
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1.5">Number of Travelers</label>
                  <div className="flex items-center gap-3">
                    {[1, 2, 4, 6].map((num) => (
                      <button
                        type="button"
                        key={num}
                        onClick={() => setTravelersCount(num)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                          travelersCount === num
                            ? 'border-sky-500 bg-sky-50 text-sky-700 shadow-sm'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lead Traveler Details */}
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Lead Traveler Details</h4>
                  <div>
                    <input
                      type="text"
                      required
                      placeholder="Full name as on Government ID *"
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <PhoneInput required value={leadPhone} onChange={setLeadPhone} />
                  </div>
                </div>

                {/* Price Breakdown */}
                <div className="pt-4 border-t border-slate-100 space-y-1.5 text-xs text-slate-500">
                  <div className="flex justify-between">
                    <span>{travelersCount} Traveler{travelersCount > 1 ? 's' : ''} x ₹{unitPrice.toLocaleString()}</span>
                    <span>₹{totalPrice.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Taxes, Luxury Transit & Permits</span>
                    <span className="text-emerald-600 font-semibold">Included</span>
                  </div>
                  <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-100">
                    <span>Total Package Cost</span>
                    <span className="text-sky-600">₹{totalPrice.toLocaleString()}</span>
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={bookingInProgress}
                  className="w-full py-4 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-2xl shadow-lg shadow-sky-500/25 transition active:scale-[0.99] flex items-center justify-center gap-2 text-base"
                >
                  {bookingInProgress ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Reserving Tour...
                    </span>
                  ) : (
                    <span>Book Package for ₹{totalPrice.toLocaleString()} →</span>
                  )}
                </button>
              </form>

              <div className="pt-2 flex items-center justify-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Verified Tour Operator & Luxury Coach Guarantee</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
