const authService = require('./auth.service');
const { isValidEmail } = require('../../config/validation');

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
      const result = await authService.verifyPhoneOtp({ phone, otp, name, email });
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

      const result = await authService.register({ name, email, phone, password, role, companyCode, referralCode });
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

      const result = await authService.login({ email, password });
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
      const { refreshToken } = req.body;
      const tokens = await authService.refreshToken(refreshToken);
      res.json({ success: true, ...tokens });
    } catch (err) {
      res.status(401).json({ success: false, error: err.message });
    }
  }

  async getMe(req, res, next) {
    try {
      const user = req.user.toObject();
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
