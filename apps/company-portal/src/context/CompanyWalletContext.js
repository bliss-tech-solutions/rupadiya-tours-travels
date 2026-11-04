'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, isOwnerSessionValid } from '../lib/api';

const CompanyWalletContext = createContext({
  balance: null,
  companyInfo: null,
  companyCode: 1,
  user: null,
  loading: true,
  error: null,
  refreshWallet: () => {},
  setLocalBalance: () => {},
  updateUser: () => {}
});

const MIN_WALLET_CALL_GAP_MS = 2500;

export function CompanyWalletProvider({ children }) {
  const [balance, setBalance] = useState(null);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [companyCode, setCompanyCode] = useState(1);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isFetchingRef = useRef(false);
  const lastFetchedRef = useRef(0);
  const userRef = useRef(null);

  // Stable empty dependency array [] prevents infinite re-render loops
  const refreshWallet = useCallback(async (force = false) => {
    if (typeof window === 'undefined') return;
    if (!isOwnerSessionValid()) {
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
      const res = await api.getDashboard();
      if (res?.success) {
        setCompanyInfo(res);
        if (res.companyCode) setCompanyCode(res.companyCode);
        const bal = res.wallet?.availableBalance ?? res.stats?.walletBalance ?? 0;
        setBalance(Number(bal));
      }

      // Ensure user profile is fresh if not loaded yet
      if (!userRef.current) {
        const meRes = await api.me().catch(() => null);
        if (meRes?.user) {
          userRef.current = meRes.user;
          setUser(prev => {
            const merged = { ...(prev || {}), ...meRes.user };
            try { localStorage.setItem('owner_user', JSON.stringify(merged)); } catch (e) {}
            return merged;
          });
          if (meRes.user.companyCode) setCompanyCode(meRes.user.companyCode);
        }
      }

      lastFetchedRef.current = Date.now();
      setError(null);
    } catch (err) {
      console.warn('Company wallet refresh error:', err);
      setError(err.message);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, []); // Stable empty dependency array

  const updateUser = useCallback((partialUser) => {
    setUser(prev => {
      const updated = { ...(prev || {}), ...partialUser };
      userRef.current = updated;
      try {
        localStorage.setItem('owner_user', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    window.dispatchEvent(new Event('company-user-updated'));
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('owner_user');
      if (raw) {
        const parsed = JSON.parse(raw);
        setUser(parsed);
        userRef.current = parsed;
      }
    } catch (e) {}

    // Initial fetch ONLY once on mount / login
    refreshWallet(true);

    // Subsequent updates happen strictly on explicit events (funds added, etc.)
    const handleUpdate = () => refreshWallet(true);
    const handleUserUpdate = () => {
      try {
        const raw = localStorage.getItem('owner_user');
        if (raw) {
          const parsed = JSON.parse(raw);
          setUser(parsed);
          userRef.current = parsed;
        }
      } catch (e) {}
    };

    window.addEventListener('company-wallet-updated', handleUpdate);
    window.addEventListener('company-user-updated', handleUserUpdate);

    return () => {
      window.removeEventListener('company-wallet-updated', handleUpdate);
      window.removeEventListener('company-user-updated', handleUserUpdate);
    };
  }, [refreshWallet]);

  const setLocalBalance = useCallback((newBal) => {
    setBalance(Number(newBal));
  }, []);

  return (
    <CompanyWalletContext.Provider value={{
      balance,
      companyInfo,
      companyCode,
      user,
      loading,
      error,
      refreshWallet: () => refreshWallet(true),
      setLocalBalance,
      updateUser
    }}>
      {children}
    </CompanyWalletContext.Provider>
  );
}

export const useCompanyWallet = () => useContext(CompanyWalletContext);
