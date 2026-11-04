const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { authenticateToken, optionalAuth } = require('../../middleware/auth.middleware');
const { authLimiter, guestTokenLimiter } = require('../../middleware/rateLimit.middleware');

// Tab-specific Guest Token Generation (Reduces surface & isolates multi-tab sessions)
router.post('/guest-token', guestTokenLimiter, (req, res, next) => authController.getGuestToken(req, res, next));

// Phone OTP Authentication (First priority) - Protected by authLimiter
router.post('/otp/send', authLimiter, (req, res, next) => authController.sendOtp(req, res, next));
router.post('/otp/verify', authLimiter, (req, res, next) => authController.verifyOtp(req, res, next));

// Email / Password Authentication - Protected by authLimiter
router.post('/register', authLimiter, (req, res, next) => authController.register(req, res, next));
router.post('/login', authLimiter, (req, res, next) => authController.login(req, res, next));
router.post('/refresh', (req, res, next) => authController.refreshToken(req, res, next));
router.post('/logout', (req, res, next) => authController.logout(req, res, next));

// Session & Authenticated endpoints
router.get('/session', optionalAuth, (req, res, next) => authController.getSession(req, res, next));
router.get('/me', authenticateToken, (req, res, next) => authController.getMe(req, res, next));
router.put('/profile', authenticateToken, (req, res, next) => authController.updateProfile(req, res, next));

module.exports = router;
