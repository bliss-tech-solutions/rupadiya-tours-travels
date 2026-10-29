const express = require('express');
const router = express.Router();
const s3UploadService = require('../../services/s3Upload.service');
const { authenticateToken } = require('../../middleware/auth.middleware');

/**
 * Get S3 presigned URL or direct upload metadata
 */
router.post('/sign', async (req, res, next) => {
  try {
    const { folder = 'documents', fileName, fileType } = req.body;
    if (!fileName) {
      return res.status(400).json({ error: 'fileName is required' });
    }

    const data = await s3UploadService.getPresignedUploadUrl({ folder, fileName, fileType });
    res.json({
      success: true,
      ...data
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Direct file upload endpoint (supporting Base64 dataURL or JSON payload)
 */
router.post('/direct', async (req, res, next) => {
  try {
    const { folder = 'documents', fileName = 'upload.jpg', base64Data, contentType = 'image/jpeg' } = req.body;

    if (!base64Data) {
      return res.status(400).json({ error: 'base64Data is required for direct upload' });
    }

    // Strip data URL prefix if present (e.g. data:image/png;base64,...)
    const cleanBase64 = base64Data.replace(/^data:([A-Za-z-+\/]+);base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    const result = await s3UploadService.uploadBuffer({
      folder,
      fileName,
      buffer,
      contentType
    });

    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Delete uploaded file
 */
router.delete('/', async (req, res, next) => {
  try {
    const { key } = req.body;
    if (!key) {
      return res.status(400).json({ error: 'File key is required to delete' });
    }

    const deleted = await s3UploadService.deleteFile(key);
    res.json({
      success: true,
      deleted,
      message: 'File removed successfully'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

