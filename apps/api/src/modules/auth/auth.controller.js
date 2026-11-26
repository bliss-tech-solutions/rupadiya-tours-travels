const authService = require('./auth.service');
const { isValidEmail } = require('../../config/validation');
const env = require('../../config/env');
const { normalisePhone, PHONE_ERROR } = require('../../utils/phone');
const { v4: uuidv4 } = require('uuid');
const { generateGuestToken } = require('../../middleware/tabGuest.middleware');

const isProd = env.NODE_ENV === 'production';
const isSecure = isProd || env.COOKIE_SAME_SITE === 'none';

function setAuthCookies(res, { accessToken, refreshToken }) {
  if (accessToken) {
    res.cookie('rupadiya_access_token', accessToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: env.COOKIE_SAME_SITE,
      domain: env.COOKIE_DOMAIN,
      path: '/',
      maxAge: 15 * 60 * 1000 // 15 Minutes
    });
  }

  if (refreshToken) {
    res.cookie('rupadiya_refresh_token', refreshToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: env.COOKIE_SAME_SITE,
      domain: env.COOKIE_DOMAIN,
      path: '/',
      maxAge: 24 * 60 * 60 * 1000 // 24 Hours
    });
  }
}

function clearAuthCookies(res) {
  res.cookie('rupadiya_access_token', '', {
    httpOnly: true,
    secure: isSecure,
    sameSite: env.COOKIE_SAME_SITE,
    domain: env.COOKIE_DOMAIN,
    path: '/',
    maxAge: 0
  });

  res.cookie('rupadiya_refresh_token', '', {
    httpOnly: true,
    secure: isSecure,
    sameSite: env.COOKIE_SAME_SITE,
    domain: env.COOKIE_DOMAIN,
    path: '/',
    maxAge: 0
  });
}

function getRequestMeta(req) {
  return {
    ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'] || 'Unknown'
  };
}

class AuthController {
  /**
   * Issue a signed guest token scoped strictly to an individual browser tab.
   * Isolates multi-tab guest sessions, seat holds, and rate limit buckets.
   */
  async getGuestToken(req, res, next) {
    try {
      const rawTabId = req.body?.tabId || req.headers['x-tab-id'];
      const tabId = (rawTabId && typeof rawTabId === 'string' && rawTabId.trim().length > 0)
        ? rawTabId.trim()
        : `tab_${uuidv4()}`;

      const guestToken = generateGuestToken({
        tabId,
        sessionId: req.browserSessionId,
        ip: req.ip
      });

      res.status(201).json({
        success: true,
        guestToken,
        token: guestToken,
        tabId,
        expiresIn: '24h',
        message: 'Tab guest session established securely.'
      });
    } catch (err) {
      next(err);
    }
  }

  async sendOtp(req, res, next) {
    try {
      const { phone, countryCode } = req.body;
      const result = await authService.sendPhoneOtp({ phone, countryCode });
      res.json(result);
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  async verifyOtp(req, res, next) {
    try {
      const { phone, otp, name, email, countryCode } = req.body;
      const meta = getRequestMeta(req);
      const result = await authService.verifyPhoneOtp({ phone, otp, name, email, countryCode }, meta);

      setAuthCookies(res, result);

      res.json({
        success: true,
        token: result.accessToken,
        accessToken: result.accessToken,
        user: result.user,
        data: {
          token: result.accessToken,
          accessToken: result.accessToken,
          user: result.user
        }
      });
    } catch (err) {
      res.status(401).json({ success: false, error: err.message });
    }
  }

  async register(req, res, next) {
    try {
      const { name, email, phone, password, role, companyCode, referralCode } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required' });
      }
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email address format' });
      }

      const meta = getRequestMeta(req);
      const result = await authService.register({ name, email, phone, password, role, companyCode, referralCode }, meta);

      setAuthCookies(res, result);

      res.status(201).json({ 
        success: true, 
        ...result,
        token: result.accessToken,
        data: {
          token: result.accessToken,
          accessToken: result.accessToken,
          user: result.user
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const meta = getRequestMeta(req);
      const result = await authService.login({ email, password }, meta);

      setAuthCookies(res, result);

      // The bus-manager mobile app cannot use httpOnly cookies: it keeps the refresh token in secure storage.
      const isMobileApp = req.headers['x-rupadiya-client'] === 'manager-app';
      if (isMobileApp && result.user?.role !== 'BUS_MANAGER') {
        return res.status(403).json({ success: false, error: 'This app is only for bus managers.' });
      }

      res.json({ 
        success: true, 
        accessToken: result.accessToken,
        token: result.accessToken,
        ...(isMobileApp ? { refreshToken: result.refreshToken } : {}),
        user: result.user,
        wallet: result.wallet,
        data: {
          token: result.accessToken,
          accessToken: result.accessToken,
          user: result.user,
          wallet: result.wallet
        }
      });
    } catch (err) {
      res.status(401).json({ success: false, error: err.message });
    }
  }

  async refreshToken(req, res, next) {
    try {
      // 1. Check httpOnly cookie first, then body fallback
      const token = req.cookies?.rupadiya_refresh_token || req.body?.refreshToken;
      const meta = getRequestMeta(req);

      const tokens = await authService.refreshToken(token, meta);
      setAuthCookies(res, tokens);

      res.json({ 
        success: true, 
        accessToken: tokens.accessToken,
        token: tokens.accessToken,
        ...(req.headers['x-rupadiya-client'] === 'manager-app' ? { refreshToken: tokens.refreshToken } : {}),
        user: tokens.user 
      });
    } catch (err) {
      clearAuthCookies(res);
      res.status(401).json({ success: false, error: err.message });
    }
  }

  async logout(req, res, next) {
    try {
      const token = req.cookies?.rupadiya_refresh_token || req.body?.refreshToken;
      if (token) {
        await authService.logout(token);
      }
      clearAuthCookies(res);
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (err) {
      clearAuthCookies(res);
      res.json({ success: true, message: 'Logged out' });
    }
  }

  async getSession(req, res, next) {
    try {
      if (req.user) {
        const user = req.user.toObject ? req.user.toObject() : req.user;
        delete user.passwordHash;
        return res.json({ success: true, authenticated: true, user, data: { user } });
      }
      return res.json({ success: true, authenticated: false, user: null, data: { user: null } });
    } catch (err) {
      next(err);
    }
  }

  async getMe(req, res, next) {
    try {
      const user = req.user.toObject ? req.user.toObject() : { ...req.user };
      delete user.passwordHash;

      if (user.companyCode) {
        const Company = require('../companies/company.model');
        const comp = await Company.findOne({ companyCode: user.companyCode }).lean();
        if (comp) {
          user.company = comp;
        }
      }

      res.json({ success: true, user, data: { user } });
    } catch (err) {
      next(err);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const { name, phone } = req.body;
      const user = req.user;

      if (name && name.trim()) {
        user.name = name.trim();
      }
      if (phone && phone.trim()) {
        const cleanPhone = normalisePhone(phone);
        if (!cleanPhone) {
          return res.status(400).json({ success: false, error: PHONE_ERROR });
        }
        user.phone = cleanPhone;
      }

      await user.save();
      const updatedUser = user.toObject();
      delete updatedUser.passwordHash;

      res.json({
        success: true,
        message: 'Profile updated successfully',
        user: updatedUser,
        data: { user: updatedUser }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
