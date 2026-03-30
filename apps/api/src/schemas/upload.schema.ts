import { z } from '@hono/zod-openapi';

export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_SIZE = 5 * 1024 * 1024;

export const uploadFormSchema = z
  .object({
    file: z.any().openapi({
      type: 'string',
      format: 'binary',
    }),
  })
  .openapi('UploadFormInput');

export const uploadResponseSchema = z
  .object({
    url: z.string().openapi({ example: 'https://assets.jeevatix.id/uploads/abc123.png' }),
  })
  .openapi('UploadResponse');

export const uploadSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: uploadResponseSchema,
  })
  .openapi('UploadSuccessResponse');

export const uploadErrorResponseSchema = z
  .object({
    success: z.literal(false),
    error: z.object({
      code: z.string().openapi({ example: 'INVALID_FILE_TYPE' }),
      message: z.string().openapi({ example: 'Only JPEG, PNG, and WEBP images are allowed.' }),
    }),
  })
  .openapi('UploadErrorResponse');

export type AllowedUploadType = (typeof ALLOWED_TYPES)[number];
export type UploadResponse = z.infer<typeof uploadResponseSchema>;
