'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, isAdminSessionValid } from '../lib/api';

const AdminContext = createContext({
  user: null,
  admin: null,
  loading: true,
  error: null,
  refreshAdmin: () => {},
  updateUser: () => {}
});

export function AdminProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isFetchingRef = useRef(false);
  const lastFetchedRef = useRef(0);

  const refreshAdmin = useCallback(async (force = false) => {
    if (typeof window === 'undefined') return;
    if (!isAdminSessionValid()) {
      setLoading(false);
      return;
    }

    const now = Date.now();
    if (!force && now - lastFetchedRef.current < 60000) {
      return;
    }

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const meRes = await api.me().catch(() => null);
      if (meRes?.user) {
        setAdmin(prev => {
          const merged = { ...(prev || {}), ...meRes.user };
          try { localStorage.setItem('admin_user', JSON.stringify(merged)); } catch (e) {}
          return merged;
        });
      }
      lastFetchedRef.current = Date.now();
      setError(null);
    } catch (err) {
      console.warn('Admin context refresh error:', err);
      setError(err.message);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  const updateUser = useCallback((partialUser) => {
    setAdmin(prev => {
      const updated = { ...(prev || {}), ...partialUser };
      try {
        localStorage.setItem('admin_user', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    window.dispatchEvent(new Event('admin-user-updated'));
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('admin_user');
      if (raw) setAdmin(JSON.parse(raw));
    } catch (e) {}

    refreshAdmin(true);

    const handleUserUpdate = () => {
      try {
        const raw = localStorage.getItem('admin_user');
        if (raw) setAdmin(JSON.parse(raw));
      } catch (e) {}
    };

    window.addEventListener('admin-user-updated', handleUserUpdate);

    return () => {
      window.removeEventListener('admin-user-updated', handleUserUpdate);
    };
  }, [refreshAdmin]);

  return (
    <AdminContext.Provider value={{
      user: admin,
      admin,
      loading,
      error,
      refreshAdmin: () => refreshAdmin(true),
      updateUser
    }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}
