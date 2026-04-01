import { z } from '@hono/zod-openapi';

export const paymentMethodSchema = z.enum([
  'bank_transfer',
  'e_wallet',
  'credit_card',
  'virtual_account',
]);

const paymentStatusSchema = z.enum(['pending', 'success', 'failed', 'refunded']);
const webhookResultStatusSchema = z.enum(['ignored', 'failed', 'success']);

export const initiatePaymentSchema = z
  .object({
    method: paymentMethodSchema.openapi({ example: 'bank_transfer' }),
  })
  .openapi('InitiatePaymentInput');

export const paymentOrderIdParamSchema = z
  .object({
    orderId: z.string().uuid().openapi({ example: 'f4fe78e2-4909-4fd4-bf51-f65077a355ea' }),
  })
  .openapi('PaymentOrderIdParam');

export const initiatePaymentPayloadSchema = z
  .object({
    order_id: z.string().uuid().openapi({ example: 'f4fe78e2-4909-4fd4-bf51-f65077a355ea' }),
    payment_id: z.string().uuid().openapi({ example: 'fb16c03d-c050-4ec9-bc36-e756bc7a12b5' }),
    method: paymentMethodSchema.openapi({ example: 'bank_transfer' }),
    status: paymentStatusSchema.openapi({ example: 'pending' }),
    external_ref: z.string().openapi({ example: 'PAY-20260401-AB12CD34' }),
    payment_url: z
      .string()
      .url()
      .nullable()
      .openapi({ example: 'https://payments.mock.jeevatix.id/pay/PAY-20260401-AB12CD34' }),
  })
  .openapi('InitiatePaymentPayload');

export const initiatePaymentResponseSchema = z
  .object({
    success: z.literal(true),
    data: initiatePaymentPayloadSchema,
  })
  .openapi('InitiatePaymentResponse');

export const paymentWebhookSchema = z
  .object({
    external_ref: z.string().min(1).openapi({ example: 'PAY-20260401-AB12CD34' }),
    status: z.enum(['success', 'failed']).openapi({ example: 'success' }),
    paid_at: z.string().datetime().optional().openapi({ example: '2026-04-01T03:20:00.000Z' }),
    metadata: z.record(z.string(), z.unknown()).optional().openapi({
      example: {
        gateway: 'mock-gateway',
      },
    }),
  })
  .openapi('PaymentWebhookInput');

export const paymentWebhookPayloadSchema = z
  .object({
    order_id: z.string().uuid().openapi({ example: 'f4fe78e2-4909-4fd4-bf51-f65077a355ea' }),
    payment_id: z.string().uuid().openapi({ example: 'fb16c03d-c050-4ec9-bc36-e756bc7a12b5' }),
    external_ref: z.string().openapi({ example: 'PAY-20260401-AB12CD34' }),
    status: webhookResultStatusSchema.openapi({ example: 'success' }),
  })
  .openapi('PaymentWebhookPayload');

export const paymentWebhookResponseSchema = z
  .object({
    success: z.literal(true),
    data: paymentWebhookPayloadSchema,
  })
  .openapi('PaymentWebhookResponse');

export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>;
export type PaymentOrderIdParam = z.infer<typeof paymentOrderIdParamSchema>;
export type InitiatePaymentPayload = z.infer<typeof initiatePaymentPayloadSchema>;
export type PaymentWebhookInput = z.infer<typeof paymentWebhookSchema>;
export type PaymentWebhookPayload = z.infer<typeof paymentWebhookPayloadSchema>;