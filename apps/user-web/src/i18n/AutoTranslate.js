'use client';

/**
 * Translates the whole user website into the selected language.
 *
 * Pages keep their English text. This component watches the rendered page and
 * replaces every known English phrase (text, placeholders, titles, aria-labels,
 * alt text) with its Hindi / Gujarati / Nepali version from i18n/phrases.js.
 * New content (route changes, toasts, modals, live data) is translated as soon
 * as it appears. Choosing English restores the original text.
 *
 * Mark an element with data-no-translate (or translate="no") to keep it as is.
 */
import { useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import PHRASES from './phrases';

const LANG_INDEX = { hi: 0, gu: 1, ne: 2 };
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE', 'svg', 'SVG']);

const tableCache = {};

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Builds { exact: Map, patterns: [{ re, out }] } for one language. */
function buildTable(lang) {
  if (tableCache[lang]) return tableCache[lang];
  const idx = LANG_INDEX[lang];
  const exact = new Map();
  const patterns = [];
  for (const [en, values] of Object.entries(PHRASES)) {
    const out = values?.[idx];
    if (!out) continue;
    const key = en.replace(/\s+/g, ' ').trim();
    if (key.includes('#')) {
      const re = new RegExp('^' + key.split('#').map(escapeRegex).join('(.+?)') + '$');
      patterns.push({ re, out, specificity: key.replace(/#/g, '').length });
    } else {
      exact.set(key, out);
      exact.set(key.toLowerCase(), out);
    }
  }
  // Longer fixed text first so the most specific pattern wins.
  patterns.sort((a, b) => b.specificity - a.specificity);
  tableCache[lang] = { exact, patterns };
  return tableCache[lang];
}

/** Returns the translation of one string, or null when the phrase is unknown. */
function translateString(raw, table) {
  if (!raw) return null;
  const key = raw.replace(/\s+/g, ' ').trim();
  if (!key || !/[A-Za-z]/.test(key)) return null;

  let hit = table.exact.get(key) ?? table.exact.get(key.toLowerCase());
  if (!hit) {
    for (const { re, out } of table.patterns) {
      const m = key.match(re);
      if (m) {
        let i = 1;
        hit = out.replace(/#/g, () => (m[i++] ?? ''));
        break;
      }
    }
  }
  if (!hit) return null;
  // Keep the surrounding whitespace so inline text stays spaced correctly.
  const lead = raw.match(/^\s*/)[0];
  const trail = raw.match(/\s*$/)[0];
  return lead + hit + trail;
}

function isSkipped(el) {
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    if (SKIP_TAGS.has(n.tagName) || n.isContentEditable) return true;
    if (n.hasAttribute('data-no-translate') || n.getAttribute('translate') === 'no') return true;
  }
  return false;
}

export default function AutoTranslate() {
  const { language } = useLanguage();

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    document.documentElement.lang = language || 'en';

    // Original English for every node / attribute this component changed.
    const textState = new Map();   // Text node -> { orig, shown }
    const attrState = new Map();   // Element -> { [attr]: { orig, shown } }
    const active = LANG_INDEX[language] !== undefined;
    const table = active ? buildTable(language) : null;
    let applying = false;

    const translateText = (node) => {
      const parent = node.parentElement;
      if (!parent || isSkipped(parent)) return;
      const current = node.nodeValue;
      const prev = textState.get(node);
      if (prev && current === prev.shown) return;          // already ours
      const out = translateString(current, table);
      if (out && out !== current) {
        textState.set(node, { orig: current, shown: out });
        node.nodeValue = out;
      } else if (prev) {
        textState.delete(node);                             // React wrote new, unknown text
      }
    };

    const translateAttrs = (el) => {
      if (isSkipped(el)) return;
      for (const attr of ATTRS) {
        if (!el.hasAttribute(attr)) continue;
        const current = el.getAttribute(attr);
        const states = attrState.get(el) || {};
        if (states[attr] && states[attr].shown === current) continue;
        const out = translateString(current, table);
        if (out && out !== current) {
          states[attr] = { orig: current, shown: out };
          attrState.set(el, states);
          el.setAttribute(attr, out);
        }
      }
    };

    const walk = (root) => {
      if (!root) return;
      if (root.nodeType === 3) { translateText(root); return; }
      if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
      if (root.nodeType === 1) {
        if (isSkipped(root)) return;
        translateAttrs(root);
      }
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode(n) {
          if (n.nodeType === 1 && SKIP_TAGS.has(n.tagName)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      let n = walker.nextNode();
      while (n) {
        if (n.nodeType === 3) translateText(n);
        else translateAttrs(n);
        n = walker.nextNode();
      }
    };

    if (!active) return undefined;

    applying = true;
    walk(document.body);
    applying = false;

    const observer = new MutationObserver((mutations) => {
      if (applying) return;
      applying = true;
      try {
        for (const m of mutations) {
          if (m.type === 'characterData') translateText(m.target);
          else if (m.type === 'attributes') translateAttrs(m.target);
          else m.addedNodes.forEach(walk);
        }
      } finally {
        applying = false;
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS,
    });

    // Switching language (or leaving the page): put the English back first.
    return () => {
      observer.disconnect();
      for (const [node, s] of textState) {
        if (node.isConnected && node.nodeValue === s.shown) node.nodeValue = s.orig;
      }
      for (const [el, states] of attrState) {
        if (!el.isConnected) continue;
        for (const [attr, s] of Object.entries(states)) {
          if (el.getAttribute(attr) === s.shown) el.setAttribute(attr, s.orig);
        }
      }
      textState.clear();
      attrState.clear();
    };
  }, [language]);

  return null;
}
