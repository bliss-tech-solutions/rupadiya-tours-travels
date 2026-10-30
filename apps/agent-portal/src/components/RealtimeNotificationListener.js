'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, CheckCircle2, AlertTriangle, X } from 'lucide-react';

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.2); // C6
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch (e) {}
}

export default function RealtimeAgentListener() {
  const [activeAlert, setActiveAlert] = useState(null);

  useEffect(() => {
    let ws = null;
    let timer = null;

    const connect = () => {
      try {
        const userRaw = typeof window !== 'undefined' ? localStorage.getItem('agent_user') : null;
        let agentId = null;
        if (userRaw) {
          try {
            const u = JSON.parse(userRaw);
            agentId = u._id || u.id;
          } catch (e) {}
        }

        const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
        const host = typeof window !== 'undefined' ? (window.location.hostname === 'localhost' ? 'localhost:4500' : window.location.host) : 'localhost:4500';
        const wsUrl = `${isSecure ? 'wss' : 'ws'}://${host}/ws`;

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (agentId) {
            ws.send(JSON.stringify({ action: 'subscribe', room: `agent:${agentId}` }));
          }
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.event === 'COMMISSION_EARNED' && msg.data) {
              const c = msg.data;
              playChime();
              setActiveAlert({
                type: 'COMMISSION',
                title: `Level ${c.level} Commission Credited!`,
                message: `Earned ₹${c.netCommission} (Gross ₹${c.grossCommission} - ₹${c.tcsDeducted} 1% TCS) for PNR ${c.pnr}`,
                time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
              });
              window.dispatchEvent(new Event('wallet-updated'));
              if (timer) clearTimeout(timer);
              timer = setTimeout(() => setActiveAlert(null), 8000);
            } else if (msg.event === 'WITHDRAWAL_APPROVED') {
              playChime();
              setActiveAlert({
                type: 'WITHDRAWAL',
                title: 'Withdrawal Approved!',
                message: `Your withdrawal of ₹${msg.data?.amount} has been approved and paid via gateway.`,
                time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
              });
              window.dispatchEvent(new Event('wallet-updated'));
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
      if (ws) ws.close();
    };
  }, []);

  if (!activeAlert) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700/80 animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/30">
          <Sparkles className="w-5 h-5 animate-spin" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider">
              {activeAlert.title}
            </span>
            <button
              onClick={() => setActiveAlert(null)}
              className="text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-200 mt-0.5">
            {activeAlert.message}
          </p>
          <span className="text-[9px] text-slate-500 block mt-1">
            {activeAlert.time}
          </span>
        </div>
      </div>
    </div>
  );
}

