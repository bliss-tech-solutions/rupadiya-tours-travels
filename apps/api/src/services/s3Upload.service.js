const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || '';
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || '';
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || 'rupadiya-fleet-documents';

const isS3Configured = Boolean(
  AWS_ACCESS_KEY_ID &&
  AWS_SECRET_ACCESS_KEY &&
  AWS_S3_BUCKET &&
  AWS_ACCESS_KEY_ID !== 'placeholder'
);

let s3Client = null;
if (isS3Configured) {
  try {
    s3Client = new S3Client({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY
      }
    });
    console.log(`[S3UploadService] AWS S3 Client initialized for bucket: ${AWS_S3_BUCKET} (${AWS_REGION})`);
  } catch (err) {
    console.warn('[S3UploadService] Failed to initialize S3Client, using local fallback:', err.message);
  }
} else {
  console.log('[S3UploadService] AWS credentials not provided, running in Local / Dev file upload mode.');
}

// Local upload storage directory
const LOCAL_UPLOADS_DIR = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(LOCAL_UPLOADS_DIR)) {
  fs.mkdirSync(LOCAL_UPLOADS_DIR, { recursive: true });
}

class S3UploadService {
  /**
   * Check if AWS S3 is active
   */
  isConfigured() {
    return Boolean(s3Client);
  }

  /**
   * Generate S3 Pre-signed URL or Local upload endpoint
   */
  async getPresignedUploadUrl({ folder = 'documents', fileName, fileType = 'application/octet-stream' }) {
    const ext = path.extname(fileName || '') || '.bin';
    const randomHash = crypto.randomBytes(8).toString('hex');
    const safeName = path.basename(fileName || 'file', ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const key = `${folder}/${Date.now()}-${randomHash}-${safeName}${ext}`;

    if (s3Client) {
      const command = new PutObjectCommand({
        Bucket: AWS_S3_BUCKET,
        Key: key,
        ContentType: fileType
      });

      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
      const publicUrl = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;

      return {
        mode: 'S3_PRESIGNED',
        uploadUrl,
        publicUrl,
        key,
        bucket: AWS_S3_BUCKET
      };
    }

    // Fallback: Local upload URL
    const publicUrl = `/uploads/${key.replace(/\//g, '_')}`;
    return {
      mode: 'LOCAL_FALLBACK',
      uploadUrl: `/api/v1/upload/direct`,
      publicUrl,
      key
    };
  }

  /**
   * Save a base64 or buffer file directly
   */
  async uploadBuffer({ folder = 'documents', fileName, buffer, contentType = 'application/octet-stream' }) {
    const ext = path.extname(fileName || '') || '.bin';
    const randomHash = crypto.randomBytes(8).toString('hex');
    const safeName = path.basename(fileName || 'file', ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const key = `${folder}/${Date.now()}-${randomHash}-${safeName}${ext}`;

    if (s3Client) {
      await s3Client.send(new PutObjectCommand({
        Bucket: AWS_S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType
      }));

      const publicUrl = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
      return {
        success: true,
        url: publicUrl,
        key,
        mode: 'S3'
      };
    }

    // Save to local directory
    const localFileName = `${Date.now()}-${randomHash}-${safeName}${ext}`;
    const localFilePath = path.join(LOCAL_UPLOADS_DIR, localFileName);
    fs.writeFileSync(localFilePath, buffer);

    const publicUrl = `/uploads/${localFileName}`;
    return {
      success: true,
      url: publicUrl,
      key: localFileName,
      mode: 'LOCAL'
    };
  }

  /**
   * Delete file from S3 or local disk
   */
  async deleteFile(key) {
    if (!key) return false;

    if (s3Client) {
      try {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: AWS_S3_BUCKET,
          Key: key
        }));
        return true;
      } catch (err) {
        console.warn(`[S3UploadService] Failed to delete S3 key ${key}:`, err.message);
        return false;
      }
    }

    // Local delete
    try {
      const localFile = path.basename(key);
      const filePath = path.join(LOCAL_UPLOADS_DIR, localFile);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return true;
    } catch (err) {
      console.warn(`[S3UploadService] Failed to delete local file ${key}:`, err.message);
      return false;
    }
  }
}

module.exports = new S3UploadService();

