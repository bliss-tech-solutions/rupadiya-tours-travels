'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, isAgentSessionValid } from '../lib/api';

const WalletContext = createContext({
  balance: null,
  reserved: 0,
  loading: true,
  error: null,
  agent: null,
  user: null,
  refreshWallet: () => {},
  setLocalBalance: () => {},
  updateUser: () => {}
});

// Minimum gap between any wallet network requests to avoid rapid calls
const MIN_WALLET_CALL_GAP_MS = 2500;

export function WalletProvider({ children }) {
  const [balance, setBalance] = useState(null);
  const [reserved, setReserved] = useState(0);
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isFetchingRef = useRef(false);
  const lastFetchedRef = useRef(0);
  const agentRef = useRef(null);

  // Stable empty dependency array [] prevents infinite re-render loops
  const refreshWallet = useCallback(async (force = false) => {
    if (typeof window === 'undefined') return;
    if (!isAgentSessionValid()) {
      setLoading(false);
      return;
    }

    const now = Date.now();
    // Guard: Prevent rapid multiple calls within MIN_WALLET_CALL_GAP_MS
    if (now - lastFetchedRef.current < MIN_WALLET_CALL_GAP_MS) {
      return;
    }

    // Prevent concurrent in-flight requests
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      // 1. Fetch live wallet balance from backend
      let fetchedBal = null;
      try {
        const wRes = await api.getMyWallet();
        if (wRes?.success) {
          fetchedBal = wRes.balance ?? wRes.wallet?.availableBalance ?? wRes.data?.availableBalance ?? wRes.data?.balance;
          if (wRes.wallet?.reservedBalance != null) setReserved(wRes.wallet.reservedBalance);
        }
      } catch (wErr) {
        // Fallback to dashboard KPI endpoint only if wallet endpoint fails
        try {
          const dRes = await api.getDashboard();
          if (dRes?.success) {
            const d = dRes.data || dRes;
            fetchedBal = d.walletBalance ?? d.wallet?.availableBalance;
            if (d.agent) {
              agentRef.current = d.agent;
              setAgent(prev => {
                const merged = { ...(prev || {}), ...d.agent };
                try { localStorage.setItem('agent_user', JSON.stringify(merged)); } catch (e) {}
                return merged;
              });
            }
          }
        } catch (dErr) {}
      }

      if (fetchedBal != null) {
        setBalance(Number(fetchedBal));
      }

      // Synchronize profile info only once on initial load
      if (!agentRef.current) {
        const meRes = await api.me().catch(() => null);
        if (meRes?.user) {
          agentRef.current = meRes.user;
          setAgent(prev => {
            const merged = { ...(prev || {}), ...meRes.user };
            try { localStorage.setItem('agent_user', JSON.stringify(merged)); } catch (e) {}
            return merged;
          });
        }
      }

      lastFetchedRef.current = Date.now();
      setError(null);
    } catch (err) {
      console.warn('Wallet context refresh error:', err);
      setError(err.message);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  const updateUser = useCallback((partialUser) => {
    setAgent(prev => {
      const updated = { ...(prev || {}), ...partialUser };
      agentRef.current = updated;
      try {
        localStorage.setItem('agent_user', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    window.dispatchEvent(new Event('agent-user-updated'));
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('agent_user');
      if (raw) {
        const parsed = JSON.parse(raw);
        setAgent(parsed);
        agentRef.current = parsed;
      }
    } catch (e) {}

    // Initial fetch ONLY once when user mounts the app
    refreshWallet(true);

    // Subsequent updates happen strictly on explicit events (deposit, booking, etc.)
    const handleUpdate = () => refreshWallet(true);
    const handleUserUpdate = () => {
      try {
        const raw = localStorage.getItem('agent_user');
        if (raw) {
          const parsed = JSON.parse(raw);
          setAgent(parsed);
          agentRef.current = parsed;
        }
      } catch (e) {}
    };

    window.addEventListener('wallet-updated', handleUpdate);
    window.addEventListener('agent-user-updated', handleUserUpdate);

    return () => {
      window.removeEventListener('wallet-updated', handleUpdate);
      window.removeEventListener('agent-user-updated', handleUserUpdate);
    };
  }, [refreshWallet]);

  const setLocalBalance = useCallback((newBal) => {
    setBalance(Number(newBal));
  }, []);

  return (
    <WalletContext.Provider value={{
      balance,
      reserved,
      loading,
      error,
      agent,
      user: agent,
      refreshWallet: () => refreshWallet(true),
      setLocalBalance,
      updateUser
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
export const useAgent = () => useContext(WalletContext);
