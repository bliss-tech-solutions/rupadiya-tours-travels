const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../users/user.model');
const RefreshToken = require('./refreshToken.model');
const { Wallet } = require('../wallets/wallet.model');
const env = require('../../config/env');
const { ROLES } = require('../../config/constants');
const { generateUniqueReferralCode } = require('../../utils/referralCode');

class AuthService {
  constructor() {
    this.otpStore = new Map();
  }

  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async generateTokens(user, meta = {}) {
    const payload = {
      id: user._id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      companyCode: user.companyCode
    };

    const accessToken = jwt.sign(payload, env.AUTH_ACCESS_SECRET, {
      expiresIn: env.AUTH_ACCESS_EXPIRES_IN || '15m'
    });

    const refreshToken = jwt.sign({ ...payload, jti: crypto.randomUUID() }, env.AUTH_REFRESH_SECRET, {
      expiresIn: env.AUTH_REFRESH_EXPIRES_IN || '24h'
    });

    // Store refresh token in MongoDB for 24-hr session revocation & tracking when DB connected
    const mongoose = require('mongoose');
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        const tokenHash = this.hashToken(refreshToken);
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 Hours
        await RefreshToken.create({
          userId: user._id,
          tokenHash,
          expiresAt,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent
        });
      } catch (err) {
        console.error('Failed to persist refresh token in database:', err.message);
      }
    }

    return { accessToken, refreshToken };
  }

  /**
   * Send OTP to mobile phone for simple 1-click passwordless auth
   */
  async sendPhoneOtp({ phone }) {
    if (!phone) throw new Error('Mobile number is required');
    const cleanPhone = phone.toString().replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      throw new Error('Please enter a valid 10-digit mobile number');
    }

    const isDemo = process.env.NODE_ENV !== 'production' && (process.env.ALLOW_DEMO_OTP === 'true' || !process.env.ALLOW_DEMO_OTP);
    const demoOtp = isDemo ? '1234' : String(Math.floor(1000 + Math.random() * 9000));
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    this.otpStore.set(cleanPhone, { otp: demoOtp, expiresAt });

    return {
      success: true,
      phone: cleanPhone,
      otp: demoOtp,
      expiresAt,
      message: `OTP sent successfully to +91 ${cleanPhone}. (Use demo code ${demoOtp})`
    };
  }

  /**
   * Verify mobile OTP and log in / register passenger
   * Links all historical guest bookings made with this phone number
   */
  async verifyPhoneOtp({ phone, otp, name, email }, meta = {}) {
    if (!phone || !otp) {
      throw new Error('Mobile number and OTP are required');
    }
    const cleanPhone = phone.toString().replace(/\D/g, '');
    const cleanOtp = otp.toString().trim();

    const stored = this.otpStore.get(cleanPhone);
    const isDemoAllowed = process.env.NODE_ENV !== 'production' && (process.env.ALLOW_DEMO_OTP === 'true' || !process.env.ALLOW_DEMO_OTP);
    const isValid = (isDemoAllowed && cleanOtp === '1234') || (stored && stored.otp === cleanOtp && stored.expiresAt > Date.now());

    if (!isValid) {
      throw new Error(isDemoAllowed ? 'Invalid or expired OTP. Use demo code 1234.' : 'Invalid or expired OTP.');
    }

    this.otpStore.delete(cleanPhone);

    // 1. Check existing user by phone
    let user = await User.findOne({ phone: cleanPhone });

    // 2. If not found by phone, check by email if provided
    if (!user && email) {
      user = await User.findOne({ email: email.toLowerCase().trim() });
      if (user && !user.phone) {
        user.phone = cleanPhone;
        await user.save();
      }
    }

    // 3. If new user, create account
    const Booking = require('../bookings/booking.model');
    if (!user) {
      const priorBooking = await Booking.findOne({ 'contactDetails.phone': cleanPhone }).sort({ createdAt: -1 });
      const travelerName = name || priorBooking?.passengers?.[0]?.name || 'Traveler';
      const userEmail = email ? email.toLowerCase().trim() : `${cleanPhone}@rupadiya.com`;

      const existingEmail = await User.findOne({ email: userEmail });
      if (existingEmail) {
        user = existingEmail;
        user.phone = cleanPhone;
        await user.save();
      } else {
        user = await User.create({
          name: travelerName,
          email: userEmail,
          phone: cleanPhone,
          passwordHash: 'otp-phone-auth',
          role: ROLES.PASSENGER
        });
      }
    }

    // 4. Link past bookings made with this phone number to this user account
    await Booking.updateMany(
      { 'contactDetails.phone': cleanPhone, passengerId: { $ne: user._id } },
      { $set: { passengerId: user._id } }
    );

    // Unlock account if previously locked by password failures per PDF spec
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      await user.save();
    }

    const tokens = await this.generateTokens(user, meta);
    const sanitized = user.toObject();
    delete sanitized.passwordHash;

    return { user: sanitized, ...tokens };
  }

  async register({ name, email, phone, password, role = ROLES.PASSENGER, companyCode, referralCode }, meta = {}) {
    if (role && role !== ROLES.PASSENGER) {
      throw new Error('Privileged accounts (Company Owner, Agent, Admin) must be registered by an administrator.');
    }
    const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { phone }] });
    if (existing) {
      throw new Error('User with this email or phone already exists.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    let userReferralCode = null;
    if (role === ROLES.AGENT) {
      userReferralCode = await generateUniqueReferralCode('AGT');
    }

    let referrer = null;
    if (referralCode) {
      const codeUpper = String(referralCode).toUpperCase().trim();
      const expiredOwner = await User.findOne({ previousReferralCodes: codeUpper });
      if (expiredOwner) {
        throw new Error('This referral code has been refreshed and is no longer valid. Please obtain the new referral code from your sponsor.');
      }
      referrer = await User.findOne({ referralCode: codeUpper, role: ROLES.AGENT });
      if (!referrer) {
        throw new Error('Invalid referral code. Please verify the code or continue without one.');
      }
    }

    const userData = {
      name,
      email: email.toLowerCase(),
      phone,
      passwordHash,
      role,
      companyCode: (role === ROLES.COMPANY_OWNER || role === ROLES.AGENT) ? companyCode : null,
      referredBy: referrer ? referrer._id : null
    };
    if (userReferralCode) userData.referralCode = userReferralCode;
    const user = new User(userData);

    await user.save();

    if (role === ROLES.AGENT || role === ROLES.COMPANY_OWNER) {
      await Wallet.create({
        userId: user._id,
        companyCode: user.companyCode,
        availableBalance: 0,
        reservedBalance: 0
      });
    }

    const tokens = await this.generateTokens(user, meta);
    const sanitized = user.toObject();
    delete sanitized.passwordHash;

    return { user: sanitized, ...tokens };
  }

  async login({ email, password }, meta = {}) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Check account lockout per PDF page 2, Section 4.1
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockedUntil - new Date()) / (60 * 1000));
      throw new Error('Account locked after 5 failed attempts. Please retry in ' + remainingMinutes + ' minute(s) or verify via Mobile OTP to unlock.');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
        await user.save();
        throw new Error('Account locked after 5 failed attempts. Please retry in 30 minutes or unlock via Mobile OTP.');
      }
      await user.save();
      const remainingAttempts = 5 - user.failedLoginAttempts;
      throw new Error('Invalid email or password. ' + remainingAttempts + ' attempt(s) remaining before account lockout.');
    }

    // Reset failed attempts upon successful password login
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      await user.save();
    }

    if (!user.isActive) {
      throw new Error('Account has been deactivated. Please contact support.');
    }

    const tokens = await this.generateTokens(user, meta);
    const sanitized = user.toObject();
    delete sanitized.passwordHash;

    if (user.companyCode) {
      const Company = require('../companies/company.model');
      const comp = await Company.findOne({ companyCode: user.companyCode }).lean();
      if (comp) sanitized.company = comp;
    }

    let wallet = null;
    if (user.role === ROLES.AGENT || user.role === ROLES.COMPANY_OWNER) {
      wallet = await Wallet.findOne({ userId: user._id });
    }

    return { user: sanitized, wallet, ...tokens };
  }

  async refreshToken(token, meta = {}) {
    if (!token) throw new Error('Refresh token is required');
    try {
      const decoded = jwt.verify(token, env.AUTH_REFRESH_SECRET);
      const tokenHash = this.hashToken(token);

      // Check DB revocation
      const stored = await RefreshToken.findOne({ tokenHash });
      if (!stored || stored.isRevoked || stored.expiresAt < new Date()) {
        throw new Error('Session has expired or was revoked. Please log in again.');
      }

      const user = await User.findById(decoded.id);
      if (!user || !user.isActive) throw new Error('Invalid user account');

      // Rotate Refresh Token
      const newTokens = await this.generateTokens(user, meta);
      
      stored.isRevoked = true;
      stored.revokedAt = new Date();
      stored.replacedByTokenHash = this.hashToken(newTokens.refreshToken);
      await stored.save();

      const sanitized = user.toObject();
      delete sanitized.passwordHash;

      return { ...newTokens, user: sanitized };
    } catch (err) {
      throw new Error(err.message || 'Invalid or expired refresh token');
    }
  }

  async logout(token) {
    if (!token) return { success: true };
    try {
      const tokenHash = this.hashToken(token);
      await RefreshToken.updateOne(
        { tokenHash },
        { $set: { isRevoked: true, revokedAt: new Date() } }
      );
    } catch {}
    return { success: true };
  }
}

module.exports = new AuthService();
