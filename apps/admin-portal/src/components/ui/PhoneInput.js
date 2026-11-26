'use client';

import { useEffect, useRef, useState } from 'react';
import { PHONE_COUNTRIES, buildPhone, countryByCode, parsePhone } from '../../lib/phone';

/** Small drawn flags (flag emoji show as letters on Windows). */
export function CountryFlag({ code, className = 'h-[14px] w-auto shrink-0' }) {
  if (code === 'NP') {
    return (
      <svg viewBox="0 0 24 29" className={className} aria-hidden="true">
        <path d="M1 1 L22 14 L9 14 L22 28 L1 28 Z" fill="#DC143C" stroke="#003893" strokeWidth="2" strokeLinejoin="miter" />
        <circle cx="6.5" cy="9" r="2" fill="#fff" />
        <circle cx="6.5" cy="21.5" r="2.4" fill="#fff" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 30 20" className={className} aria-hidden="true">
      <rect width="30" height="20" fill="#fff" />
      <rect width="30" height="6.67" fill="#FF9933" />
      <rect y="13.33" width="30" height="6.67" fill="#138808" />
      <circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" strokeWidth="0.8" />
      <circle cx="15" cy="10" r="0.6" fill="#000080" />
    </svg>
  );
}

/**
 * Mobile number input with an India (+91) / Nepal (+977) country selector.
 * `value` / `onChange` use the form value from lib/phone.js ("9876543210" or "+9779812345678").
 */
export default function PhoneInput({
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  autoFocus = false,
  className = '',
  inputClassName = '',
  id,
  name,
  onEnter,
  size = 'md'
}) {
  const parsed = parsePhone(value);
  const [country, setCountry] = useState(parsed.country);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const inputRef = useRef(null);

  // Follow external value changes (e.g. profile phone loaded later).
  useEffect(() => {
    if (value && parsePhone(value).country !== country) setCountry(parsePhone(value).country);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const c = countryByCode(country);
  const small = size === 'sm';
  const national = parsed.country === country ? parsed.national : parsePhone(value).national;

  const pick = (code) => {
    setCountry(code);
    setOpen(false);
    onChange?.(buildPhone(code, national));
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div ref={boxRef} className={`relative flex items-stretch border border-slate-200 rounded-xl bg-white focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100 transition ${disabled ? 'opacity-60' : ''} ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 ${small ? 'pl-2 pr-1.5 text-xs' : 'pl-3 pr-2 text-sm'} border-r border-slate-200 font-bold text-slate-700 hover:bg-slate-50 rounded-l-xl shrink-0`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Country code ${c.name} +${c.dial}`}
      >
        <CountryFlag code={c.code} />
        <span data-no-translate>+{c.dial}</span>
        <svg viewBox="0 0 20 20" className={`w-3.5 h-3.5 text-slate-400 transition ${open ? 'rotate-180' : ''}`} fill="currentColor" aria-hidden="true">
          <path d="M5.2 7.2a.75.75 0 0 1 1.06 0L10 10.94l3.74-3.74a.75.75 0 1 1 1.06 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0L5.2 8.26a.75.75 0 0 1 0-1.06Z" />
        </svg>
      </button>

      <input
        ref={inputRef}
        id={id}
        name={name}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        required={required}
        disabled={disabled}
        autoFocus={autoFocus}
        maxLength={10}
        value={national}
        placeholder={placeholder || c.placeholder}
        onChange={(e) => onChange?.(buildPhone(country, e.target.value))}
        onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter(); } }}
        className={`w-full min-w-0 ${small ? 'px-2 py-1.5 text-xs' : 'px-3 py-2.5 text-sm'} font-bold tracking-wide bg-transparent focus:outline-none rounded-r-xl ${inputClassName}`}
      />

      {open && (
        <ul role="listbox" className="absolute z-50 left-0 top-full mt-1.5 w-56 bg-white border border-slate-200 rounded-xl shadow-lg py-1 overflow-hidden">
          {PHONE_COUNTRIES.map((opt) => (
            <li key={opt.code}>
              <button
                type="button"
                role="option"
                aria-selected={opt.code === country}
                onClick={() => pick(opt.code)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-sky-50 ${opt.code === country ? 'bg-sky-50 font-bold text-sky-700' : 'text-slate-700'}`}
              >
                <CountryFlag code={opt.code} />
                <span className="flex-1">{opt.name}</span>
                <span className="text-slate-500 font-semibold" data-no-translate>+{opt.dial}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
