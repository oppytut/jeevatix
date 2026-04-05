import { describe, expect, it, vi } from 'vitest';

import { uploadService, UploadServiceError } from '../services/upload.service';

describe('upload service', () => {
  it('uploads a supported file to the configured bucket', async () => {
    const put = vi.fn(async () => undefined);
    const response = await uploadService.uploadFile(
      {
        BUCKET: { put } as unknown as R2Bucket,
        UPLOAD_PUBLIC_URL: 'https://cdn.example.com/assets',
      } as never,
      new File([new Uint8Array([1, 2, 3])], 'poster.png', { type: 'image/png' }),
    );

    expect(put).toHaveBeenCalledOnce();
    expect(response.url).toMatch(/^https:\/\/cdn\.example\.com\/assets\/uploads\/.+\.png$/);
  });

  it('rejects uploads when the bucket is missing', async () => {
    await expect(
      uploadService.uploadFile(
        {
          UPLOAD_PUBLIC_URL: 'https://cdn.example.com/assets',
        } as never,
        new File([new Uint8Array([1])], 'poster.png', { type: 'image/png' }),
      ),
    ).rejects.toMatchObject({
      code: 'BUCKET_NOT_CONFIGURED',
    } satisfies Partial<UploadServiceError>);
  });

  it('rejects unsupported file types', async () => {
    await expect(
      uploadService.uploadFile(
        {
          BUCKET: { put: vi.fn() } as unknown as R2Bucket,
          UPLOAD_PUBLIC_URL: 'https://cdn.example.com/assets',
        } as never,
        new File([new Uint8Array([1])], 'poster.gif', { type: 'image/gif' }),
      ),
    ).rejects.toMatchObject({
      code: 'INVALID_FILE_TYPE',
    } satisfies Partial<UploadServiceError>);
  });

  it('rejects oversized files', async () => {
    await expect(
      uploadService.uploadFile(
        {
          BUCKET: { put: vi.fn() } as unknown as R2Bucket,
          UPLOAD_PUBLIC_URL: 'https://cdn.example.com/assets',
        } as never,
        new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'poster.png', { type: 'image/png' }),
      ),
    ).rejects.toMatchObject({
      code: 'FILE_TOO_LARGE',
    } satisfies Partial<UploadServiceError>);
  });

  it('rejects uploads when the public URL is missing', async () => {
    await expect(
      uploadService.uploadFile(
        {
          BUCKET: { put: vi.fn() } as unknown as R2Bucket,
        } as never,
        new File([new Uint8Array([1])], 'poster.png', { type: 'image/png' }),
      ),
    ).rejects.toMatchObject({
      code: 'UPLOAD_PUBLIC_URL_MISSING',
    } satisfies Partial<UploadServiceError>);
  });
});
