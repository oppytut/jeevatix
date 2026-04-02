import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import app from '../index';
import { UploadServiceError, uploadService } from '../services/upload.service';
import { createTransactionTestContext } from './transaction-test-helpers';

const context = createTransactionTestContext('vitest-p10-upload-route');

describe.sequential('upload route', () => {
  beforeAll(async () => {
    await context.cleanupTestData();
  });

  afterEach(async () => {
    await context.cleanupTestData();
  });

  afterAll(async () => {
    await context.cleanupTestData();
  });

  it('rejects unauthenticated upload requests', async () => {
    const form = new FormData();
    form.set('file', new File([new Uint8Array([1])], 'poster.png', { type: 'image/png' }));

    const response = await app.request(
      '/upload',
      {
        method: 'POST',
        body: form,
      },
      {
        ...context.env(),
        BUCKET: { put: vi.fn() } as unknown as R2Bucket,
        UPLOAD_PUBLIC_URL: 'https://cdn.example.com/assets',
      },
    );
    const payload = (await response.json()) as {
      success: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(401);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('UNAUTHORIZED');
  });

  it('uploads a file for an authenticated user', async () => {
    const buyer = await context.createBuyerFixture();
    const put = vi.fn(async () => undefined);
    const form = new FormData();
    form.set('file', new File([new Uint8Array([1, 2, 3])], 'poster.png', { type: 'image/png' }));

    const response = await app.request(
      '/upload',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${buyer.token}`,
        },
        body: form,
      },
      {
        ...context.env(),
        BUCKET: { put } as unknown as R2Bucket,
        UPLOAD_PUBLIC_URL: 'https://cdn.example.com/assets',
      },
    );
    const payload = (await response.json()) as {
      success: boolean;
      data: { url: string };
    };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.url).toMatch(/^https:\/\/cdn\.example\.com\/assets\/uploads\/.+\.png$/);
    expect(put).toHaveBeenCalledOnce();
  });

  it('returns file required when the multipart body does not contain a file', async () => {
    const buyer = await context.createBuyerFixture();
    const response = await app.request(
      '/upload',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${buyer.token}`,
        },
        body: new FormData(),
      },
      {
        ...context.env(),
        BUCKET: { put: vi.fn() } as unknown as R2Bucket,
        UPLOAD_PUBLIC_URL: 'https://cdn.example.com/assets',
      },
    );
    const payload = (await response.json()) as {
      success: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('FILE_REQUIRED');
  });

  it('maps upload validation errors to a bad request response', async () => {
    const buyer = await context.createBuyerFixture();
    const form = new FormData();
    form.set('file', new File([new Uint8Array([1])], 'poster.gif', { type: 'image/gif' }));

    const response = await app.request(
      '/upload',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${buyer.token}`,
        },
        body: form,
      },
      {
        ...context.env(),
        BUCKET: { put: vi.fn() } as unknown as R2Bucket,
        UPLOAD_PUBLIC_URL: 'https://cdn.example.com/assets',
      },
    );
    const payload = (await response.json()) as {
      success: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('INVALID_FILE_TYPE');
  });

  it('returns an internal error when the bucket write fails unexpectedly', async () => {
    const buyer = await context.createBuyerFixture();
    const form = new FormData();
    form.set('file', new File([new Uint8Array([1, 2, 3])], 'poster.png', { type: 'image/png' }));

    const response = await app.request(
      '/upload',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${buyer.token}`,
        },
        body: form,
      },
      {
        ...context.env(),
        BUCKET: {
          put: vi.fn(async () => {
            throw new Error('r2 unavailable');
          }),
        } as unknown as R2Bucket,
        UPLOAD_PUBLIC_URL: 'https://cdn.example.com/assets',
      },
    );
    const payload = (await response.json()) as {
      success: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('maps upload configuration errors to a server response', async () => {
    const buyer = await context.createBuyerFixture();
    const form = new FormData();
    form.set('file', new File([new Uint8Array([1, 2, 3])], 'poster.png', { type: 'image/png' }));

    const response = await app.request(
      '/upload',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${buyer.token}`,
        },
        body: form,
      },
      {
        ...context.env(),
        BUCKET: { put: vi.fn(async () => undefined) } as unknown as R2Bucket,
      },
    );
    const payload = (await response.json()) as {
      success: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('UPLOAD_PUBLIC_URL_MISSING');
  });

  it('falls back to bad request for unknown upload service error codes', async () => {
    const buyer = await context.createBuyerFixture();
    const form = new FormData();
    form.set('file', new File([new Uint8Array([1, 2, 3])], 'poster.png', { type: 'image/png' }));
    const uploadSpy = vi
      .spyOn(uploadService, 'uploadFile')
      .mockRejectedValueOnce(
        new UploadServiceError('UNKNOWN_UPLOAD_ERROR' as never, 'Unexpected upload error.'),
      );

    const response = await app.request(
      '/upload',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${buyer.token}`,
        },
        body: form,
      },
      {
        ...context.env(),
        BUCKET: { put: vi.fn(async () => undefined) } as unknown as R2Bucket,
        UPLOAD_PUBLIC_URL: 'https://cdn.example.com/assets',
      },
    );
    const payload = (await response.json()) as {
      success: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('UNKNOWN_UPLOAD_ERROR');

    uploadSpy.mockRestore();
  });
});