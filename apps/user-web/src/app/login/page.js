'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bus, Lock, Mail, ArrowRight, ShieldCheck, Phone, Sparkles, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const redirectUrl = searchParams.get('redirect') || '/';

  // Primary mode: 'otp' (Mobile OTP as 1st priority) vs 'password' (Email password)
  const [authMode, setAuthMode] = useState('otp');

  // Mobile OTP State
  const [phone, setPhone] = useState('9876543210');
  const [otp, setOtp] = useState('1234');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  // Email Password State
  const [email, setEmail] = useState('passenger@rupadiya.test');
  const [password, setPassword] = useState('Password123!');
  const [emailLoading, setEmailLoading] = useState(false);

  // 1. Send OTP to Mobile Number
  const handleSendOtp = async (e) => {
    e?.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      addToast('Please enter a valid 10-digit mobile number.', 'warning', 'Invalid Mobile');
      return;
    }

    setOtpLoading(true);
    try {
      const res = await api.sendOtp(cleanPhone);
      setOtpSent(true);
      if (res.otp) setOtp(res.otp);
      addToast(res.message || 'OTP sent successfully to your mobile number!', 'success', 'OTP Sent');
    } catch (err) {
      addToast(err.message || 'Could not send OTP. Please try again.', 'error', 'Error');
    } finally {
      setOtpLoading(false);
    }
  };

  // 2. Verify OTP & Log in (and link bookings)
  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '');
    if (!otp || otp.length < 4) {
      addToast('Please enter the 4-digit verification code.', 'warning', 'Enter OTP');
      return;
    }

    setOtpLoading(true);
    try {
      const res = await api.verifyOtp(cleanPhone, otp);
      const token = res.accessToken || res.token || res.data?.token || res.data?.accessToken;
      const user = res.user || res.data?.user;

      if (!token) {
        throw new Error(res.error || 'Authentication token missing from server');
      }

      localStorage.setItem('rupadiya_token', token);
      localStorage.setItem('rupadiya_user', JSON.stringify(user || { name: 'Traveler', phone: cleanPhone }));
      addToast(`Welcome, ${user?.name || 'Traveler'}! All trips linked to your mobile number are now synced.`, 'success', 'Login Successful');

      router.push(redirectUrl);
    } catch (err) {
      addToast(err.message || 'OTP verification failed. Use code 1234.', 'error', 'Invalid OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  // 3. Email & Password submit (fallback for admins)
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setEmailLoading(true);
    try {
      const res = await api.login(email, password);
      const token = res.accessToken || res.token || res.data?.token || res.data?.accessToken;
      const user = res.user || res.data?.user;

      if (!token) {
        throw new Error(res.error || 'Authentication token missing from server');
      }

      localStorage.setItem('rupadiya_token', token);
      localStorage.setItem('rupadiya_user', JSON.stringify(user || { name: 'Traveler', email }));
      addToast(`Welcome back, ${user?.name || 'Traveler'}!`, 'success', 'Signed In');
      
      router.push(redirectUrl);
    } catch (err) {
      addToast(err.message || 'Login failed', 'error', 'Error');
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-14 h-14 rounded-2xl bg-sky-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-sky-500/30 mb-3">
          <Bus className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Sign in to Rupadiya</h2>
        <p className="text-xs text-slate-500 mt-1">
          Instant login with Mobile OTP · View your tickets & trips
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl shadow-slate-200/60 rounded-3xl border border-slate-100 sm:px-10">
          
          {/* Auth Mode Toggle: Mobile Number OTP (1st priority) vs Email */}
          <div className="flex p-1 bg-slate-100 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => setAuthMode('otp')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
                authMode === 'otp'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Phone className="w-3.5 h-3.5 text-sky-500" />
              <span>Mobile OTP</span>
              <span className="text-[9px] uppercase px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-700 font-extrabold">Fast</span>
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('password')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
                authMode === 'password'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email & Password</span>
            </button>
          </div>

          {/* ========================================================= */}
          {/* 1. MOBILE NUMBER + OTP AUTHENTICATION (FIRST PRIORITY)    */}
          {/* ========================================================= */}
          {authMode === 'otp' && (
            <div className="space-y-4">
              {!otpSent ? (
                // Step 1: Enter Mobile Number
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Mobile Number (10 Digits)
                    </label>
                    <div className="flex items-center gap-2 border border-slate-200 rounded-2xl px-3.5 py-3 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 bg-slate-50/50">
                      <span className="text-xs font-bold text-slate-400 border-r border-slate-200 pr-2">
                        🇮🇳 +91
                      </span>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        placeholder="9876543210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                        className="w-full text-sm font-bold focus:outline-none bg-transparent text-slate-900"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      We will automatically link and show all bookings made with this mobile number.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={otpLoading || phone.length < 10}
                    className={`w-full py-3.5 rounded-2xl font-bold shadow-lg transition active:scale-[0.99] flex items-center justify-center gap-2 text-sm ${
                      phone.length >= 10
                        ? 'bg-sky-500 hover:bg-sky-600 text-white shadow-sky-500/25'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    }`}
                  >
                    {otpLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Sending OTP...
                      </span>
                    ) : (
                      <span>Send OTP Code →</span>
                    )}
                  </button>

                  <div className="p-3 rounded-2xl bg-sky-50/70 border border-sky-100 flex items-center gap-2 text-xs text-sky-800">
                    <Sparkles className="w-4 h-4 text-sky-500 flex-shrink-0" />
                    <span>Demo Mode: Code <strong>1234</strong> is automatically prefilled.</span>
                  </div>
                </form>
              ) : (
                // Step 2: Enter OTP
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="text-center pb-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold mb-2">
                      <CheckCircle2 className="w-3.5 h-3.5" /> OTP Sent to +91 {phone}
                    </div>
                    <p className="text-xs text-slate-500">
                      Enter the 4-digit verification code below
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5 text-center">
                      4-Digit Code
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      required
                      autoFocus
                      placeholder="1234"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-center tracking-[0.5em] text-2xl font-black font-mono py-3 rounded-2xl border border-slate-200 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 bg-slate-50"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={otpLoading || otp.length < 4}
                    className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/25 transition active:scale-[0.99] flex items-center justify-center gap-2 text-sm"
                  >
                    {otpLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Verifying...
                      </span>
                    ) : (
                      <span>Verify & Login →</span>
                    )}
                  </button>

                  <div className="flex items-center justify-between text-xs pt-2">
                    <button
                      type="button"
                      onClick={() => setOtpSent(false)}
                      className="text-slate-400 hover:text-slate-700 font-semibold"
                    >
                      ← Change Mobile Number
                    </button>
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      className="text-sky-600 hover:text-sky-700 font-bold"
                    >
                      Resend Code
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* 2. EMAIL & PASSWORD AUTHENTICATION (SECONDARY / ADMIN)    */}
          {/* ========================================================= */}
          {authMode === 'password' && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Email Address</label>
                <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:border-sky-500">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-sm font-medium focus:outline-none bg-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Password</label>
                <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:border-sky-500">
                  <Lock className="w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full text-sm font-medium focus:outline-none bg-transparent"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={emailLoading}
                className="w-full py-3.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-2xl shadow-lg shadow-sky-500/25 transition active:scale-[0.99] flex items-center justify-center gap-2 text-sm mt-2"
              >
                {emailLoading ? 'Signing in...' : 'Sign In with Password →'}
              </button>
            </form>
          )}

          {/* Trust Badge */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-400 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Secure Passwordless Auth by Rupadiya</span>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
