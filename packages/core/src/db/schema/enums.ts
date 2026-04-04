import { pgEnum } from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['buyer', 'seller', 'admin']);

export const userStatus = pgEnum('user_status', ['active', 'suspended', 'banned']);

export const eventStatus = pgEnum('event_status', [
  'draft',
  'pending_review',
  'published',
  'rejected',
  'ongoing',
  'completed',
  'cancelled',
]);

export const ticketTierStatus = pgEnum('ticket_tier_status', ['available', 'sold_out', 'hidden']);

export const orderStatus = pgEnum('order_status', [
  'pending',
  'confirmed',
  'expired',
  'cancelled',
  'refunded',
]);

export const paymentStatus = pgEnum('payment_status', ['pending', 'success', 'failed', 'refunded']);

export const paymentMethod = pgEnum('payment_method', [
  'bank_transfer',
  'e_wallet',
  'credit_card',
  'virtual_account',
]);

export const reservationStatus = pgEnum('reservation_status', [
  'active',
  'converted',
  'expired',
  'cancelled',
]);

export const ticketStatus = pgEnum('ticket_status', ['valid', 'used', 'cancelled', 'refunded']);

export const notificationType = pgEnum('notification_type', [
  'order_confirmed',
  'payment_reminder',
  'event_reminder',
  'new_order',
  'event_approved',
  'event_rejected',
  'info',
]);
