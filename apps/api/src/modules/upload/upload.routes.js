const express = require('express');
const router = express.Router();
const path = require('path');
const s3UploadService = require('../../services/s3Upload.service');
const { authenticateToken } = require('../../middleware/auth.middleware');

const ALLOWED_FOLDERS = ['documents', 'kyc', 'buses', 'profiles', 'tickets', 'managers'];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

// Magic bytes check for file buffer integrity
function verifyFileSignature(buffer, declaredMime) {
  if (!buffer || buffer.length < 4) return false;

  const hex = buffer.subarray(0, 4).toString('hex').toUpperCase();

  // PDF (%PDF)
  if (hex.startsWith('25504446')) {
    return declaredMime === 'application/pdf';
  }
  // JPEG (FF D8 FF)
  if (hex.startsWith('FFD8FF')) {
    return declaredMime.includes('jpeg') || declaredMime.includes('jpg');
  }
  // PNG (89 50 4E 47)
  if (hex.startsWith('89504E47')) {
    return declaredMime === 'image/png';
  }
  // WEBP (RIFF....WEBP)
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return declaredMime === 'image/webp';
  }

  return false;
}

// All upload routes require authenticated user session
router.use(authenticateToken);

/**
 * Get S3 presigned URL or direct upload metadata
 */
router.post('/sign', async (req, res, next) => {
  try {
    const { folder = 'documents', fileName, fileType } = req.body;
    if (!fileName) {
      return res.status(400).json({ error: 'fileName is required' });
    }

    if (!ALLOWED_FOLDERS.includes(folder)) {
      return res.status(400).json({ error: `Invalid folder. Allowed: ${ALLOWED_FOLDERS.join(', ')}` });
    }

    const ext = path.extname(fileName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return res.status(400).json({ error: `Invalid file extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` });
    }

    if (fileType && !ALLOWED_MIME_TYPES.includes(fileType.toLowerCase())) {
      return res.status(400).json({ error: `Invalid MIME type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}` });
    }

    // Attach user ownership prefix to storage key for security isolation
    const userSafeFolder = `${folder}/${req.user._id}`;
    const data = await s3UploadService.getPresignedUploadUrl({ folder: userSafeFolder, fileName, fileType });
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

    if (!ALLOWED_FOLDERS.includes(folder)) {
      return res.status(400).json({ error: `Invalid folder. Allowed: ${ALLOWED_FOLDERS.join(', ')}` });
    }

    const ext = path.extname(fileName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return res.status(400).json({ error: `Invalid file extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` });
    }

    const cleanMime = contentType.toLowerCase().trim();
  
    if (!ALLOWED_MIME_TYPES.includes(cleanMime)) {
      return res.status(400).json({ error: `Invalid MIME type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}` });
    }

    // Strip data URL prefix if present (e.g. data:image/png;base64,...)
    const cleanBase64 = base64Data.replace(/^data:([A-Za-z-+\/]+);base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    // Strict 5MB size limit check (5,242,880 bytes)
    const MAX_SIZE_BYTES = 5 * 1024 * 1024;
    if (buffer.length > MAX_SIZE_BYTES) {
      return res.status(400).json({ 
        error: `File size exceeds 5MB limit (current: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB). Please upload a file under 5MB.` 
      });
    }

    // Cryptographic magic byte check
    if (!verifyFileSignature(buffer, cleanMime)) {
      return res.status(400).json({
        error: `File content does not match the declared MIME type (${cleanMime}). Upload rejected for security.`
      });
    }

    const userSafeFolder = `${folder}/${req.user._id}`;
    const result = await s3UploadService.uploadBuffer({
      folder: userSafeFolder,
      fileName,
      buffer,
      contentType: cleanMime
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
 * Delete uploaded file (User can only delete files belonging to their user ID unless SUPER_ADMIN)
 */
router.delete('/', async (req, res, next) => {
  try {
    const { key } = req.body;
    if (!key) {
      return res.status(400).json({ error: 'File key is required to delete' });
    }

    // Security boundary: User can only delete their own uploads unless SUPER_ADMIN
    const isOwner = key.includes(`/${req.user._id}/`);
    const isAdmin = req.user.role === 'SUPER_ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Unauthorized: You can only delete documents you uploaded' });
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
