'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

  const refreshAdmin = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!isAdminSessionValid()) {
      setLoading(false);
      return;
    }

    try {
      const meRes = await api.me().catch(() => null);
      if (meRes?.user) {
        setAdmin(prev => {
          const merged = { ...(prev || {}), ...meRes.user };
          try { localStorage.setItem('admin_user', JSON.stringify(merged)); } catch (e) {}
          return merged;
        });
      }
      setError(null);
    } catch (err) {
      console.warn('Admin context refresh error:', err);
      setError(err.message);
    } finally {
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

    refreshAdmin();

    const handleUpdate = () => refreshAdmin();
    const handleUserUpdate = () => {
      try {
        const raw = localStorage.getItem('admin_user');
        if (raw) setAdmin(JSON.parse(raw));
      } catch (e) {}
    };

    window.addEventListener('admin-user-updated', handleUserUpdate);
    window.addEventListener('focus', handleUpdate);

    return () => {
      window.removeEventListener('admin-user-updated', handleUserUpdate);
      window.removeEventListener('focus', handleUpdate);
    };
  }, [refreshAdmin]);

  return (
    <AdminContext.Provider value={{
      user: admin,
      admin,
      loading,
      error,
      refreshAdmin,
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
