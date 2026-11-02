'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

export function WalletProvider({ children }) {
  const [balance, setBalance] = useState(null);
  const [reserved, setReserved] = useState(0);
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshWallet = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!isAgentSessionValid()) {
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch live wallet balance from backend using httpOnly cookies
      let fetchedBal = null;
      try {
        const wRes = await api.getMyWallet();
        if (wRes?.success) {
          fetchedBal = wRes.balance ?? wRes.wallet?.availableBalance ?? wRes.data?.availableBalance ?? wRes.data?.balance;
          if (wRes.wallet?.reservedBalance != null) setReserved(wRes.wallet.reservedBalance);
        }
      } catch (wErr) {
        // Fallback to dashboard KPI endpoint
      }

      if (fetchedBal == null) {
        const dRes = await api.getDashboard();
        if (dRes?.success) {
          const d = dRes.data || dRes;
          fetchedBal = d.walletBalance ?? d.wallet?.availableBalance;
          if (d.agent) {
            setAgent(prev => {
              const merged = { ...(prev || {}), ...d.agent };
              try { localStorage.setItem('agent_user', JSON.stringify(merged)); } catch (e) {}
              return merged;
            });
          }
        }
      }

      if (fetchedBal != null) {
        setBalance(Number(fetchedBal));
      }

      // Always ensure profile info is synchronized
      const meRes = await api.me().catch(() => null);
      if (meRes?.user) {
        setAgent(prev => {
          const merged = { ...(prev || {}), ...meRes.user };
          try { localStorage.setItem('agent_user', JSON.stringify(merged)); } catch (e) {}
          return merged;
        });
      }

      setError(null);
    } catch (err) {
      console.warn('Wallet context refresh error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateUser = useCallback((partialUser) => {
    setAgent(prev => {
      const updated = { ...(prev || {}), ...partialUser };
      try {
        localStorage.setItem('agent_user', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    window.dispatchEvent(new Event('agent-user-updated'));
  }, []);

  useEffect(() => {
    // Synchronize client-side cached agent profile after mounting to prevent SSR hydration mismatch
    try {
      const raw = localStorage.getItem('agent_user');
      if (raw) setAgent(JSON.parse(raw));
    } catch (e) {}

    refreshWallet();

    const handleUpdate = () => refreshWallet();
    const handleUserUpdate = () => {
      try {
        const raw = localStorage.getItem('agent_user');
        if (raw) setAgent(JSON.parse(raw));
      } catch (e) {}
    };

    window.addEventListener('wallet-updated', handleUpdate);
    window.addEventListener('agent-user-updated', handleUserUpdate);
    window.addEventListener('focus', handleUpdate);

    const interval = setInterval(refreshWallet, 30000);

    return () => {
      window.removeEventListener('wallet-updated', handleUpdate);
      window.removeEventListener('agent-user-updated', handleUserUpdate);
      window.removeEventListener('focus', handleUpdate);
      clearInterval(interval);
    };
  }, [refreshWallet]);

  const setLocalBalance = useCallback((newBal) => {
    setBalance(Number(newBal));
    window.dispatchEvent(new Event('wallet-updated'));
  }, []);

  return (
    <WalletContext.Provider value={{
      balance,
      reserved,
      loading,
      error,
      agent,
      user: agent,
      refreshWallet,
      setLocalBalance,
      updateUser
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
export const useAgent = () => useContext(WalletContext);
