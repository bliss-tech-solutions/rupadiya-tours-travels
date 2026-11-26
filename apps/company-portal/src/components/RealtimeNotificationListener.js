'use client';

import React, { useEffect, useState } from 'react';
import { Bell, CheckCircle2, X } from 'lucide-react';

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {}
}

export default function RealtimeNotificationListener({ companyCode }) {
  const [activeAlert, setActiveAlert] = useState(null);

  useEffect(() => {
    let ws = null;
    let timer = null;

    const connect = () => {
      try {
        const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
        const host = typeof window !== 'undefined' ? (window.location.hostname === 'localhost' ? 'localhost:4500' : window.location.host) : 'localhost:4500';
        const wsUrl = `${isSecure ? 'wss' : 'ws'}://${host}/ws`;

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          // Authenticate the socket before joining private notification rooms.
          try {
            const authToken = localStorage.getItem('owner_token');
            if (authToken) ws.send(JSON.stringify({ action: 'auth', token: authToken }));
          } catch (e) {}
          if (companyCode) {
            ws.send(JSON.stringify({ action: 'subscribe', room: `company:${companyCode}` }));
          }
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.event === 'NEW_BOOKING_NOTIFICATION' && msg.data) {
              const b = msg.data;
              playChime();
              setActiveAlert({
                pnr: b.pnr,
                seatCount: b.seatCount || b.seatNumbers?.length || 1,
                total: b.totalPayable,
                passenger: b.passengerName,
                time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
              });

              // Trigger custom event so dashboard/trips can auto-refresh
              window.dispatchEvent(new CustomEvent('realtime-booking-created', { detail: b }));

              if (timer) clearTimeout(timer);
              timer = setTimeout(() => setActiveAlert(null), 8000);
            }
          } catch (e) {}
        };

        ws.onclose = () => {
          setTimeout(connect, 5000);
        };
      } catch (err) {}
    };

    connect();

    return () => {
      if (timer) clearTimeout(timer);
      if (ws) {
        ws.close();
      }
    };
  }, [companyCode]);

  if (!activeAlert) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700/80 animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
          <Bell className="w-5 h-5 animate-bounce" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
              Real-time Booking Alert
            </span>
            <button
              onClick={() => setActiveAlert(null)}
              className="text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs font-bold text-white mt-0.5">
            Confirmed PNR: <span className="text-emerald-400 font-mono">{activeAlert.pnr}</span>
          </p>
          <p className="text-[11px] text-slate-300 mt-0.5">
            {activeAlert.seatCount} Seat(s) booked by {activeAlert.passenger} • ₹{Number(activeAlert.total || 0).toLocaleString('en-IN')}
          </p>
          <span className="text-[9px] text-slate-500 block mt-1">
            Just now at {activeAlert.time}
          </span>
        </div>
      </div>
    </div>
  );
}

