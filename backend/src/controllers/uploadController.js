import { uploadFileToStorage } from '../services/storageService.js';

/**
 * Controller for POST /api/uploads
 * Accepts single file upload in req.file (or base64 fallback in req.body.fileData)
 */
export async function uploadFile(req, res, next) {
  try {
    let fileBuffer;
    let fileName;
    let mimeType;
    const bucket = req.body.bucket || req.query.bucket || 'general';

    if (req.file) {
      fileBuffer = req.file.buffer;
      fileName = req.file.originalname;
      mimeType = req.file.mimetype;
    } else if (req.body.fileData && req.body.fileName) {
      // Base64 fallback support for simple inline uploads
      const base64Data = req.body.fileData.replace(/^data:[^;]+;base64,/, '');
      fileBuffer = Buffer.from(base64Data, 'base64');
      fileName = req.body.fileName;
      mimeType = req.body.mimeType || 'application/octet-stream';
    } else {
      return res.status(400).json({ error: 'No file provided. Attach file field or send base64 fileData.' });
    }

    // Size limit check (10MB)
    if (fileBuffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'File size exceeds maximum limit of 10MB.' });
    }

    const result = await uploadFileToStorage({
      bucket,
      fileBuffer,
      fileName,
      mimeType
    });

    res.status(201).json({
      message: 'File uploaded successfully',
      fileUrl: result.fileUrl,
      fileName: result.fileName,
      filePath: result.filePath,
      storageProvider: result.storageProvider
    });
  } catch (err) {
    next(err);
  }
}
