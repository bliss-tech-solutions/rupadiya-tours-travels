'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, isOwnerSessionValid } from '../lib/api';

const CompanyWalletContext = createContext({
  balance: null,
  companyInfo: null,
  companyCode: 1,
  loading: true,
  error: null,
  refreshWallet: () => {},
  setLocalBalance: () => {}
});

export function CompanyWalletProvider({ children }) {
  const [balance, setBalance] = useState(null);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [companyCode, setCompanyCode] = useState(1);
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
      setError(null);
    } catch (err) {
      console.warn('Company wallet refresh error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshWallet();

    const handleUpdate = () => refreshWallet();
    window.addEventListener('company-wallet-updated', handleUpdate);
    window.addEventListener('focus', handleUpdate);

    const interval = setInterval(refreshWallet, 30000);

    return () => {
      window.removeEventListener('company-wallet-updated', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
      clearInterval(interval);
    };
  }, [refreshWallet]);

  const setLocalBalance = useCallback((newBal) => {
    setBalance(Number(newBal));
    window.dispatchEvent(new Event('company-wallet-updated'));
  }, []);

  return (
    <CompanyWalletContext.Provider value={{ balance, companyInfo, companyCode, loading, error, refreshWallet, setLocalBalance }}>
      {children}
    </CompanyWalletContext.Provider>
  );
}

export function useCompanyWallet() {
  const context = useContext(CompanyWalletContext);
  if (!context) {
    throw new Error('useCompanyWallet must be used within a CompanyWalletProvider');
  }
  return context;
}
