/**
 * High-End Security Sanitization Middleware
 * 1. XSS Defense: Recursively strips script tags, event handlers, and dangerous HTML injections
 * 2. NoSQL Operator Injection Defense: Disarms object keys starting with '$' or containing '.'
 */

function sanitizeString(str) {
  if (typeof str !== 'string') return str;

  // 1. Strip script tags and content
  let cleaned = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // 2. Strip dangerous iframe, embed, object, frame tags
  cleaned = cleaned.replace(/<\/?(?:iframe|object|embed|applet|frameset|frame)\b[^>]*>/gi, '');

  // 3. Strip inline event handlers (e.g. onerror=, onload=, onclick=)
  cleaned = cleaned.replace(/\s+on[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');

  // 4. Strip javascript: and vbscript: URIs
  cleaned = cleaned.replace(/(?:javascript|vbscript|data):/gi, 'blocked:');

  return cleaned.trim();
}

function sanitizeObject(obj, depth = 0) {
  if (depth > 10) return obj; // Prevent stack overflow on circular structures
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => {
      if (typeof item === 'string') return sanitizeString(item);
      if (typeof item === 'object' && item !== null) return sanitizeObject(item, depth + 1);
      return item;
    });
  }

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    // Disarm NoSQL query operators (keys starting with $ or containing .)
    let safeKey = key;
    if (safeKey.startsWith('$') || safeKey.includes('.')) {
      safeKey = safeKey.replace(/^\$/, '_safe_$').replace(/\./g, '_');
    }

    if (typeof value === 'string') {
      clean[safeKey] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      clean[safeKey] = sanitizeObject(value, depth + 1);
    } else {
      clean[safeKey] = value;
    }
  }

  return clean;
}

function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }
  next();
}

module.exports = {
  sanitizeInput,
  sanitizeString,
  sanitizeObject
};

