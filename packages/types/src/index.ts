export type UserRole = 'buyer' | 'seller' | 'admin';

export type UserStatus = 'active' | 'suspended' | 'banned';

export type EventStatus =
  | 'draft'
  | 'pending_review'
  | 'published'
  | 'rejected'
  | 'ongoing'
  | 'completed'
  | 'cancelled';

export type TicketTierStatus = 'available' | 'sold_out' | 'hidden';

export type OrderStatus = 'pending' | 'confirmed' | 'expired' | 'cancelled' | 'refunded';

export type PaymentStatus = 'pending' | 'success' | 'failed' | 'refunded';

export type PaymentMethod = 'bank_transfer' | 'e_wallet' | 'credit_card' | 'virtual_account';

export type ReservationStatus = 'active' | 'converted' | 'expired' | 'cancelled';

export type TicketStatus = 'valid' | 'used' | 'cancelled' | 'refunded';

export type NotificationType =
  | 'order_confirmed'
  | 'payment_reminder'
  | 'event_reminder'
  | 'new_order'
  | 'event_approved'
  | 'event_rejected'
  | 'info';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: UserStatus;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SellerProfile {
  id: string;
  user_id: string;
  org_name: string;
  org_description: string | null;
  logo_url: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_holder: string | null;
  is_verified: boolean;
  verified_at: string | null;
  verified_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  created_at: string;
}

export interface Event {
  id: string;
  seller_profile_id: string;
  title: string;
  slug: string;
  description: string | null;
  venue_name: string;
  venue_address: string | null;
  venue_city: string;
  venue_latitude: string | null;
  venue_longitude: string | null;
  start_at: string;
  end_at: string;
  sale_start_at: string;
  sale_end_at: string;
  banner_url: string | null;
  status: EventStatus;
  max_tickets_per_order: number;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventCategory {
  event_id: string;
  category_id: number;
}

export interface EventImage {
  id: string;
  event_id: string;
  image_url: string;
  sort_order: number;
  created_at: string;
}

export interface TicketTier {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  price: string;
  quota: number;
  sold_count: number;
  sort_order: number;
  status: TicketTierStatus;
  sale_start_at: string | null;
  sale_end_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Reservation {
  id: string;
  user_id: string;
  ticket_tier_id: string;
  quantity: number;
  status: ReservationStatus;
  expires_at: string;
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  reservation_id: string | null;
  order_number: string;
  total_amount: string;
  service_fee: string;
  status: OrderStatus;
  expires_at: string;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  ticket_tier_id: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
}

export interface Payment {
  id: string;
  order_id: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: string;
  external_ref: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  id: string;
  order_id: string;
  ticket_tier_id: string;
  ticket_code: string;
  attendee_name: string | null;
  attendee_email: string | null;
  status: TicketStatus;
  issued_at: string;
  created_at: string;
}

export interface TicketCheckin {
  id: string;
  ticket_id: string;
  checked_in_at: string;
  checked_in_by: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  is_read: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface RefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
