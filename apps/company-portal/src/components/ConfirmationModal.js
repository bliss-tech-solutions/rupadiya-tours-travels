'use client';

import React, { useEffect } from 'react';
import { 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  X, 
  Loader2,
  Trash2
} from 'lucide-react';

const VARIANT_CONFIG = {
  danger: {
    icon: Trash2,
    iconBg: 'bg-rose-50 text-rose-600 border-rose-100',
    confirmBtn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20',
    accentBorder: 'border-rose-100'
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-50 text-amber-600 border-amber-100',
    confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20',
    accentBorder: 'border-amber-100'
  },
  success: {
    icon: CheckCircle2,
    iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20',
    accentBorder: 'border-emerald-100'
  },
  info: {
    icon: Info,
    iconBg: 'bg-blue-50 text-blue-600 border-blue-100',
    confirmBtn: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20',
    accentBorder: 'border-blue-100'
  }
};

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  details = [],
  confirmText = 'Confirm Action',
  cancelText = 'Cancel',
  variant = 'danger',
  icon: CustomIcon,
  loading = false,
  children
}) {
  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const currentVariant = VARIANT_CONFIG[variant] || VARIANT_CONFIG.danger;
  const DisplayIcon = CustomIcon || currentVariant.icon;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div 
        className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="p-6 pb-4 flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${currentVariant.iconBg}`}>
            <DisplayIcon className="w-6 h-6" />
          </div>

          <div className="flex-1 min-w-0 pr-6">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
              {title}
            </h3>
            {message && (
              <div className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                {message}
              </div>
            )}
          </div>

          {!loading && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors absolute top-4 right-4"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Structured Details Breakdown (if provided) */}
        {details && details.length > 0 && (
          <div className="px-6 py-3">
            <div className="bg-slate-50 rounded-xl border border-slate-200/80 p-3.5 space-y-2">
              {details.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">{item.label}</span>
                  <span className={`font-semibold ${item.highlight ? 'text-slate-900 font-bold' : item.variant === 'danger' ? 'text-rose-600' : item.variant === 'success' ? 'text-emerald-700' : 'text-slate-800'}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Custom Content Slot (Inputs, dropdowns, UTR, reason) */}
        {children && (
          <div className="px-6 py-3">
            {children}
          </div>
        )}

        {/* Actions Footer */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${currentVariant.confirmBtn}`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
            <span>{loading ? 'Processing...' : confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

