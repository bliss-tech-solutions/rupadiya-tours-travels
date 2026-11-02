'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

export function CompanyWalletProvider({ children }) {
  const [balance, setBalance] = useState(null);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [companyCode, setCompanyCode] = useState(1);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshWallet = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!isOwnerSessionValid()) {
      setLoading(false);
      return;
    }

    try {
      const res = await api.getDashboard();
      if (res?.success) {
        setCompanyInfo(res);
        if (res.companyCode) setCompanyCode(res.companyCode);
        const bal = res.wallet?.availableBalance ?? res.stats?.walletBalance ?? 0;
        setBalance(Number(bal));
      }

      // Always ensure user profile is fresh
      const meRes = await api.me().catch(() => null);
      if (meRes?.user) {
        setUser(prev => {
          const merged = { ...(prev || {}), ...meRes.user };
          try { localStorage.setItem('owner_user', JSON.stringify(merged)); } catch (e) {}
          return merged;
        });
        if (meRes.user.companyCode) setCompanyCode(meRes.user.companyCode);
      }

      setError(null);
    } catch (err) {
      console.warn('Company wallet refresh error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateUser = useCallback((partialUser) => {
    setUser(prev => {
      const updated = { ...(prev || {}), ...partialUser };
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
      if (raw) setUser(JSON.parse(raw));
    } catch (e) {}

    refreshWallet();

    const handleUpdate = () => refreshWallet();
    const handleUserUpdate = () => {
      try {
        const raw = localStorage.getItem('owner_user');
        if (raw) setUser(JSON.parse(raw));
      } catch (e) {}
    };

    window.addEventListener('company-wallet-updated', handleUpdate);
    window.addEventListener('company-user-updated', handleUserUpdate);
    window.addEventListener('focus', handleUpdate);

    const interval = setInterval(refreshWallet, 30000);

    return () => {
      window.removeEventListener('company-wallet-updated', handleUpdate);
      window.removeEventListener('company-user-updated', handleUserUpdate);
      window.removeEventListener('focus', handleUpdate);
      clearInterval(interval);
    };
  }, [refreshWallet]);

  const setLocalBalance = useCallback((newBal) => {
    setBalance(Number(newBal));
    window.dispatchEvent(new Event('company-wallet-updated'));
  }, []);

  return (
    <CompanyWalletContext.Provider value={{
      balance,
      companyInfo,
      companyCode,
      user,
      loading,
      error,
      refreshWallet,
      setLocalBalance,
      updateUser
    }}>
      {children}
    </CompanyWalletContext.Provider>
  );
}

export const useCompanyWallet = () => useContext(CompanyWalletContext);
