'use client';

import React, { useState, useEffect } from 'react';
import { Bus, Sparkles } from 'lucide-react';

export default function SplashScreen() {
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if splash was already shown this session
    const seen = typeof window !== 'undefined' ? sessionStorage.getItem('ntt_splash_seen') : null;
    if (!seen) {
      setIsVisible(true);

      // Begin fade out after 1.2s
      const fadeTimer = setTimeout(() => {
        setIsFading(true);
      }, 1200);

      // Completely remove from DOM after fade completes (1.7s)
      const removeTimer = setTimeout(() => {
        setIsVisible(false);
        sessionStorage.setItem('ntt_splash_seen', 'true');
      }, 1700);

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(removeTimer);
      };
    }
  }, []);

  const handleSkip = () => {
    setIsFading(true);
    setTimeout(() => {
      setIsVisible(false);
      sessionStorage.setItem('ntt_splash_seen', 'true');
    }, 200);
  };

  if (!mounted || !isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white transition-opacity duration-500 select-none ${
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background Radial Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 sm:w-96 sm:h-96 bg-sky-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-600/15 rounded-full blur-2xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-sm mx-auto">
        
        {/* Animated Brand Logo Icon */}
        <div className="relative mb-6">
          {/* Pulsing Outer Rings */}
          <div className="absolute inset-0 rounded-3xl bg-sky-500/30 animate-ping opacity-60" />
          <div className="absolute -inset-2 rounded-3xl bg-sky-400/20 blur-md animate-pulse" />

          {/* Logo Badge */}
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-tr from-sky-600 via-sky-500 to-sky-400 flex items-center justify-center text-white shadow-2xl shadow-sky-500/50 border border-sky-300/30">
            <Bus className="w-10 h-10 sm:w-12 sm:h-12 drop-shadow-md" />
          </div>
        </div>

        {/* Brand Name */}
        <div className="space-y-1 mb-2">
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">NTT</span>
            <span className="text-3xl sm:text-4xl font-light tracking-wide text-sky-400">TRAVEL</span>
          </div>
          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-widest text-slate-400">
            Rupadiya Intercity Hub & Tours
          </p>
        </div>

        {/* Feature Highlights Pills */}
        <div className="flex items-center gap-2 mt-4 text-[10px] sm:text-[11px] font-medium text-slate-300">
          <span className="px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-800">
            Fixed Hub Routes
          </span>
          <span>•</span>
          <span className="px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-800">
            Handpicked Tours
          </span>
        </div>

        {/* Animated Loading Bar */}
        <div className="w-44 sm:w-52 h-1 bg-slate-800/80 rounded-full mt-8 overflow-hidden relative">
          <div className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-sky-500 to-sky-300 rounded-full animate-[progress_1.2s_ease-in-out_infinite] w-2/3" />
        </div>

        {/* Subtle Skip Button */}
        <button
          onClick={handleSkip}
          className="mt-6 text-[11px] text-slate-500 hover:text-slate-300 transition"
        >
          Tap to skip
        </button>
      </div>
    </div>
  );
}
