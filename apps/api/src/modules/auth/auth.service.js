const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../users/user.model');
const { Wallet } = require('../wallets/wallet.model');
const env = require('../../config/env');
const { ROLES } = require('../../config/constants');

class AuthService {
  constructor() {
    this.otpStore = new Map();
  }

  generateTokens(user) {
    const payload = {
      id: user._id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      companyCode: user.companyCode
    };

    const accessToken = jwt.sign(payload, env.AUTH_ACCESS_SECRET, {
      expiresIn: env.AUTH_ACCESS_EXPIRES_IN
    });

    const refreshToken = jwt.sign(payload, env.AUTH_REFRESH_SECRET, {
      expiresIn: env.AUTH_REFRESH_EXPIRES_IN
    });

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

    const demoOtp = '1234';
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
  async verifyPhoneOtp({ phone, otp, name, email }) {
    if (!phone || !otp) {
      throw new Error('Mobile number and OTP are required');
    }
    const cleanPhone = phone.toString().replace(/\D/g, '');
    const cleanOtp = otp.toString().trim();

    const stored = this.otpStore.get(cleanPhone);
    const isValid = cleanOtp === '1234' || (stored && stored.otp === cleanOtp && stored.expiresAt > Date.now());

    if (!isValid) {
      throw new Error('Invalid or expired OTP. Use demo code 1234.');
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

    const tokens = this.generateTokens(user);
    const sanitized = user.toObject();
    delete sanitized.passwordHash;

    return { user: sanitized, ...tokens };
  }

  async register({ name, email, phone, password, role = ROLES.PASSENGER, companyCode, referralCode }) {
    const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { phone }] });
    if (existing) {
      throw new Error('User with this email or phone already exists.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    let userReferralCode = null;
    if (role === ROLES.AGENT) {
      userReferralCode = `RUP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    }

    let referrer = null;
    if (referralCode) {
      referrer = await User.findOne({ referralCode: referralCode.toUpperCase(), role: ROLES.AGENT });
    }

    const user = new User({
      name,
      email: email.toLowerCase(),
      phone,
      passwordHash,
      role,
      companyCode: (role === ROLES.COMPANY_OWNER || role === ROLES.AGENT) ? companyCode : null,
      referralCode: userReferralCode,
      referredBy: referrer ? referrer._id : null
    });

    await user.save();

    if (role === ROLES.AGENT || role === ROLES.COMPANY_OWNER) {
      await Wallet.create({
        userId: user._id,
        companyCode: user.companyCode,
        availableBalance: 0,
        reservedBalance: 0
      });
    }

    const tokens = this.generateTokens(user);
    const sanitized = user.toObject();
    delete sanitized.passwordHash;

    return { user: sanitized, ...tokens };
  }

  async login({ email, password }) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new Error('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid email or password');
    }

    if (!user.isActive) {
      throw new Error('Account has been deactivated. Please contact support.');
    }

    const tokens = this.generateTokens(user);
    const sanitized = user.toObject();
    delete sanitized.passwordHash;

    let wallet = null;
    if (user.role === ROLES.AGENT || user.role === ROLES.COMPANY_OWNER) {
      wallet = await Wallet.findOne({ userId: user._id });
    }

    return { user: sanitized, wallet, ...tokens };
  }

  async refreshToken(token) {
    if (!token) throw new Error('Refresh token is required');
    try {
      const decoded = jwt.verify(token, env.AUTH_REFRESH_SECRET);
      const user = await User.findById(decoded.id);
      if (!user || !user.isActive) throw new Error('Invalid session');

      return this.generateTokens(user);
    } catch {
      throw new Error('Invalid or expired refresh token');
    }
  }
}

module.exports = new AuthService();
