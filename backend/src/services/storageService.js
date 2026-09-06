import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from '../config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Ensure local upload directories exist for local disk fallback
['center-documents', 'health-records', 'general'].forEach(subDir => {
  const targetDir = path.join(UPLOADS_DIR, subDir);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
});

/**
 * Uploads a binary file buffer to Supabase Storage with local filesystem fallback
 * @param {Object} params
 * @param {string} params.bucket - Target bucket ('center-documents' | 'health-records' | 'general')
 * @param {Buffer} params.fileBuffer - Raw binary file buffer
 * @param {string} params.fileName - Original or target filename
 * @param {string} params.mimeType - MIME type (e.g. 'application/pdf', 'image/png')
 * @returns {Promise<{ success: boolean, fileUrl: string, filePath: string, storageProvider: string }>}
 */
export async function uploadFileToStorage({ bucket = 'general', fileBuffer, fileName, mimeType }) {
  const sanitizedName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const targetBucket = ['center-documents', 'health-records'].includes(bucket) ? bucket : 'general';

  // 1. Attempt Supabase Storage Upload
  try {
    const { data, error } = await supabase.storage
      .from(targetBucket)
      .upload(sanitizedName, fileBuffer, {
        contentType: mimeType || 'application/octet-stream',
        upsert: true
      });

    if (!error && data?.path) {
      const { data: urlData } = supabase.storage.from(targetBucket).getPublicUrl(data.path);
      const publicUrl = urlData?.publicUrl || `${process.env.SUPABASE_URL}/storage/v1/object/public/${targetBucket}/${data.path}`;
      
      console.log(`[STORAGE SERVICE] Uploaded to Supabase Storage (${targetBucket}): ${publicUrl}`);
      return {
        success: true,
        fileUrl: publicUrl,
        filePath: data.path,
        fileName: sanitizedName,
        storageProvider: 'supabase'
      };
    } else {
      console.warn(`[STORAGE SERVICE NOTICE] Supabase bucket '${targetBucket}' notice: ${error?.message || 'Using local fallback'}`);
    }
  } catch (supabaseErr) {
    console.warn(`[STORAGE SERVICE NOTICE] Supabase storage exception: ${supabaseErr.message}`);
  }

  // 2. Local Disk Fallback (Guarantees zero file loss during prototype testing)
  const localBucketDir = path.join(UPLOADS_DIR, targetBucket);
  const localFilePath = path.join(localBucketDir, sanitizedName);
  fs.writeFileSync(localFilePath, fileBuffer);

  const baseUrl = process.env.VITE_API_BASE_URL
    ? process.env.VITE_API_BASE_URL.replace(/\/api$/, '')
    : `http://localhost:${process.env.PORT || 5000}`;
  const localUrl = `${baseUrl}/uploads/${targetBucket}/${sanitizedName}`;

  console.log(`[STORAGE SERVICE] Saved to local fallback storage: ${localUrl}`);
  return {
    success: true,
    fileUrl: localUrl,
    filePath: `${targetBucket}/${sanitizedName}`,
    fileName: sanitizedName,
    storageProvider: 'local'
  };
}
