'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { getLocalDateString } from '../../lib/dateUtils';
import {
  adToBs, bsToAd, bsMonthDays, isBsYearSupported, addDaysIso, weekdayOfIso, formatBs,
  toNepaliDigits, BS_MONTHS_NE, WEEKDAYS_NE
} from '../../lib/nepaliDate';

const LOCALE = { en: 'en-IN', hi: 'hi-IN', gu: 'gu-IN', ne: 'ne-NP' };
const WORDS = {
  en: { today: 'Today', tomorrow: 'Tomorrow', close: 'Close', choose: 'Choose travel date', bs: 'वि.सं.', ad: 'AD' },
  hi: { today: 'आज', tomorrow: 'कल', close: 'बंद करें', choose: 'यात्रा की तारीख चुनें', bs: 'वि.सं.', ad: 'AD' },
  gu: { today: 'આજે', tomorrow: 'આવતીકાલે', close: 'બંધ કરો', choose: 'મુસાફરીની તારીખ પસંદ કરો', bs: 'વિ.સં.', ad: 'AD' },
  ne: { today: 'आज', tomorrow: 'भोलि', close: 'बन्द गर्नुहोस्', choose: 'यात्रा मिति छान्नुहोस्', bs: 'वि.सं.', ad: 'AD' }
};

const utc = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
// useLayoutEffect only in the browser (avoids the SSR warning in Next.js).
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
const isoOf = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * Travel date picker: one field with one calendar icon, a proper month calendar
 * (popup on desktop, bottom sheet on phones), past dates disabled.
 * When the site language is Nepali it shows the Bikram Sambat calendar, with a BS / AD switch.
 * Value and onChange always use AD 'YYYY-MM-DD'.
 */
export default function DatePicker({ value, onChange, min, label, className = '', compact = false, align = 'left' }) {
  const { language = 'en' } = useLanguage();
  const w = WORDS[language] || WORDS.en;
  const locale = LOCALE[language] || 'en-IN';
  const today = getLocalDateString(new Date());
  const minIso = min || today;
  const selected = value && value >= minIso ? value : minIso;

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(language === 'ne' ? 'BS' : 'AD');
  const [view, setView] = useState(null); // { y, m } in the current mode
  const rootRef = useRef(null);
  const fieldRef = useRef(null);
  const panelRef = useRef(null);
  const [desktop, setDesktop] = useState(false);
  const [pos, setPos] = useState(null); // desktop popup position (viewport px)

  useEffect(() => { setMode(language === 'ne' ? 'BS' : 'AD'); }, [language]);

  const viewFor = (iso, m) => {
    if (m === 'BS') {
      const bs = adToBs(iso);
      if (bs) return { y: bs.year, m: bs.month };
    }
    const d = utc(iso);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
  };

  const openPicker = () => {
    setDesktop(typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches);
    setPos(null);
    setView(viewFor(selected, mode));
    setOpen(true);
  };

  // Desktop popup is rendered in <body> (so a parent's overflow:hidden can't clip it) and
  // placed under the field, or above it when there is no room below.
  const place = useCallback(() => {
    const field = fieldRef.current;
    if (!field) return;
    const r = field.getBoundingClientRect();
    const width = 340;
    const h = panelRef.current?.offsetHeight || 430;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = align === 'right' ? r.right - width : r.left;
    left = Math.max(8, Math.min(left, vw - width - 8));
    const below = vh - r.bottom;
    const top = below >= h + 12 || below >= r.top ? r.bottom + 8 : Math.max(8, r.top - h - 8);
    setPos({ top, left, width });
  }, [align]);

  useIsoLayoutEffect(() => {
    if (!open || !desktop) return undefined;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, desktop, place, view, mode]);
  const switchMode = (m) => { setMode(m); setView(viewFor(selected, m)); };

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const bsMode = mode === 'BS';

  // Cells of the visible month: leading blanks, then { iso, label, sub }.
  const grid = useMemo(() => {
    if (!view) return { cells: [], title: '', subtitle: '' };
    let first;
    let length;
    if (bsMode) {
      first = bsToAd(view.y, view.m, 1);
      length = bsMonthDays(view.y, view.m);
    } else {
      first = isoOf(view.y, view.m, 1);
      length = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
    }
    if (!first) return { cells: [], title: '', subtitle: '' };
    const lead = weekdayOfIso(first);
    const cells = Array.from({ length: lead }, () => null);
    for (let i = 0; i < length; i++) {
      const iso = addDaysIso(first, i);
      const ad = utc(iso);
      cells.push({
        iso,
        label: bsMode ? toNepaliDigits(i + 1) : String(i + 1),
        sub: bsMode ? String(ad.getUTCDate()) : ''
      });
    }
    const last = addDaysIso(first, length - 1);
    const fmt = (iso, opts) => utc(iso).toLocaleDateString(locale, { timeZone: 'UTC', ...opts });
    const title = bsMode
      ? `${BS_MONTHS_NE[view.m]} ${toNepaliDigits(view.y)}`
      : fmt(first, { month: 'long', year: 'numeric' });
    const subtitle = bsMode
      ? `${fmt(first, { day: 'numeric', month: 'short' })} – ${fmt(last, { day: 'numeric', month: 'short', year: 'numeric' })}`
      : (language === 'ne' ? (() => {
        const a = adToBs(first); const b = adToBs(last);
        return a && b ? `${BS_MONTHS_NE[a.month]} – ${BS_MONTHS_NE[b.month]} ${toNepaliDigits(b.year)}` : '';
      })() : '');
    return { cells, title, subtitle, first, last };
  }, [view, bsMode, locale, language]);

  const weekdays = useMemo(() => {
    if (bsMode || language === 'ne') return WEEKDAYS_NE;
    // 2023-01-01 was a Sunday.
    return Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2023, 0, 1 + i)).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' }));
  }, [bsMode, language, locale]);

  const step = (dir) => {
    setView((v) => {
      let y = v.y;
      let m = v.m + dir;
      if (m < 0) { m = 11; y -= 1; }
      if (m > 11) { m = 0; y += 1; }
      if (bsMode && !isBsYearSupported(y)) return v;
      return { y, m };
    });
  };
  const canGoBack = grid.first ? grid.first > minIso : false;
  const canGoNext = !bsMode || (view && (view.m < 11 || isBsYearSupported(view.y + 1)));

  const pick = (iso) => { onChange(iso); setOpen(false); };

  // Field text
  const tomorrow = addDaysIso(today, 1);
  const relative = selected === today ? w.today : selected === tomorrow ? w.tomorrow : '';
  const adText = utc(selected).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const main = bsMode ? (formatBs(selected) || adText) : adText;
  const second = bsMode
    ? [utc(selected).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }), relative].filter(Boolean).join(' · ')
    : relative;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={fieldRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPicker())}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`w-full text-left rounded-2xl border bg-white transition ${open ? 'border-sky-400 ring-2 ring-sky-100' : 'border-slate-200 hover:border-slate-300'} ${compact ? 'p-3' : 'p-3 px-4'}`}
      >
        {label && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">{label}</span>
        )}
        <span className="flex items-center gap-2.5 min-w-0">
          <Calendar className="w-4 h-4 text-sky-500 flex-shrink-0" />
          <span className="min-w-0">
            <span className="block font-bold text-sm text-slate-800 truncate">{main}</span>
            {second && <span className="block text-[11px] font-semibold text-slate-500 truncate">{second}</span>}
          </span>
        </span>
      </button>

      {open && view && typeof document !== 'undefined' && createPortal(
        <>
          {/* Phone: dimmed backdrop + bottom sheet. Desktop: popup under the field. */}
          {!desktop && <div className="fixed inset-0 bg-slate-900/40 z-[60]" onClick={() => setOpen(false)} aria-hidden="true" />}
          <div
            ref={panelRef}
            role="dialog"
            aria-label={w.choose}
            style={desktop ? { position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? 0, width: pos?.width ?? 340 } : undefined}
            className={desktop
              ? 'z-[61] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl'
              : 'fixed inset-x-0 bottom-0 z-[61] rounded-t-3xl bg-white p-4 pb-6 shadow-2xl max-h-[90vh] overflow-y-auto'}
          >
            {!desktop && <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200" />}
            <div className={`${desktop && language !== 'ne' ? 'hidden' : 'flex'} items-center justify-between gap-2 mb-3`}>
              {!desktop && <span className="text-sm font-bold text-slate-900">{w.choose}</span>}
              {language === 'ne' && (
                <div className={`inline-flex rounded-xl bg-slate-100 p-0.5 text-xs font-bold ${desktop ? '' : 'ml-auto'}`} role="group" aria-label="Calendar type">
                  {[['BS', w.bs], ['AD', w.ad]].map(([k, l]) => (
                    <button key={k} type="button" onClick={() => switchMode(k)} aria-pressed={mode === k}
                      className={`px-3 py-1 rounded-lg ${mode === k ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              )}
              {!desktop && (
                <button type="button" onClick={() => setOpen(false)} aria-label={w.close} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Month navigation */}
            <div className="flex items-center justify-between mb-2">
              <button type="button" onClick={() => step(-1)} disabled={!canGoBack} aria-label="Previous month"
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="text-center">
                <div className="text-sm font-bold text-slate-900">{grid.title}</div>
                {grid.subtitle && <div className="text-[11px] text-slate-500">{grid.subtitle}</div>}
              </div>
              <button type="button" onClick={() => step(1)} disabled={!canGoNext} aria-label="Next month"
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Weekdays + days */}
            <div className="grid grid-cols-7 text-center">
              {weekdays.map((d, i) => (
                <div key={i} className={`py-1.5 text-[11px] font-bold ${bsMode && i === 6 ? 'text-rose-500' : 'text-slate-400'}`}>{d}</div>
              ))}
              {grid.cells.map((c, i) => {
                if (!c) return <div key={`b${i}`} />;
                const disabled = c.iso < minIso;
                const isSel = c.iso === selected;
                const isToday = c.iso === today;
                const isSat = bsMode && weekdayOfIso(c.iso) === 6; // Saturday holiday on the Nepali calendar
                return (
                  <div key={c.iso} className="p-0.5">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => pick(c.iso)}
                      aria-pressed={isSel}
                      aria-label={utc(c.iso).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
                      className={`relative w-full aspect-square max-h-11 rounded-xl flex flex-col items-center justify-center text-sm font-semibold transition
                        ${isSel ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                          : disabled ? 'text-slate-300 cursor-not-allowed'
                          : `${isSat ? 'text-rose-500' : 'text-slate-800'} hover:bg-sky-50`}
                        ${isToday && !isSel ? 'ring-1 ring-sky-400' : ''}`}
                    >
                      <span className="leading-none">{c.label}</span>
                      {c.sub && <span className={`text-[9px] leading-none mt-0.5 ${isSel ? 'text-sky-100' : 'text-slate-400'}`}>{c.sub}</span>}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Quick picks */}
            <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2">
              {[[today, w.today], [tomorrow, w.tomorrow]].map(([iso, l]) => (
                <button key={iso} type="button" onClick={() => pick(iso)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${selected === iso ? 'bg-sky-50 border-sky-300 text-sky-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
