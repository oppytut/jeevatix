import { createRoute, OpenAPIHono } from '@hono/zod-openapi';

import { authMiddleware, type AuthEnv } from '../middleware/auth';
import {
  uploadErrorResponseSchema,
  uploadFormSchema,
  uploadSuccessResponseSchema,
} from '../schemas/upload.schema';
import { UploadServiceError, uploadService } from '../services/upload.service';

const app = new OpenAPIHono<AuthEnv>();

app.use('*', authMiddleware);

function jsonError(code: string, message: string) {
  return {
    success: false as const,
    error: {
      code,
      message,
    },
  };
}

function getStatusFromError(error: UploadServiceError) {
  switch (error.code) {
    case 'FILE_REQUIRED':
    case 'FILE_TOO_LARGE':
    case 'INVALID_FILE_TYPE':
      return 400;
    case 'BUCKET_NOT_CONFIGURED':
    case 'UPLOAD_PUBLIC_URL_MISSING':
      return 500;
    default:
      return 400;
  }
}

function handleError(
  c: Parameters<typeof app.openapi>[1] extends (arg: infer T) => unknown ? T : never,
  error: unknown,
) {
  if (error instanceof UploadServiceError) {
    return c.json(jsonError(error.code, error.message), getStatusFromError(error));
  }

  return c.json(jsonError('INTERNAL_SERVER_ERROR', 'Unexpected error occurred.'), 500);
}

const uploadRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Upload'],
  summary: 'Upload an image file to Cloudflare R2',
  request: {
    body: {
      required: true,
      content: {
        'multipart/form-data': {
          schema: uploadFormSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'File uploaded successfully',
      content: {
        'application/json': {
          schema: uploadSuccessResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid upload request',
      content: {
        'application/json': {
          schema: uploadErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Authentication required',
      content: {
        'application/json': {
          schema: uploadErrorResponseSchema,
        },
      },
    },
  },
});

app.openapi(uploadRoute, async (c) => {
  try {
    const formData = await c.req.formData();
    const fileEntry = formData.get('file');

    if (!(fileEntry instanceof File)) {
      return c.json(jsonError('FILE_REQUIRED', 'File is required.'), 400);
    }

    const result = await uploadService.uploadFile(c.env, fileEntry);

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

export default app;
