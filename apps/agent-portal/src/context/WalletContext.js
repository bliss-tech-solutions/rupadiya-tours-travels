'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, isAgentSessionValid } from '../lib/api';

const WalletContext = createContext({
  balance: null,
  reserved: 0,
  loading: true,
  error: null,
  agent: null,
  refreshWallet: () => {},
  setLocalBalance: () => {}
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
          if (d.agent) setAgent(d.agent);
        }
      }

      if (fetchedBal != null) {
        setBalance(Number(fetchedBal));
      }

      // Also ensure profile info is fresh
      if (!agent) {
        const meRes = await api.me().catch(() => null);
        if (meRes?.user) setAgent(meRes.user);
      }

      setError(null);
    } catch (err) {
      console.warn('Wallet context refresh error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [agent]);

  useEffect(() => {
    refreshWallet();

    // Event listeners for immediate reactive synchronization
    const handleUpdate = () => refreshWallet();
    window.addEventListener('wallet-updated', handleUpdate);
    window.addEventListener('focus', handleUpdate);

    // Automatic 30-second background polling
    const interval = setInterval(refreshWallet, 30000);

    return () => {
      window.removeEventListener('wallet-updated', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
      clearInterval(interval);
    };
  }, [refreshWallet]);

  const setLocalBalance = useCallback((newBal) => {
    setBalance(Number(newBal));
    window.dispatchEvent(new Event('wallet-updated'));
  }, []);

  return (
    <WalletContext.Provider value={{ balance, reserved, loading, error, agent, refreshWallet, setLocalBalance }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
