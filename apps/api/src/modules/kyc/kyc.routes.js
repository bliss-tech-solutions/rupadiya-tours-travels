const express = require('express');
const router = express.Router();
const KycDocument = require('./kyc.model');
const { authenticateToken } = require('../../middleware/auth.middleware');
const { KYC_STATUS } = require('../../config/constants');

// Submit KYC Document
router.post('/upload', authenticateToken, async (req, res, next) => {
  try {
    const { documentType, documentNumber, fileUrl } = req.body;
    if (!documentType || !documentNumber) {
      return res.status(400).json({ error: 'documentType and documentNumber are required' });
    }

    // Mask the document number for privacy (keep last 4 chars)
    const cleanNum = documentNumber.replace(/\s+/g, '');
    const masked = cleanNum.length > 4
      ? 'X'.repeat(cleanNum.length - 4) + cleanNum.slice(-4)
      : cleanNum;

    const doc = new KycDocument({
      userId: req.user._id,
      companyCode: req.user.companyCode,
      documentType,
      documentNumberMasked: masked,
      fileUrl: fileUrl || 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=600&q=80',
      status: KYC_STATUS.PENDING
    });
    await doc.save();

    req.user.kycStatus = KYC_STATUS.PENDING;
    await req.user.save();

    res.status(201).json({
      success: true,
      message: 'KYC document submitted for verification.',
      document: doc
    });
  } catch (err) {
    next(err);
  }
});

// Get KYC Status
router.get('/status', authenticateToken, async (req, res, next) => {
  try {
    const documents = await KycDocument.find({ userId: req.user._id }).sort({ createdAt: -1 });

    res.json({
      success: true,
      overallStatus: req.user.kycStatus,
      documents
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
