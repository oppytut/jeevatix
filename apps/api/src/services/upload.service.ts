import type { AuthEnv } from '../middleware/auth';
import {
  ALLOWED_TYPES,
  MAX_SIZE,
  type AllowedUploadType,
  type UploadResponse,
} from '../schemas/upload.schema';

const EXTENSION_MAP: Record<AllowedUploadType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

type UploadBindings = AuthEnv['Bindings'];

export class UploadServiceError extends Error {
  constructor(
    public readonly code:
      | 'BUCKET_NOT_CONFIGURED'
      | 'FILE_REQUIRED'
      | 'FILE_TOO_LARGE'
      | 'INVALID_FILE_TYPE'
      | 'UPLOAD_PUBLIC_URL_MISSING',
    message: string,
  ) {
    super(message);
    this.name = 'UploadServiceError';
  }
}

function getProcessEnv(key: string) {
  return (
    globalThis as typeof globalThis & {
      process?: {
        env?: Record<string, string | undefined>;
      };
    }
  ).process?.env?.[key];
}

function isAllowedType(type: string): type is AllowedUploadType {
  return ALLOWED_TYPES.includes(type as AllowedUploadType);
}

function resolveUploadPublicUrl(envPublicBaseUrl?: string) {
  return envPublicBaseUrl || getProcessEnv('UPLOAD_PUBLIC_URL');
}

function buildUploadUrl(key: string, publicBaseUrl: string) {
  return new URL(key, publicBaseUrl.endsWith('/') ? publicBaseUrl : `${publicBaseUrl}/`).toString();
}

export const uploadService = {
  async uploadFile(env: UploadBindings, file: File): Promise<UploadResponse> {
    if (!env.BUCKET) {
      throw new UploadServiceError('BUCKET_NOT_CONFIGURED', 'Upload bucket is not configured.');
    }

    if (!file) {
      throw new UploadServiceError('FILE_REQUIRED', 'File is required.');
    }

    if (!isAllowedType(file.type)) {
      throw new UploadServiceError(
        'INVALID_FILE_TYPE',
        'Only JPEG, PNG, and WEBP images are allowed.',
      );
    }

    if (file.size > MAX_SIZE) {
      throw new UploadServiceError('FILE_TOO_LARGE', 'File size must not exceed 5 MB.');
    }

    const uploadPublicUrl = resolveUploadPublicUrl(env.UPLOAD_PUBLIC_URL);

    if (!uploadPublicUrl) {
      throw new UploadServiceError(
        'UPLOAD_PUBLIC_URL_MISSING',
        'Upload public URL is not configured.',
      );
    }

    const extension = EXTENSION_MAP[file.type];
    const key = `uploads/${crypto.randomUUID()}.${extension}`;

    await env.BUCKET.put(key, file, {
      httpMetadata: {
        contentType: file.type,
      },
    });

    return {
      url: buildUploadUrl(key, uploadPublicUrl),
    };
  },
};
