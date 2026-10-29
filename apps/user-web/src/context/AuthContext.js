'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext({
  user: null,
  isAuthenticated: false,
  loading: true,
  login: () => {},
  logout: () => {},
  updateUser: () => {},
  refreshUser: () => {}
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Clean up any legacy localStorage tokens on load
  const cleanLegacyTokens = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem('rupadiya_token');
      localStorage.removeItem('token');
      localStorage.removeItem('user_token');
    } catch {}
  }, []);

  // Refresh user profile from API backend using httpOnly cookies
  const refreshUser = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      const res = await api.me();
      if (res?.user) {
        setUser(res.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cleanLegacyTokens();
    refreshUser();

    const handleFocus = () => refreshUser();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [cleanLegacyTokens, refreshUser]);

  // Login handler
  const login = useCallback((_token, newUser) => {
    cleanLegacyTokens();
    if (newUser) {
      setUser(newUser);
    } else {
      refreshUser();
    }
  }, [cleanLegacyTokens, refreshUser]);

  // Logout handler
  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {}
    cleanLegacyTokens();
    setUser(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }, [cleanLegacyTokens]);

  // Update profile details globally
  const updateUser = useCallback((updatedFields) => {
    setUser((prev) => (prev ? { ...prev, ...updatedFields } : null));
  }, []);

  const isAuthenticated = Boolean(user);

  return (
    <AuthContext.Provider
      value={{
        user,
        token: null, // Zero tokens exposed to JS
        isAuthenticated,
        loading,
        login,
        logout,
        updateUser,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
