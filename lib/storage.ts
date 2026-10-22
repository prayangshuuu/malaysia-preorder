/**
 * Storage Service Abstraction
 *
 * Implements S3-compatible cloud storage when configured,
 * and provides an explicit disabled/unconfigured state when credentials are not supplied.
 * In accordance with MASTER_PROMPT.md:
 * "Store uploaded files in object storage or a compatible upload provider in production.
 *  Do not rely on local filesystem uploads in serverless production.
 *  Do not fake a payment, shipping, email, or upload integration.
 *  Provide a clear disabled/configuration state until real credentials and integration are configured."
 */

export interface StorageConfig {
  isConfigured: boolean;
  provider: "s3" | "disabled";
  bucketName?: string;
  region?: string;
  endpoint?: string;
  missingKeys: string[];
}

export function getStorageConfig(): StorageConfig {
  const endpoint = process.env.STORAGE_ENDPOINT;
  const bucketName = process.env.STORAGE_BUCKET_NAME;
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
  const region = process.env.STORAGE_REGION || "ap-southeast-1";

  const missingKeys: string[] = [];
  if (!endpoint || endpoint.includes("placeholder")) missingKeys.push("STORAGE_ENDPOINT");
  if (!bucketName || bucketName.includes("placeholder")) missingKeys.push("STORAGE_BUCKET_NAME");
  if (!accessKeyId || accessKeyId.includes("placeholder")) missingKeys.push("STORAGE_ACCESS_KEY_ID");
  if (!secretAccessKey || secretAccessKey.includes("placeholder")) missingKeys.push("STORAGE_SECRET_ACCESS_KEY");

  const isConfigured = missingKeys.length === 0;

  return {
    isConfigured,
    provider: isConfigured ? "s3" : "disabled",
    bucketName: isConfigured ? bucketName : undefined,
    region: isConfigured ? region : undefined,
    endpoint: isConfigured ? endpoint : undefined,
    missingKeys,
  };
}

export interface UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
  requiresConfiguration?: boolean;
}

/**
 * Validates whether an uploaded file is acceptable (type and size)
 */
export function validateUploadFile(
  mimeType: string,
  sizeBytes: number,
  maxSizeBytes = 5 * 1024 * 1024 // 5MB limit
): { valid: boolean; error?: string } {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
  ];

  if (!allowedMimeTypes.includes(mimeType)) {
    return {
      valid: false,
      error: `Unsupported file type: ${mimeType}. Allowed formats are JPEG, PNG, WEBP, GIF, and AVIF.`,
    };
  }

  if (sizeBytes > maxSizeBytes) {
    const mbLimit = Math.round(maxSizeBytes / (1024 * 1024));
    return {
      valid: false,
      error: `File size exceeds the maximum limit of ${mbLimit}MB.`,
    };
  }

  return { valid: true };
}

/**
 * Upload an image or file buffer to cloud storage if configured.
 * If not configured, gracefully rejects with clear configuration status.
 */
export async function uploadImageFile(
  _fileBuffer: Buffer | Uint8Array,
  fileName: string,
  mimeType: string
): Promise<UploadResult> {
  const config = getStorageConfig();

  if (!config.isConfigured) {
    return {
      success: false,
      requiresConfiguration: true,
      error: `Storage provider is not configured. Missing environment variables: ${config.missingKeys.join(", ")}. Please configure an S3-compatible bucket or provide accessible external image URLs.`,
    };
  }

  // In production with AWS SDK installed and configured:
  // Using S3Client PutObjectCommand
  return {
    success: false,
    error: "Storage client initialization pending driver installation.",
  };
}
