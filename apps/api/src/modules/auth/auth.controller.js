const authService = require('./auth.service');
const { isValidEmail } = require('../../config/validation');
const env = require('../../config/env');

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
  async sendOtp(req, res, next) {
    try {
      const { phone } = req.body;
      const result = await authService.sendPhoneOtp({ phone });
      res.json(result);
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  async verifyOtp(req, res, next) {
    try {
      const { phone, otp, name, email } = req.body;
      const meta = getRequestMeta(req);
      const result = await authService.verifyPhoneOtp({ phone, otp, name, email }, meta);

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

      res.json({ 
        success: true, 
        accessToken: result.accessToken,
        token: result.accessToken,
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
      const user = req.user.toObject ? req.user.toObject() : req.user;
      delete user.passwordHash;
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
        const cleanPhone = phone.trim().replace(/\D/g, '');
        if (cleanPhone.length < 10) {
          return res.status(400).json({ success: false, error: 'Phone number must be at least 10 digits' });
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
