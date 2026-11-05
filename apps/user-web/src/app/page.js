"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  MapPin,
  ArrowRight,
  ArrowUpDown,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Search,
  Sparkles,
  ChevronRight,
  SlidersHorizontal,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { api } from "../lib/api";
import {
  HUB_CITY,
  SPOKE_CITIES,
  getAllowedDestinations,
  getAllowedOrigins,
  normalizeCityId,
} from "../lib/routes";
import { useLanguage } from "../context/LanguageContext";
import { getLocalDateString } from "../lib/dateUtils";

export default function HomePage() {
  const router = useRouter();
  const { t } = useLanguage();

  const todayIso = getLocalDateString(new Date());

  // Active Seat Hold State (RedBus style)
  const [activeHold, setActiveHold] = useState(null);
  const [holdTimeLeft, setHoldTimeLeft] = useState(0);

  // Search state: default Rupaidiha -> Ahmedabad
  const [fromCity, setFromCity] = useState("rupaidiha");
  const [toCity, setToCity] = useState("ahmedabad");
  const [selectedRegion, setSelectedRegion] = useState("All");
  const [departureDate, setDepartureDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  // Check and listen for active seat hold in storage
  useEffect(() => {
    const checkHold = () => {
      const raw =
        typeof window !== "undefined"
          ? sessionStorage.getItem("rupadiya_active_hold")
          : null;
      if (raw) {
        try {
          const hold = JSON.parse(raw);
          const exp = new Date(hold.expiresAt).getTime();
          const diff = Math.floor((exp - Date.now()) / 1000);
          if (diff > 0) {
            setActiveHold(hold);
            setHoldTimeLeft(diff);
          } else {
            sessionStorage.removeItem("rupadiya_active_hold");
            sessionStorage.removeItem("rupadiya_checkout");
            setActiveHold(null);
          }
        } catch (e) {
          sessionStorage.removeItem("rupadiya_active_hold");
        }
      } else {
        setActiveHold(null);
      }
    };

    checkHold();
    const interval = setInterval(() => {
      setHoldTimeLeft((prev) => {
        if (prev <= 1) {
          sessionStorage.removeItem("rupadiya_active_hold");
          sessionStorage.removeItem("rupadiya_checkout");
          setActiveHold(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleReleaseHold = async () => {
    if (activeHold?.holdId) {
      try {
        await api.releaseHold(activeHold.holdId);
      } catch (e) {}
    }
    sessionStorage.removeItem("rupadiya_active_hold");
    sessionStorage.removeItem("rupadiya_checkout");
    setActiveHold(null);
  };

  const holdMinutes = Math.floor(holdTimeLeft / 60);
  const holdSeconds = String(holdTimeLeft % 60).padStart(2, "0");

  // Calculate allowed destinations dynamically based on strict Hub-and-Spoke rule
  const allowedTo = getAllowedDestinations(fromCity);
  const allowedFrom = getAllowedOrigins(toCity);

  const isFromHub = normalizeCityId(fromCity) === 'rupaidiha' || normalizeCityId(fromCity) === 'rupadiya';

  const handleSwap = () => {
    if (isFromHub) {
      const targetSpoke = toCity && normalizeCityId(toCity) !== 'rupaidiha' && normalizeCityId(toCity) !== 'rupadiya' ? toCity : 'ahmedabad';
      setFromCity(targetSpoke);
      setToCity('rupaidiha');
    } else {
      const targetSpoke = fromCity && normalizeCityId(fromCity) !== 'rupaidiha' && normalizeCityId(fromCity) !== 'rupadiya' ? fromCity : 'ahmedabad';
      setFromCity('rupaidiha');
      setToCity(targetSpoke);
    }
  };

  const handleSearch = (e) => {
    e?.preventDefault();
    if (!fromCity || !toCity) return;
    const targetDate = departureDate < todayIso ? todayIso : departureDate;
    router.push(`/search?from=${fromCity}&to=${toCity}&date=${targetDate}`);
  };

  const popularDestinations = [
    {
      name: "Udaipur",
      subtitle: "Lakes & palaces",
      img: "https://images.unsplash.com/photo-1615836245337-f5b9b2303f10?w=800&auto=format&fit=crop&q=80",
    },
    {
      name: "Goa",
      subtitle: "Beaches & sunsets",
      img: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&auto=format&fit=crop&q=80",
    },
    {
      name: "Jaipur",
      subtitle: "Culture & heritage",
      img: "https://images.unsplash.com/photo-1477587458883-47145ed94245?w=800&auto=format&fit=crop&q=80",
    },
    {
      name: "Manali",
      subtitle: "Mountains & nature",
      img: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800&auto=format&fit=crop&q=80",
    },
  ];

  const featuredTours = [
    {
      id: "rann-of-kutch-escape",
      title: "Rann of Kutch Escape",
      duration: "3 days",
      state: "Gujarat",
      price: "₹4,999",
      badge: "Popular",
      badgeColor: "bg-slate-900 text-white",
      img: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80",
    },
    {
      id: "udaipur-heritage-trail",
      title: "Udaipur Heritage Trail",
      duration: "2 days",
      state: "Rajasthan",
      price: "₹3,499",
      badge: "Culture",
      badgeColor: "bg-amber-100 text-amber-900",
      img: "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=800&auto=format&fit=crop&q=80",
    },
    {
      id: "goa-beach-getaway",
      title: "Goa Beach Getaway",
      duration: "4 days",
      state: "Goa",
      price: "₹7,999",
      badge: "Best seller",
      badgeColor: "bg-sky-100 text-sky-900",
      img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80",
    },
  ];

  return (
    <div className="min-h-screen">
      {/* ======================================================== */}
      {/* 1. MOBILE APP VIEW (shown on sm screens, matches Image 2)  */}
      {/* ======================================================== */}
      <div className="block md:hidden px-4 pt-6 pb-12 bg-white">
        {/* Mobile Header Greeting */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-xs text-slate-400 font-medium">Hi, Traveler</p>
              <h3 className="text-base font-bold text-slate-800">
                Welcome Back!
              </h3>
            </div>
          </div>
          <Link
            href="/bookings"
            className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition"
          >
            <Clock className="w-5 h-5" />
          </Link>
        </div>

        {/* Headline */}
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-tight mb-5">
          Where would you <br />
          want to go?
        </h1>

        {/* Mobile Search Form with Floating Center Swap Button */}
        <div className="relative mb-6">
          <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100 shadow-sm bg-white overflow-hidden">
            {/* FROM Field */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex-1 pr-10">
                <label className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 block mb-1">
                  From
                </label>
                <select
                  value={fromCity}
                  onChange={(e) => setFromCity(e.target.value)}
                  className="w-full font-bold text-slate-800 bg-transparent focus:outline-none text-base cursor-pointer"
                >
                  {isFromHub ? (
                    <option value="rupaidiha">Rupaidiha (Hub)</option>
                  ) : (
                    SPOKE_CITIES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <MapPin className="w-5 h-5 text-slate-300" />
            </div>

            {/* TO Field */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex-1 pr-10">
                <label className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 block mb-1">
                  To
                </label>
                <select
                  value={toCity}
                  onChange={(e) => setToCity(e.target.value)}
                  className="w-full font-bold text-slate-800 bg-transparent focus:outline-none text-base cursor-pointer"
                >
                  {isFromHub ? (
                    SPOKE_CITIES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))
                  ) : (
                    <option value="rupaidiha">Rupaidiha (Hub)</option>
                  )}
                </select>
              </div>
              <MapPin className="w-5 h-5 text-slate-300" />
            </div>
          </div>

          {/* Floating Swap Button centered between From & To */}
          <button
            type="button"
            onClick={handleSwap}
            aria-label="Swap origin and destination"
            className="absolute right-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/30 transition-transform active:scale-95 z-10"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>

        {/* Date Row */}
        <div className="grid grid-cols-1 gap-3 mb-6">
          <div className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <label className="text-[11px] font-semibold uppercase text-slate-400 block mb-1">
              {t("departureDate")}
            </label>
            <input
              type="date"
              min={todayIso}
              value={departureDate}
              onChange={(e) => {
                if (e.target.value >= todayIso) {
                  setDepartureDate(e.target.value);
                }
              }}
              className="w-full font-bold text-sm text-slate-800 bg-transparent focus:outline-none"
            />
          </div>
        </div>

        {/* Big Blue Search Bus Button */}
        <button
          onClick={handleSearch}
          className="w-full py-4 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-2xl shadow-lg shadow-sky-500/25 transition active:scale-[0.98] text-base mb-6 flex items-center justify-center gap-2"
        >
          <span>{t("searchBuses")}</span>
        </button>

        {/* Active Seat Hold Banner (RedBus style on mobile) */}
        {activeHold && (
          <div className="my-6 p-4 rounded-3xl bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-orange-500/20 border border-amber-300/30">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-white animate-pulse" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded-full">
                    Booking In Progress
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-100">
                    ⏳ {holdMinutes}:{holdSeconds}
                  </span>
                </div>
                <h4 className="text-sm font-bold mt-1">
                  Seats [{activeHold.selectedSeats?.join(", ")}] Held For You
                </h4>
                <p className="text-[11px] text-amber-100 mt-0.5">
                  {activeHold.routeLabel || "Rupadiya Intercity Bus"} · ₹
                  {activeHold.totalPrice}
                </p>
                <div className="flex items-center gap-2 mt-3 pt-2 border-t border-white/20">
                  <button
                    onClick={handleReleaseHold}
                    className="flex-1 py-2 rounded-xl bg-black/20 text-[11px] font-bold text-white hover:bg-black/30 transition active:scale-95"
                  >
                    Release Seats
                  </button>
                  <Link
                    href={`/checkout/${activeHold.holdId}`}
                    className="flex-1 py-2 rounded-xl bg-white text-slate-900 text-[11px] font-bold text-center shadow-sm active:scale-95"
                  >
                    Complete Booking →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tour Guide & Category Filter Chips (matches Image 2 bottom-left) */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-sky-600">
                Tour Guide
              </p>
              <h4 className="text-base font-bold text-slate-900">
                Meet our most popular tours
              </h4>
            </div>
            <Link href="/tours" className="text-xs font-bold text-sky-600">
              See all
            </Link>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
            <button
              onClick={() => setSelectedRegion("All")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 flex-shrink-0 transition ${
                selectedRegion === "All"
                  ? "bg-sky-500 text-white shadow-sm shadow-sky-500/20"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>Filters</span>
            </button>
            {["Gujarat", "Rajasthan", "Goa"].map((region) => (
              <button
                key={region}
                onClick={() => setSelectedRegion(region)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex-shrink-0 transition ${
                  selectedRegion === region
                    ? "bg-sky-500 text-white shadow-sm shadow-sky-500/20"
                    : "bg-white border border-slate-200 text-slate-700 hover:border-slate-300"
                }`}
              >
                {region}
              </button>
            ))}
          </div>

          {/* Horizontal Swipeable Tour Cards */}
          <div className="flex gap-4 overflow-x-auto pt-3 pb-2 no-scrollbar">
            {featuredTours
              .filter(
                (t) =>
                  selectedRegion === "All" ||
                  t.state.toLowerCase() === selectedRegion.toLowerCase(),
              )
              .map((tour) => (
                <div
                  key={tour.id}
                  className="w-64 flex-shrink-0 bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm flex flex-col"
                >
                  <div className="relative h-36 w-full">
                    <img
                      src={tour.img}
                      alt={tour.title}
                      className="w-full h-full object-cover"
                    />
                    <span
                      className={`absolute top-3 left-3 text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm ${tour.badgeColor}`}
                    >
                      {tour.badge}
                    </span>
                    <span className="absolute bottom-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-sm">
                      {tour.duration}
                    </span>
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        {tour.state}
                      </p>
                      <h5 className="text-sm font-bold text-slate-900 leading-snug line-clamp-1">
                        {tour.title}
                      </h5>
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-3">
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase block font-semibold">
                          Starting from
                        </span>
                        <span className="text-sm font-bold text-slate-900">
                          {tour.price}
                        </span>
                      </div>
                      <Link
                        href={`/tours/${tour.id}`}
                        className="w-8 h-8 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-sm shadow-sky-500/30"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Mobile Popular Destinations Strip */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-base font-bold text-slate-900">
              Popular Destinations
            </h4>
            <Link href="/tours" className="text-xs font-bold text-sky-600">
              Explore
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
            {popularDestinations.map((dest, i) => (
              <div
                key={i}
                className="w-36 flex-shrink-0 relative rounded-2xl overflow-hidden aspect-[4/5] shadow-sm"
              >
                <img
                  src={dest.img}
                  alt={dest.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <h5 className="text-sm font-bold leading-tight">
                    {dest.name}
                  </h5>
                  <p className="text-[10px] text-slate-300">{dest.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. DESKTOP VIEW (matches Image 1: Beautiful Split Hero)   */}
      {/* ======================================================== */}
      <section className="hidden md:block relative overflow-hidden bg-gradient-to-b from-sky-50/60 via-white to-white py-16 lg:py-24">
        {/* Soft background glow */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-sky-200/30 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Headline & Pitch */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-sky-200 text-sky-700 text-xs font-bold uppercase tracking-wider shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                <span>YOUR JOURNEY, YOUR WAY</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight leading-[1.12]">
                The journey is just as{" "}
                <span className="text-sky-500">beautiful</span> as the
                destination.
              </h1>

              <p className="text-lg text-slate-600 max-w-lg leading-relaxed">
                Book comfortable bus rides and discover handpicked tours across
                India, all in one place.
              </p>

              {/* Trust Badges */}
              <div className="flex items-center gap-8 pt-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <ShieldCheck className="w-5 h-5 text-sky-500" />
                  <span>Trusted operators</span>
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <CheckCircle2 className="w-5 h-5 text-sky-500" />
                  <span>Easy booking</span>
                </div>
              </div>
            </div>

            {/* Right: "Choose your bus route" Booking Card */}
            <div className="lg:col-span-6">
              <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8 sm:p-10 relative">
                {/* Card Title & Fixed Corridors Note */}
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 flex-shrink-0">
                      <Search className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">
                        {t('searchBuses') || 'Search Buses'}
                      </h2>
                      <p className="text-xs text-slate-500 mt-1 leading-snug">
                        Find verified and comfortable bus rides across India
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSearch} className="space-y-4">
                  {/* From & To Row with Center Swap */}
                  <div className="relative border border-slate-200 rounded-2xl p-1 bg-slate-50/50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                      {/* FROM */}
                      <div className="p-3 pl-4">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          FROM
                        </label>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <select
                            value={fromCity}
                            onChange={(e) => setFromCity(e.target.value)}
                            className="w-full font-bold text-slate-800 bg-transparent focus:outline-none text-sm cursor-pointer"
                          >
                            {isFromHub ? (
                              <option value="rupaidiha">Rupaidiha (Hub)</option>
                            ) : (
                              SPOKE_CITIES.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))
                            )}
                          </select>
                        </div>
                      </div>

                      {/* TO */}
                      <div className="p-3 pl-4 sm:pl-6">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          TO
                        </label>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <select
                            value={toCity}
                            onChange={(e) => setToCity(e.target.value)}
                            className="w-full font-bold text-slate-800 bg-transparent focus:outline-none text-sm cursor-pointer"
                          >
                            {isFromHub ? (
                              SPOKE_CITIES.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))
                            ) : (
                              <option value="rupaidiha">Rupaidiha (Hub)</option>
                            )}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Swap button placed between columns */}
                    <button
                      type="button"
                      onClick={handleSwap}
                      title="Swap From and To"
                      className="hidden sm:flex md:rotate-90 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-600 items-center justify-center shadow-md hover:bg-slate-50 transition"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Departure Date */}
                  <div className="border border-slate-200 rounded-2xl p-3 px-4 bg-white">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      {t("departureDate")}
                    </label>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <input
                        type="date"
                        min={todayIso}
                        value={departureDate}
                        onChange={(e) => {
                          if (e.target.value >= todayIso) {
                            setDepartureDate(e.target.value);
                          }
                        }}
                        className="w-full font-bold text-sm text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Search Button */}
                  <button
                    type="submit"
                    className="w-full py-4 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-2xl shadow-lg shadow-sky-500/25 transition active:scale-[0.99] flex items-center justify-center gap-2 text-base"
                  >
                    <Search className="w-4 h-4" />
                    <span>{t("searchBuses")}</span>
                    <span>→</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Active Seat Hold Banner (RedBus style on Desktop) */}
      {activeHold && (
        <div className="hidden md:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <div className="p-5 rounded-3xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 text-white shadow-xl shadow-orange-500/20 border border-amber-300/40 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-black/25 px-2.5 py-0.5 rounded-full">
                    Active Reservation In Progress
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-100">
                    ⏳ {holdMinutes}:{holdSeconds} remaining to pay
                  </span>
                </div>
                <h3 className="text-base font-bold mt-1">
                  Seats [{activeHold.selectedSeats?.join(", ")}] are held
                  exclusively for your checkout
                </h3>
                <p className="text-xs text-amber-100 font-medium">
                  {activeHold.routeLabel || "Rupadiya Intercity Corridor"} ·
                  Total ₹{activeHold.totalPrice}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleReleaseHold}
                className="px-4 py-2.5 rounded-2xl bg-black/20 hover:bg-black/30 text-white text-xs font-bold transition border border-white/20 active:scale-95"
              >
                Cancel & Release Seats
              </button>
              <Link
                href={`/checkout/${activeHold.holdId}`}
                className="px-6 py-2.5 rounded-2xl bg-white text-slate-900 hover:bg-amber-50 text-xs font-bold transition shadow-md flex items-center gap-2 active:scale-95"
              >
                <span>Complete Booking</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. POPULAR DESTINATIONS (Matches image cards)            */}
      {/* ======================================================== */}
      <section className="hidden md:block py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-sky-600 mb-1">
              FIND YOUR NEXT ESCAPE
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Popular destinations
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              A little inspiration for your next trip.
            </p>
          </div>
          <Link
            href="/tours"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-bold text-sky-600 hover:text-sky-700"
          >
            <span>Explore tours</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {popularDestinations.map((dest, i) => (
            <div
              key={i}
              className="group relative rounded-3xl overflow-hidden aspect-[4/5] shadow-sm hover:shadow-xl transition-all duration-300"
            >
              <img
                src={dest.img}
                alt={dest.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 text-white">
                <h3 className="text-xl font-bold leading-tight">{dest.name}</h3>
                <p className="text-xs text-slate-300 font-medium mt-0.5">
                  {dest.subtitle}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ======================================================== */}
      {/* 4. TOURS WORTH TRAVELLING FOR (Matches bottom cards)      */}
      {/* ======================================================== */}
      <section className="hidden md:block py-16 bg-slate-50 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-sky-600 mb-1">
                MADE FOR MEMORIES
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Tours worth travelling for
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Curated escapes for solo travellers, friends, and families.
              </p>
            </div>
            <Link
              href="/tours"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-sky-600 hover:text-sky-700"
            >
              <span>View all tours</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredTours.map((tour) => (
              <div
                key={tour.id}
                className="bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group"
              >
                {/* Image & Badge */}
                <div className="relative aspect-[16/10] overflow-hidden">
                  <img
                    src={tour.img}
                    alt={tour.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <span
                    className={`absolute top-4 left-4 text-xs font-bold px-3 py-1 rounded-full shadow-sm ${tour.badgeColor}`}
                  >
                    {tour.badge}
                  </span>
                </div>

                {/* Tour Info */}
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{tour.duration}</span>
                      <span>·</span>
                      <span>{tour.state}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-sky-600 transition">
                      {tour.title}
                    </h3>
                  </div>

                  {/* Price & Action Button */}
                  <div className="pt-6 border-t border-slate-100 flex items-center justify-between mt-4">
                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">
                        Starting from
                      </span>
                      <div className="text-xl font-bold text-slate-900">
                        {tour.price}{" "}
                        <span className="text-xs font-normal text-slate-500">
                          /person
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/tours/${tour.id}`}
                      className="w-10 h-10 rounded-full bg-sky-50 text-sky-600 group-hover:bg-sky-500 group-hover:text-white flex items-center justify-center transition shadow-sm"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
