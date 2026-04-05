import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const PORT = 8787;

function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, x-payment-signature');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
}

const baseCategories = [
  { id: 1, name: 'Musik', slug: 'musik', icon: 'music-2' },
  { id: 2, name: 'Olahraga', slug: 'olahraga', icon: 'dumbbell' },
  { id: 3, name: 'Workshop', slug: 'workshop', icon: 'wrench' },
  { id: 4, name: 'Konser', slug: 'konser', icon: 'mic-vocal' },
  { id: 5, name: 'Festival', slug: 'festival', icon: 'ferris-wheel' },
];

function createState() {
  const now = new Date().toISOString();

  return {
    users: [
      {
        id: randomUUID(),
        email: 'admin@jeevatix.id',
        password: 'Admin123!',
        full_name: 'Admin Jeevatix',
        phone: '081111111111',
        avatar_url: null,
        role: 'admin',
        status: 'active',
        email_verified_at: now,
        created_at: now,
        updated_at: now,
      },
    ],
    sellerProfiles: [],
    categories: baseCategories.map((category) => ({ ...category })),
    events: [],
    reservations: [],
    orders: [],
    payments: [],
    tickets: [],
    notifications: [],
    checkins: [],
  };
}

let state = createState();

function sendJson(res, status, payload) {
  applyCors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function sendSuccess(res, data, meta, status = 200) {
  sendJson(res, status, meta ? { success: true, data, meta } : { success: true, data });
}

function sendError(res, status, code, message) {
  sendJson(res, status, {
    success: false,
    error: {
      code,
      message,
    },
  });
}

function encodeTokenPart(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function createToken(user, expiresInSeconds = 60 * 60) {
  const now = Math.floor(Date.now() / 1000);
  return `${encodeTokenPart({ alg: 'HS256', typ: 'JWT' })}.${encodeTokenPart({
    sub: user.id,
    email: user.email,
    role: user.role,
    exp: now + expiresInSeconds,
  })}.mock`;
}

function parseToken(token) {
  try {
    const [, payload] = token.split('.');
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded?.sub || !decoded?.exp || decoded.exp * 1000 <= Date.now()) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function getAuthorizedUser(req, role) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return null;
  }

  const payload = parseToken(header.slice(7));
  const user = state.users.find((candidate) => candidate.id === payload?.sub);

  if (!user) {
    return null;
  }

  if (role && user.role !== role) {
    return 'forbidden';
  }

  return user;
}

function createAuthPayload(user) {
  return {
    access_token: createToken(user, 60 * 60),
    refresh_token: createToken(user, 60 * 60 * 24 * 7),
    user,
  };
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function getSellerProfileByUserId(userId) {
  return state.sellerProfiles.find((profile) => profile.user_id === userId) ?? null;
}

function buildMeta(total, page, limit) {
  return {
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

function reservedCountForTier(tierId) {
  return state.reservations
    .filter((reservation) => reservation.ticket_tier_id === tierId && reservation.status === 'active')
    .reduce((total, reservation) => total + reservation.quantity, 0);
}

function eventMinPrice(event) {
  if (event.tiers.length === 0) {
    return null;
  }

  return Math.min(...event.tiers.map((tier) => tier.price));
}

function toPublicEventListItem(event) {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description,
    banner_url: event.banner_url,
    venue_name: event.venue_name,
    venue_city: event.venue_city,
    start_at: event.start_at,
    end_at: event.end_at,
    sale_start_at: event.sale_start_at,
    sale_end_at: event.sale_end_at,
    status: event.status,
    is_featured: event.is_featured,
    max_tickets_per_order: event.max_tickets_per_order,
    min_price: eventMinPrice(event),
  };
}

function toPublicEventDetail(event) {
  const sellerProfile = state.sellerProfiles.find((profile) => profile.id === event.seller_profile_id);

  return {
    ...toPublicEventListItem(event),
    seller_profile_id: event.seller_profile_id,
    venue_address: event.venue_address,
    venue_latitude: event.venue_latitude,
    venue_longitude: event.venue_longitude,
    categories: event.category_ids
      .map((categoryId) => state.categories.find((category) => category.id === categoryId))
      .filter(Boolean)
      .map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        icon: category.icon,
      })),
    images: event.images,
    tiers: event.tiers.map((tier) => ({
      ...tier,
      remaining: Math.max(tier.quota - tier.sold_count - reservedCountForTier(tier.id), 0),
    })),
    seller: {
      id: sellerProfile?.id ?? '',
      org_name: sellerProfile?.org_name ?? 'Seller',
      org_description: sellerProfile?.org_description ?? null,
      logo_url: sellerProfile?.logo_url ?? null,
      is_verified: sellerProfile?.is_verified ?? false,
    },
    created_at: event.created_at,
    updated_at: event.updated_at,
  };
}

function toSellerEventDetail(event) {
  return {
    id: event.id,
    seller_profile_id: event.seller_profile_id,
    title: event.title,
    slug: event.slug,
    description: event.description,
    venue_name: event.venue_name,
    venue_address: event.venue_address,
    venue_city: event.venue_city,
    venue_latitude: event.venue_latitude,
    venue_longitude: event.venue_longitude,
    start_at: event.start_at,
    end_at: event.end_at,
    sale_start_at: event.sale_start_at,
    sale_end_at: event.sale_end_at,
    banner_url: event.banner_url,
    status: event.status,
    max_tickets_per_order: event.max_tickets_per_order,
    total_quota: event.tiers.reduce((total, tier) => total + tier.quota, 0),
    total_sold: event.tiers.reduce((total, tier) => total + tier.sold_count, 0),
    categories: event.category_ids
      .map((categoryId) => state.categories.find((category) => category.id === categoryId))
      .filter(Boolean)
      .map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        icon: category.icon,
      })),
    images: event.images,
    tiers: event.tiers,
    created_at: event.created_at,
    updated_at: event.updated_at,
  };
}

function createOrderNumber() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${`${now.getMonth() + 1}`.padStart(2, '0')}${`${now.getDate()}`.padStart(2, '0')}`;
  return `JVX-${stamp}-${`${state.orders.length + 1}`.padStart(5, '0')}`;
}

function createTicketCode() {
  return `JVX-${Math.random().toString(36).slice(2, 14).toUpperCase().padEnd(12, '0').slice(0, 12)}`;
}

function toOrderListItem(order) {
  return {
    id: order.id,
    reservation_id: order.reservation_id,
    order_number: order.order_number,
    status: order.status,
    total_amount: order.total_amount,
    event_id: order.event_id,
    event_slug: order.event_slug,
    event_title: order.event_title,
    created_at: order.created_at,
    expires_at: order.expires_at,
  };
}

function toOrderDetail(order) {
  const payment = state.payments.find((candidate) => candidate.order_id === order.id);
  const tickets = state.tickets
    .filter((candidate) => candidate.order_id === order.id)
    .map((ticket) => ({
      id: ticket.id,
      ticket_tier_id: ticket.ticket_tier_id,
      ticket_code: ticket.ticket_code,
      status: ticket.status,
      issued_at: ticket.issued_at,
    }));

  return {
    id: order.id,
    reservation_id: order.reservation_id,
    order_number: order.order_number,
    status: order.status,
    total_amount: order.total_amount,
    service_fee: order.service_fee,
    expires_at: order.expires_at,
    confirmed_at: order.confirmed_at,
    created_at: order.created_at,
    updated_at: order.updated_at,
    event_id: order.event_id,
    event_slug: order.event_slug,
    event_title: order.event_title,
    items: order.items,
    payment,
    tickets,
  };
}

function toAdminEventListItem(event) {
  const sellerProfile = state.sellerProfiles.find((profile) => profile.id === event.seller_profile_id);
  const sellerUser = state.users.find((candidate) => candidate.id === sellerProfile?.user_id);

  return {
    id: event.id,
    title: event.title,
    slug: event.slug,
    status: event.status,
    venueCity: event.venue_city,
    startAt: event.start_at,
    endAt: event.end_at,
    bannerUrl: event.banner_url,
    sellerProfileId: event.seller_profile_id,
    sellerName: sellerProfile?.org_name ?? sellerUser?.full_name ?? 'Seller',
    sellerUserId: sellerUser?.id ?? '',
    sellerVerified: sellerProfile?.is_verified ?? false,
    totalQuota: event.tiers.reduce((total, tier) => total + tier.quota, 0),
    totalSold: event.tiers.reduce((total, tier) => total + tier.sold_count, 0),
    createdAt: event.created_at,
    updatedAt: event.updated_at,
  };
}

function toAdminEventDetail(event) {
  const sellerProfile = state.sellerProfiles.find((profile) => profile.id === event.seller_profile_id);
  const sellerUser = state.users.find((candidate) => candidate.id === sellerProfile?.user_id);
  const relatedOrders = state.orders.filter((order) => order.event_id === event.id);
  const confirmedOrders = relatedOrders.filter((order) => order.status === 'confirmed');

  return {
    id: event.id,
    sellerProfileId: event.seller_profile_id,
    title: event.title,
    slug: event.slug,
    description: event.description,
    venueName: event.venue_name,
    venueAddress: event.venue_address,
    venueCity: event.venue_city,
    venueLatitude: event.venue_latitude,
    venueLongitude: event.venue_longitude,
    startAt: event.start_at,
    endAt: event.end_at,
    saleStartAt: event.sale_start_at,
    saleEndAt: event.sale_end_at,
    bannerUrl: event.banner_url,
    status: event.status,
    maxTicketsPerOrder: event.max_tickets_per_order,
    isFeatured: event.is_featured,
    createdAt: event.created_at,
    updatedAt: event.updated_at,
    seller: {
      id: sellerProfile?.id ?? '',
      userId: sellerUser?.id ?? '',
      orgName: sellerProfile?.org_name ?? 'Seller',
      orgDescription: sellerProfile?.org_description ?? null,
      logoUrl: sellerProfile?.logo_url ?? null,
      isVerified: sellerProfile?.is_verified ?? false,
      fullName: sellerUser?.full_name ?? 'Seller',
      email: sellerUser?.email ?? '',
      phone: sellerUser?.phone ?? null,
    },
    categories: event.category_ids
      .map((categoryId) => state.categories.find((category) => category.id === categoryId))
      .filter(Boolean)
      .map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        icon: category.icon ?? null,
      })),
    images: event.images.map((image) => ({
      id: image.id,
      imageUrl: image.image_url,
      sortOrder: image.sort_order,
      createdAt: image.created_at,
    })),
    tiers: event.tiers.map((tier) => ({
      id: tier.id,
      name: tier.name,
      description: tier.description,
      price: tier.price,
      quota: tier.quota,
      soldCount: tier.sold_count,
      sortOrder: tier.sort_order,
      status: tier.status,
      saleStartAt: tier.sale_start_at,
      saleEndAt: tier.sale_end_at,
      createdAt: tier.created_at,
      updatedAt: tier.updated_at,
    })),
    stats: {
      orderCount: relatedOrders.length,
      confirmedOrderCount: confirmedOrders.length,
      ticketsSold: state.tickets.filter((ticket) => ticket.event_id === event.id).length,
      grossRevenue: confirmedOrders.reduce((total, order) => total + order.total_amount, 0),
    },
  };
}

function toAdminOrderListItem(order) {
  const buyer = state.users.find((candidate) => candidate.id === order.user_id);
  const payment = state.payments.find((candidate) => candidate.order_id === order.id);
  const event = state.events.find((candidate) => candidate.id === order.event_id);

  return {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    totalAmount: order.total_amount,
    serviceFee: order.service_fee,
    createdAt: order.created_at,
    confirmedAt: order.confirmed_at,
    expiresAt: order.expires_at,
    paymentStatus: payment?.status ?? 'pending',
    paymentMethod: payment?.method ?? 'bank_transfer',
    buyer: {
      id: buyer?.id ?? '',
      fullName: buyer?.full_name ?? 'Buyer',
      email: buyer?.email ?? '',
      phone: buyer?.phone ?? null,
    },
    event: {
      id: event?.id ?? '',
      title: event?.title ?? order.event_title,
      slug: event?.slug ?? order.event_slug,
      venueCity: event?.venue_city ?? '',
      startAt: event?.start_at ?? order.created_at,
    },
  };
}

function toAdminOrderDetail(order) {
  const buyer = state.users.find((candidate) => candidate.id === order.user_id);
  const payment = state.payments.find((candidate) => candidate.order_id === order.id);
  const event = state.events.find((candidate) => candidate.id === order.event_id);
  const tickets = state.tickets.filter((candidate) => candidate.order_id === order.id);

  return {
    id: order.id,
    reservationId: order.reservation_id,
    orderNumber: order.order_number,
    status: order.status,
    totalAmount: order.total_amount,
    serviceFee: order.service_fee,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    confirmedAt: order.confirmed_at,
    expiresAt: order.expires_at,
    buyer: {
      id: buyer?.id ?? '',
      fullName: buyer?.full_name ?? 'Buyer',
      email: buyer?.email ?? '',
      phone: buyer?.phone ?? null,
    },
    event: {
      id: event?.id ?? '',
      title: event?.title ?? order.event_title,
      slug: event?.slug ?? order.event_slug,
      venueCity: event?.venue_city ?? '',
      startAt: event?.start_at ?? order.created_at,
    },
    payment: {
      id: payment?.id ?? '',
      method: payment?.method ?? 'bank_transfer',
      status: payment?.status ?? 'pending',
      amount: payment?.amount ?? order.total_amount,
      externalRef: payment?.external_ref ?? null,
      paidAt: payment?.paid_at ?? null,
      createdAt: payment?.created_at ?? order.created_at,
      updatedAt: payment?.updated_at ?? order.updated_at,
    },
    items: order.items.map((item) => ({
      id: item.id,
      ticketTierId: item.ticket_tier_id,
      tierName: item.tier_name,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      subtotal: item.subtotal,
    })),
    tickets: tickets.map((ticket) => ({
      id: ticket.id,
      ticketTierId: ticket.ticket_tier_id,
      ticketTierName: ticket.tier_name,
      ticketCode: ticket.ticket_code,
      status: ticket.status,
      issuedAt: ticket.issued_at,
      checkedInAt: ticket.checked_in_at,
    })),
  };
}

function toAdminPaymentListItem(payment) {
  const order = state.orders.find((candidate) => candidate.id === payment.order_id);
  const buyer = state.users.find((candidate) => candidate.id === order?.user_id);
  const event = state.events.find((candidate) => candidate.id === order?.event_id);

  return {
    id: payment.id,
    orderId: order?.id ?? '',
    orderNumber: order?.order_number ?? '',
    status: payment.status,
    method: payment.method,
    amount: payment.amount,
    externalRef: payment.external_ref,
    paidAt: payment.paid_at,
    createdAt: payment.created_at,
    updatedAt: payment.updated_at,
    orderStatus: order?.status ?? 'pending',
    buyer: {
      id: buyer?.id ?? '',
      fullName: buyer?.full_name ?? 'Buyer',
      email: buyer?.email ?? '',
      phone: buyer?.phone ?? null,
    },
    event: {
      id: event?.id ?? '',
      title: event?.title ?? order?.event_title ?? '',
      slug: event?.slug ?? order?.event_slug ?? '',
      venueCity: event?.venue_city ?? '',
      startAt: event?.start_at ?? payment.created_at,
    },
  };
}

function toAdminPaymentDetail(payment) {
  const order = state.orders.find((candidate) => candidate.id === payment.order_id);
  const buyer = state.users.find((candidate) => candidate.id === order?.user_id);
  const event = state.events.find((candidate) => candidate.id === order?.event_id);
  const tickets = state.tickets.filter((candidate) => candidate.order_id === order?.id);

  return {
    id: payment.id,
    orderId: order?.id ?? '',
    orderNumber: order?.order_number ?? '',
    status: payment.status,
    method: payment.method,
    amount: payment.amount,
    externalRef: payment.external_ref,
    paidAt: payment.paid_at,
    createdAt: payment.created_at,
    updatedAt: payment.updated_at,
    orderStatus: order?.status ?? 'pending',
    buyer: {
      id: buyer?.id ?? '',
      fullName: buyer?.full_name ?? 'Buyer',
      email: buyer?.email ?? '',
      phone: buyer?.phone ?? null,
    },
    event: {
      id: event?.id ?? '',
      title: event?.title ?? order?.event_title ?? '',
      slug: event?.slug ?? order?.event_slug ?? '',
      venueCity: event?.venue_city ?? '',
      startAt: event?.start_at ?? payment.created_at,
    },
    items: (order?.items ?? []).map((item) => ({
      id: item.id,
      ticketTierId: item.ticket_tier_id,
      tierName: item.tier_name,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      subtotal: item.subtotal,
    })),
    tickets: tickets.map((ticket) => ({
      id: ticket.id,
      ticketTierId: ticket.ticket_tier_id,
      ticketTierName: ticket.tier_name,
      ticketCode: ticket.ticket_code,
      status: ticket.status,
      issuedAt: ticket.issued_at,
      checkedInAt: ticket.checked_in_at,
    })),
  };
}

function toAdminReservationItem(reservation) {
  const buyer = state.users.find((candidate) => candidate.id === reservation.user_id);
  const event = state.events.find((candidate) => candidate.id === reservation.event_id);
  const tier = event?.tiers.find((candidate) => candidate.id === reservation.ticket_tier_id);

  return {
    id: reservation.id,
    status: reservation.status,
    quantity: reservation.quantity,
    expiresAt: reservation.expires_at,
    createdAt: reservation.created_at,
    remainingSeconds: Math.max(
      Math.floor((new Date(reservation.expires_at).getTime() - Date.now()) / 1000),
      0,
    ),
    buyer: {
      id: buyer?.id ?? '',
      fullName: buyer?.full_name ?? 'Buyer',
      email: buyer?.email ?? '',
      phone: buyer?.phone ?? null,
    },
    event: {
      id: event?.id ?? '',
      title: event?.title ?? reservation.event_title,
      slug: event?.slug ?? reservation.event_slug,
      venueCity: event?.venue_city ?? '',
      startAt: event?.start_at ?? reservation.created_at,
    },
    ticketTier: {
      id: tier?.id ?? reservation.ticket_tier_id,
      name: tier?.name ?? reservation.tier_name,
      status: tier?.status ?? 'available',
    },
  };
}

function toSellerOrderDetail(order) {
  const buyer = state.users.find((candidate) => candidate.id === order.user_id);
  const event = state.events.find((candidate) => candidate.id === order.event_id);
  const payment = state.payments.find((candidate) => candidate.order_id === order.id);

  return {
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    total_amount: order.total_amount,
    service_fee: order.service_fee,
    expires_at: order.expires_at,
    confirmed_at: order.confirmed_at,
    created_at: order.created_at,
    updated_at: order.updated_at,
    buyer: {
      id: buyer?.id ?? '',
      full_name: buyer?.full_name ?? 'Buyer',
      email: buyer?.email ?? '',
      phone: buyer?.phone ?? null,
    },
    event: {
      id: event?.id ?? '',
      title: event?.title ?? order.event_title,
      slug: event?.slug ?? order.event_slug,
      start_at: event?.start_at ?? order.created_at,
      venue_city: event?.venue_city ?? '',
    },
    items: order.items,
    payment: {
      id: payment?.id ?? '',
      method: payment?.method ?? 'bank_transfer',
      status: payment?.status ?? 'pending',
      amount: payment?.amount ?? order.total_amount,
      external_ref: payment?.external_ref ?? null,
      paid_at: payment?.paid_at ?? null,
      created_at: payment?.created_at ?? order.created_at,
      updated_at: payment?.updated_at ?? order.updated_at,
    },
  };
}

function ensureAuthorized(res, user, role) {
  if (user === 'forbidden') {
    sendError(res, 403, 'FORBIDDEN', 'Forbidden.');
    return false;
  }

  if (!user) {
    sendError(res, 401, 'UNAUTHORIZED', 'Unauthorized.');
    return false;
  }

  if (role && user.role !== role) {
    sendError(res, 403, 'FORBIDDEN', 'Forbidden.');
    return false;
  }

  return true;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const path = url.pathname;

  if (req.method === 'OPTIONS') {
    applyCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && path === '/doc') {
    sendSuccess(res, { status: 'ok' });
    return;
  }

  if (req.method === 'GET' && path.startsWith('/mock-payment/')) {
    applyCors(res);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Mock Payment</title>
  </head>
  <body style="font-family: sans-serif; padding: 32px; background: #f8fafc; color: #0f172a;">
    <main style="max-width: 720px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px; box-shadow: 0 12px 40px rgba(15, 23, 42, 0.08);">
      <p style="font-size: 12px; letter-spacing: 0.3em; text-transform: uppercase; color: #64748b;">Mock Gateway</p>
      <h1 style="margin-top: 12px; font-size: 32px;">Payment Redirect</h1>
      <p style="margin-top: 16px; line-height: 1.6;">This page simulates the external payment gateway redirect used during Playwright E2E tests.</p>
      <p style="margin-top: 16px; font-family: monospace;">Reference: ${path.split('/').pop()}</p>
    </main>
  </body>
</html>`);
    return;
  }

  if (req.method === 'POST' && path === '/auth/register') {
    const body = await readBody(req);

    if (state.users.some((user) => user.email === body.email)) {
      sendError(res, 409, 'EMAIL_ALREADY_EXISTS', 'Email is already registered.');
      return;
    }

    const now = new Date().toISOString();
    const user = {
      id: randomUUID(),
      email: body.email,
      password: body.password,
      full_name: body.full_name,
      phone: body.phone ?? null,
      avatar_url: null,
      role: 'buyer',
      status: 'active',
      email_verified_at: now,
      created_at: now,
      updated_at: now,
    };

    state.users.push(user);
    sendSuccess(res, createAuthPayload(user), undefined, 201);
    return;
  }

  if (req.method === 'POST' && path === '/auth/register/seller') {
    const body = await readBody(req);

    if (state.users.some((user) => user.email === body.email)) {
      sendError(res, 409, 'EMAIL_ALREADY_EXISTS', 'Email is already registered.');
      return;
    }

    const now = new Date().toISOString();
    const user = {
      id: randomUUID(),
      email: body.email,
      password: body.password,
      full_name: body.full_name,
      phone: body.phone ?? null,
      avatar_url: null,
      role: 'seller',
      status: 'active',
      email_verified_at: now,
      created_at: now,
      updated_at: now,
    };

    state.users.push(user);
    state.sellerProfiles.push({
      id: randomUUID(),
      user_id: user.id,
      org_name: body.org_name,
      org_description: body.org_description ?? null,
      logo_url: null,
      bank_name: null,
      bank_account_number: null,
      bank_account_holder: null,
      is_verified: false,
      verified_at: null,
      verified_by: null,
      created_at: now,
      updated_at: now,
    });

    sendSuccess(res, createAuthPayload(user), undefined, 201);
    return;
  }

  if (req.method === 'POST' && path === '/auth/login') {
    const body = await readBody(req);
    const user = state.users.find(
      (candidate) => candidate.email === body.email && candidate.password === body.password,
    );

    if (!user) {
      sendError(res, 401, 'INVALID_CREDENTIALS', 'Invalid credentials.');
      return;
    }

    sendSuccess(res, createAuthPayload(user));
    return;
  }

  if (req.method === 'POST' && path === '/auth/refresh') {
    const body = await readBody(req);
    const payload = parseToken(body.refresh_token ?? '');
    const user = state.users.find((candidate) => candidate.id === payload?.sub);

    if (!user) {
      sendError(res, 401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token.');
      return;
    }

    sendSuccess(res, createAuthPayload(user));
    return;
  }

  if (req.method === 'POST' && path === '/auth/logout') {
    sendSuccess(res, { message: 'Logged out successfully.' });
    return;
  }

  if (req.method === 'POST' && path === '/auth/forgot-password') {
    sendSuccess(res, { message: 'Reset password email queued.', reset_token: 'mock-reset-token' });
    return;
  }

  if (req.method === 'POST' && path === '/auth/reset-password') {
    sendSuccess(res, { message: 'Password berhasil direset.' });
    return;
  }

  if (req.method === 'POST' && path === '/auth/verify-email') {
    sendSuccess(res, { message: 'Email berhasil diverifikasi.' });
    return;
  }

  if (req.method === 'GET' && path === '/events/featured') {
    sendSuccess(
      res,
      state.events
        .filter((event) => event.is_featured && ['published', 'ongoing'].includes(event.status))
        .map(toPublicEventListItem),
    );
    return;
  }

  if (req.method === 'GET' && path === '/categories') {
    sendSuccess(
      res,
      state.categories.map((category) => ({
        ...category,
        event_count: state.events.filter(
          (event) => ['published', 'ongoing'].includes(event.status) && event.category_ids.includes(category.id),
        ).length,
      })),
    );
    return;
  }

  if (req.method === 'GET' && path === '/events') {
    const categorySlug = url.searchParams.get('category');
    const search = url.searchParams.get('search')?.toLowerCase() ?? '';
    const page = Number(url.searchParams.get('page') ?? '1');
    const limit = Number(url.searchParams.get('limit') ?? '12');
    let events = state.events.filter((event) => ['published', 'ongoing'].includes(event.status));

    if (categorySlug) {
      const category = state.categories.find((candidate) => candidate.slug === categorySlug);
      events = category ? events.filter((event) => event.category_ids.includes(category.id)) : [];
    }

    if (search) {
      events = events.filter((event) => event.title.toLowerCase().includes(search));
    }

    const offset = (page - 1) * limit;
    sendSuccess(
      res,
      events.slice(offset, offset + limit).map(toPublicEventListItem),
      buildMeta(events.length, page, limit),
    );
    return;
  }

  if (req.method === 'GET' && path.startsWith('/categories/') && path.endsWith('/events')) {
    const slug = path.split('/')[2];
    const category = state.categories.find((candidate) => candidate.slug === slug);
    const page = Number(url.searchParams.get('page') ?? '1');
    const limit = Number(url.searchParams.get('limit') ?? '100');
    const events = category
      ? state.events.filter(
          (event) => ['published', 'ongoing'].includes(event.status) && event.category_ids.includes(category.id),
        )
      : [];
    const offset = (page - 1) * limit;
    sendSuccess(
      res,
      events.slice(offset, offset + limit).map(toPublicEventListItem),
      buildMeta(events.length, page, limit),
    );
    return;
  }

  if (req.method === 'GET' && path.startsWith('/events/')) {
    const slug = path.split('/')[2];
    const event = state.events.find(
      (candidate) => candidate.slug === slug && ['published', 'ongoing'].includes(candidate.status),
    );

    if (!event) {
      sendError(res, 404, 'EVENT_NOT_FOUND', 'Event not found.');
      return;
    }

    sendSuccess(res, toPublicEventDetail(event));
    return;
  }

  if (req.method === 'GET' && path === '/admin/dashboard') {
    const user = getAuthorizedUser(req, 'admin');

    if (!ensureAuthorized(res, user, 'admin')) {
      return;
    }

    sendSuccess(res, {
      total_users: state.users.length,
      total_sellers: state.users.filter((candidate) => candidate.role === 'seller').length,
      total_buyers: state.users.filter((candidate) => candidate.role === 'buyer').length,
      total_events: state.events.length,
      total_events_published: state.events.filter((event) => event.status === 'published').length,
      total_revenue: state.orders
        .filter((order) => order.status === 'confirmed')
        .reduce((sum, order) => sum + order.total_amount, 0),
      total_tickets_sold: state.tickets.length,
      daily_transactions: [{ date: new Date().toISOString(), transaction_count: state.orders.length }],
      recent_events: state.events.slice(-5).map((event) => {
        const sellerProfile = state.sellerProfiles.find((profile) => profile.id === event.seller_profile_id);
        return {
          id: event.id,
          name: event.title,
          seller: sellerProfile?.org_name ?? 'Seller',
          status: event.status,
          created_at: event.created_at,
        };
      }),
      recent_orders: state.orders.slice(-5).map((order) => ({
        id: order.id,
        order_number: order.order_number,
        buyer: state.users.find((candidate) => candidate.id === order.user_id)?.full_name ?? 'Buyer',
        total_amount: order.total_amount,
        status: order.status,
        created_at: order.created_at,
      })),
    });
    return;
  }

  if (req.method === 'GET' && path === '/admin/categories') {
    const user = getAuthorizedUser(req, 'admin');

    if (!ensureAuthorized(res, user, 'admin')) {
      return;
    }

    sendSuccess(
      res,
      state.categories.map((category) => ({
        ...category,
        eventCount: state.events.filter((event) => event.category_ids.includes(category.id)).length,
      })),
    );
    return;
  }

  if (req.method === 'GET' && path === '/admin/events') {
    const user = getAuthorizedUser(req, 'admin');

    if (!ensureAuthorized(res, user, 'admin')) {
      return;
    }

    const events = state.events.map(toAdminEventListItem);
    sendSuccess(res, events, buildMeta(events.length, 1, 20));
    return;
  }

  if (req.method === 'GET' && path.startsWith('/admin/events/') && !path.endsWith('/status')) {
    const user = getAuthorizedUser(req, 'admin');

    if (!ensureAuthorized(res, user, 'admin')) {
      return;
    }

    const eventId = path.split('/')[3];
    const event = state.events.find((candidate) => candidate.id === eventId);

    if (!event) {
      sendError(res, 404, 'EVENT_NOT_FOUND', 'Event not found.');
      return;
    }

    sendSuccess(res, toAdminEventDetail(event));
    return;
  }

  if (req.method === 'GET' && path === '/admin/orders') {
    const user = getAuthorizedUser(req, 'admin');

    if (!ensureAuthorized(res, user, 'admin')) {
      return;
    }

    const orders = state.orders.map(toAdminOrderListItem);
    sendSuccess(res, orders, buildMeta(orders.length, 1, 20));
    return;
  }

  if (req.method === 'GET' && path.startsWith('/admin/orders/')) {
    const user = getAuthorizedUser(req, 'admin');

    if (!ensureAuthorized(res, user, 'admin')) {
      return;
    }

    const orderId = path.split('/')[3];
    const order = state.orders.find((candidate) => candidate.id === orderId);

    if (!order) {
      sendError(res, 404, 'ORDER_NOT_FOUND', 'Order not found.');
      return;
    }

    sendSuccess(res, toAdminOrderDetail(order));
    return;
  }

  if (req.method === 'GET' && path === '/admin/payments') {
    const user = getAuthorizedUser(req, 'admin');

    if (!ensureAuthorized(res, user, 'admin')) {
      return;
    }

    const payments = state.payments.map(toAdminPaymentListItem);
    sendSuccess(res, payments, buildMeta(payments.length, 1, 20));
    return;
  }

  if (req.method === 'GET' && path.startsWith('/admin/payments/')) {
    const user = getAuthorizedUser(req, 'admin');

    if (!ensureAuthorized(res, user, 'admin')) {
      return;
    }

    const paymentId = path.split('/')[3];
    const payment = state.payments.find((candidate) => candidate.id === paymentId);

    if (!payment) {
      sendError(res, 404, 'PAYMENT_NOT_FOUND', 'Payment not found.');
      return;
    }

    sendSuccess(res, toAdminPaymentDetail(payment));
    return;
  }

  if (req.method === 'GET' && path === '/admin/reservations') {
    const user = getAuthorizedUser(req, 'admin');

    if (!ensureAuthorized(res, user, 'admin')) {
      return;
    }

    const reservations = state.reservations.map(toAdminReservationItem);
    sendSuccess(res, reservations, buildMeta(reservations.length, 1, 20));
    return;
  }

  if (req.method === 'GET' && path === '/admin/notifications') {
    const user = getAuthorizedUser(req, 'admin');

    if (!ensureAuthorized(res, user, 'admin')) {
      return;
    }

    const notifications = state.notifications.map((notification) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      isRead: notification.is_read,
      createdAt: notification.created_at,
      metadata: notification.metadata ?? null,
      user: {
        id: notification.user.id,
        fullName: notification.user.full_name,
        email: notification.user.email,
        role: notification.user.role,
      },
    }));

    sendSuccess(res, { notifications }, buildMeta(notifications.length, 1, 20));
    return;
  }

  if (req.method === 'POST' && path === '/admin/notifications/broadcast') {
    const user = getAuthorizedUser(req, 'admin');

    if (!ensureAuthorized(res, user, 'admin')) {
      return;
    }

    const body = await readBody(req);
    const targetRole = body.target_role ?? 'all';
    const targetUsers = state.users.filter((candidate) =>
      targetRole === 'all' ? true : candidate.role === targetRole,
    );
    const now = new Date().toISOString();

    for (const targetUser of targetUsers) {
      state.notifications.push({
        id: randomUUID(),
        type: 'info',
        title: body.title,
        body: body.body,
        is_read: false,
        created_at: now,
        metadata: null,
        user: targetUser,
      });
    }

    sendSuccess(res, {
      message: 'Broadcast terkirim.',
      sent_count: targetUsers.length,
      target_role: targetRole,
    });
    return;
  }

  if (req.method === 'POST' && path === '/admin/categories') {
    const user = getAuthorizedUser(req, 'admin');

    if (!ensureAuthorized(res, user, 'admin')) {
      return;
    }

    const body = await readBody(req);
    const category = {
      id: state.categories.length + 1,
      name: body.name,
      slug: slugify(body.name),
      icon: body.icon ?? null,
    };

    state.categories.push(category);
    sendSuccess(res, { ...category, eventCount: 0 }, undefined, 201);
    return;
  }

  if (req.method === 'GET' && path === '/admin/sellers') {
    const user = getAuthorizedUser(req, 'admin');

    if (!ensureAuthorized(res, user, 'admin')) {
      return;
    }

    const sellers = state.sellerProfiles.map((profile) => {
      const sellerUser = state.users.find((candidate) => candidate.id === profile.user_id);
      return {
        id: profile.id,
        userId: profile.user_id,
        email: sellerUser?.email ?? '',
        fullName: sellerUser?.full_name ?? '',
        phone: sellerUser?.phone ?? null,
        avatarUrl: sellerUser?.avatar_url ?? null,
        orgName: profile.org_name,
        isVerified: profile.is_verified,
        verifiedAt: profile.verified_at,
        verifiedBy: profile.verified_by,
        eventCount: state.events.filter((event) => event.seller_profile_id === profile.id).length,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      };
    });

    sendSuccess(res, sellers, buildMeta(sellers.length, 1, 20));
    return;
  }

  if (req.method === 'GET' && path === '/admin/users') {
    const user = getAuthorizedUser(req, 'admin');

    if (!ensureAuthorized(res, user, 'admin')) {
      return;
    }

    const users = state.users.map((candidate) => ({
      id: candidate.id,
      email: candidate.email,
      fullName: candidate.full_name,
      phone: candidate.phone,
      avatarUrl: candidate.avatar_url,
      role: candidate.role,
      status: candidate.status,
      emailVerifiedAt: candidate.email_verified_at,
      orderCount: state.orders.filter((order) => order.user_id === candidate.id).length,
      ticketCount: state.tickets.filter((ticket) => ticket.user_id === candidate.id).length,
      sellerProfile: (() => {
        const sellerProfile = getSellerProfileByUserId(candidate.id);

        if (!sellerProfile) {
          return null;
        }

        return {
          id: sellerProfile.id,
          orgName: sellerProfile.org_name,
          isVerified: sellerProfile.is_verified,
          eventCount: state.events.filter((event) => event.seller_profile_id === sellerProfile.id).length,
        };
      })(),
      createdAt: candidate.created_at,
      updatedAt: candidate.updated_at,
    }));

    sendSuccess(res, users, buildMeta(users.length, 1, 20));
    return;
  }

  if (req.method === 'GET' && path.startsWith('/admin/users/')) {
    const user = getAuthorizedUser(req, 'admin');

    if (!ensureAuthorized(res, user, 'admin')) {
      return;
    }

    const userId = path.split('/')[3];
    const targetUser = state.users.find((candidate) => candidate.id === userId);

    if (!targetUser) {
      sendError(res, 404, 'USER_NOT_FOUND', 'User not found.');
      return;
    }

    const sellerProfile = getSellerProfileByUserId(targetUser.id);
    sendSuccess(res, {
      id: targetUser.id,
      email: targetUser.email,
      fullName: targetUser.full_name,
      phone: targetUser.phone,
      avatarUrl: targetUser.avatar_url,
      role: targetUser.role,
      status: targetUser.status,
      emailVerifiedAt: targetUser.email_verified_at,
      orderCount: state.orders.filter((order) => order.user_id === targetUser.id).length,
      ticketCount: state.tickets.filter((ticket) => ticket.user_id === targetUser.id).length,
      sellerProfile: sellerProfile
        ? {
            id: sellerProfile.id,
            orgName: sellerProfile.org_name,
            orgDescription: sellerProfile.org_description,
            logoUrl: sellerProfile.logo_url,
            bankName: sellerProfile.bank_name,
            bankAccountNumber: sellerProfile.bank_account_number,
            bankAccountHolder: sellerProfile.bank_account_holder,
            isVerified: sellerProfile.is_verified,
            verifiedAt: sellerProfile.verified_at,
            verifiedBy: sellerProfile.verified_by,
            eventCount: state.events.filter((event) => event.seller_profile_id === sellerProfile.id).length,
            events: state.events
              .filter((event) => event.seller_profile_id === sellerProfile.id)
              .map((event) => ({
                id: event.id,
                title: event.title,
                slug: event.slug,
                status: event.status,
                venueCity: event.venue_city,
                startAt: event.start_at,
              })),
            createdAt: sellerProfile.created_at,
            updatedAt: sellerProfile.updated_at,
          }
        : null,
      createdAt: targetUser.created_at,
      updatedAt: targetUser.updated_at,
    });
    return;
  }

  if (req.method === 'PATCH' && path.startsWith('/admin/sellers/') && path.endsWith('/verify')) {
    const user = getAuthorizedUser(req, 'admin');

    if (!ensureAuthorized(res, user, 'admin')) {
      return;
    }

    const sellerProfileId = path.split('/')[3];
    const body = await readBody(req);
    const sellerProfile = state.sellerProfiles.find((profile) => profile.id === sellerProfileId);

    if (!sellerProfile) {
      sendError(res, 404, 'SELLER_NOT_FOUND', 'Seller not found.');
      return;
    }

    sellerProfile.is_verified = Boolean(body.is_verified);
    sellerProfile.verified_at = sellerProfile.is_verified ? new Date().toISOString() : null;
    sellerProfile.verified_by = sellerProfile.is_verified ? user.id : null;
    sellerProfile.updated_at = new Date().toISOString();

    const sellerUser = state.users.find((candidate) => candidate.id === sellerProfile.user_id);
    sendSuccess(res, {
      id: sellerProfile.id,
      userId: sellerProfile.user_id,
      email: sellerUser?.email ?? '',
      fullName: sellerUser?.full_name ?? '',
      phone: sellerUser?.phone ?? null,
      avatarUrl: sellerUser?.avatar_url ?? null,
      orgName: sellerProfile.org_name,
      isVerified: sellerProfile.is_verified,
      verifiedAt: sellerProfile.verified_at,
      verifiedBy: sellerProfile.verified_by,
      eventCount: state.events.filter((event) => event.seller_profile_id === sellerProfile.id).length,
      createdAt: sellerProfile.created_at,
      updatedAt: sellerProfile.updated_at,
    });
    return;
  }

  if (req.method === 'PATCH' && path.startsWith('/admin/events/') && path.endsWith('/status')) {
    const user = getAuthorizedUser(req, 'admin');

    if (!ensureAuthorized(res, user, 'admin')) {
      return;
    }

    const eventId = path.split('/')[3];
    const body = await readBody(req);
    const event = state.events.find((candidate) => candidate.id === eventId);

    if (!event) {
      sendError(res, 404, 'EVENT_NOT_FOUND', 'Event not found.');
      return;
    }

    event.status = body.status;
    event.updated_at = new Date().toISOString();
    sendSuccess(res, {
      id: event.id,
      status: event.status,
      updatedAt: event.updated_at,
    });
    return;
  }

  if (req.method === 'GET' && path === '/seller/dashboard') {
    const user = getAuthorizedUser(req, 'seller');

    if (!ensureAuthorized(res, user, 'seller')) {
      return;
    }

    const sellerProfile = getSellerProfileByUserId(user.id);
    const sellerEvents = state.events.filter((event) => event.seller_profile_id === sellerProfile?.id);
    const sellerOrders = state.orders.filter((order) => order.seller_user_id === user.id);
    sendSuccess(res, {
      total_events: sellerEvents.length,
      total_revenue: sellerOrders
        .filter((order) => order.status === 'confirmed')
        .reduce((sum, order) => sum + order.total_amount, 0),
      total_tickets_sold: sellerEvents.reduce(
        (sum, event) => sum + event.tiers.reduce((tierSum, tier) => tierSum + tier.sold_count, 0),
        0,
      ),
      upcoming_events: sellerEvents.filter((event) => new Date(event.start_at).getTime() > Date.now()).length,
      recent_orders: sellerOrders.slice(-5).map((order) => ({
        id: order.id,
        order_number: order.order_number,
        event_title: order.event_title,
        buyer_name: state.users.find((candidate) => candidate.id === order.user_id)?.full_name ?? 'Buyer',
        total_amount: order.total_amount,
        status: order.status,
        created_at: order.created_at,
      })),
      daily_sales: [{ date: new Date().toISOString(), tickets_sold: sellerOrders.length }],
    });
    return;
  }

  if (req.method === 'GET' && path === '/seller/profile') {
    const user = getAuthorizedUser(req, 'seller');

    if (!ensureAuthorized(res, user, 'seller')) {
      return;
    }

    const sellerProfile = getSellerProfileByUserId(user.id);

    sendSuccess(res, {
      id: sellerProfile?.id ?? '',
      user_id: user.id,
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      avatar_url: user.avatar_url,
      org_name: sellerProfile?.org_name ?? '',
      org_description: sellerProfile?.org_description ?? null,
      logo_url: sellerProfile?.logo_url ?? null,
      bank_name: sellerProfile?.bank_name ?? null,
      bank_account_number: sellerProfile?.bank_account_number ?? null,
      bank_account_holder: sellerProfile?.bank_account_holder ?? null,
      is_verified: sellerProfile?.is_verified ?? false,
      verified_at: sellerProfile?.verified_at ?? null,
      created_at: sellerProfile?.created_at ?? user.created_at,
      updated_at: sellerProfile?.updated_at ?? user.updated_at,
    });
    return;
  }

  if (req.method === 'PATCH' && path === '/seller/profile') {
    const user = getAuthorizedUser(req, 'seller');

    if (!ensureAuthorized(res, user, 'seller')) {
      return;
    }

    const sellerProfile = getSellerProfileByUserId(user.id);
    const body = await readBody(req);

    sellerProfile.org_name = body.org_name ?? sellerProfile.org_name;
    sellerProfile.org_description = body.org_description ?? sellerProfile.org_description;
    sellerProfile.logo_url = body.logo_url ?? sellerProfile.logo_url;
    sellerProfile.bank_name = body.bank_name ?? sellerProfile.bank_name;
    sellerProfile.bank_account_number = body.bank_account_number ?? sellerProfile.bank_account_number;
    sellerProfile.bank_account_holder = body.bank_account_holder ?? sellerProfile.bank_account_holder;
    sellerProfile.updated_at = new Date().toISOString();

    sendSuccess(res, {
      id: sellerProfile.id,
      user_id: user.id,
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      avatar_url: user.avatar_url,
      org_name: sellerProfile.org_name,
      org_description: sellerProfile.org_description,
      logo_url: sellerProfile.logo_url,
      bank_name: sellerProfile.bank_name,
      bank_account_number: sellerProfile.bank_account_number,
      bank_account_holder: sellerProfile.bank_account_holder,
      is_verified: sellerProfile.is_verified,
      verified_at: sellerProfile.verified_at,
      created_at: sellerProfile.created_at,
      updated_at: sellerProfile.updated_at,
    });
    return;
  }

  if (req.method === 'GET' && path === '/seller/events') {
    const user = getAuthorizedUser(req, 'seller');

    if (!ensureAuthorized(res, user, 'seller')) {
      return;
    }

    const sellerProfile = getSellerProfileByUserId(user.id);
    const events = state.events
      .filter((event) => event.seller_profile_id === sellerProfile?.id)
      .map((event) => ({
        id: event.id,
        title: event.title,
        slug: event.slug,
        venue_city: event.venue_city,
        start_at: event.start_at,
        end_at: event.end_at,
        sale_start_at: event.sale_start_at,
        sale_end_at: event.sale_end_at,
        banner_url: event.banner_url,
        status: event.status,
        max_tickets_per_order: event.max_tickets_per_order,
        total_quota: event.tiers.reduce((sum, tier) => sum + tier.quota, 0),
        total_sold: event.tiers.reduce((sum, tier) => sum + tier.sold_count, 0),
        created_at: event.created_at,
        updated_at: event.updated_at,
      }));

    sendSuccess(res, events, buildMeta(events.length, 1, 100));
    return;
  }

  if (req.method === 'POST' && path === '/seller/events') {
    const user = getAuthorizedUser(req, 'seller');

    if (!ensureAuthorized(res, user, 'seller')) {
      return;
    }

    const sellerProfile = getSellerProfileByUserId(user.id);
    const body = await readBody(req);
    const now = new Date().toISOString();
    const event = {
      id: randomUUID(),
      seller_profile_id: sellerProfile.id,
      title: body.title,
      slug: `${slugify(body.title)}-${Math.random().toString(16).slice(2, 6)}`,
      description: body.description ?? null,
      venue_name: body.venue_name,
      venue_address: body.venue_address ?? null,
      venue_city: body.venue_city,
      venue_latitude: body.venue_latitude ?? null,
      venue_longitude: body.venue_longitude ?? null,
      start_at: body.start_at,
      end_at: body.end_at,
      sale_start_at: body.sale_start_at,
      sale_end_at: body.sale_end_at,
      banner_url: body.banner_url ?? null,
      status: 'draft',
      is_featured: false,
      max_tickets_per_order: body.max_tickets_per_order ?? 5,
      category_ids: body.category_ids ?? [],
      images: (body.images ?? []).map((image) => ({
        id: randomUUID(),
        image_url: image.image_url,
        sort_order: image.sort_order,
        created_at: now,
      })),
      tiers: (body.tiers ?? []).map((tier, index) => ({
        id: randomUUID(),
        name: tier.name,
        description: tier.description ?? null,
        price: Number(tier.price),
        quota: Number(tier.quota),
        sold_count: 0,
        sort_order: tier.sort_order ?? index,
        status: 'available',
        sale_start_at: tier.sale_start_at ?? null,
        sale_end_at: tier.sale_end_at ?? null,
        created_at: now,
        updated_at: now,
      })),
      created_at: now,
      updated_at: now,
    };

    state.events.push(event);
    sendSuccess(res, toSellerEventDetail(event), undefined, 201);
    return;
  }

  if (req.method === 'GET' && path.startsWith('/seller/events/') && !path.endsWith('/checkin/stats') && !path.endsWith('/checkin')) {
    const user = getAuthorizedUser(req, 'seller');

    if (!ensureAuthorized(res, user, 'seller')) {
      return;
    }

    const eventId = path.split('/')[3];
    const sellerProfile = getSellerProfileByUserId(user.id);
    const event = state.events.find(
      (candidate) => candidate.id === eventId && candidate.seller_profile_id === sellerProfile?.id,
    );

    if (!event) {
      sendError(res, 404, 'EVENT_NOT_FOUND', 'Event not found.');
      return;
    }

    sendSuccess(res, toSellerEventDetail(event));
    return;
  }

  if (req.method === 'GET' && path === '/seller/orders') {
    const user = getAuthorizedUser(req, 'seller');

    if (!ensureAuthorized(res, user, 'seller')) {
      return;
    }

    const orders = state.orders
      .filter((order) => order.seller_user_id === user.id)
      .map((order) => ({
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        total_amount: order.total_amount,
        buyer_id: order.user_id,
        buyer_name: state.users.find((candidate) => candidate.id === order.user_id)?.full_name ?? 'Buyer',
        buyer_email: state.users.find((candidate) => candidate.id === order.user_id)?.email ?? '',
        event_id: order.event_id,
        event_title: order.event_title,
        event_slug: order.event_slug,
        payment_status: state.payments.find((payment) => payment.order_id === order.id)?.status ?? 'pending',
        created_at: order.created_at,
        confirmed_at: order.confirmed_at,
      }));

    sendSuccess(res, orders, buildMeta(orders.length, 1, 10));
    return;
  }

  if (req.method === 'GET' && path.startsWith('/seller/orders/')) {
    const user = getAuthorizedUser(req, 'seller');

    if (!ensureAuthorized(res, user, 'seller')) {
      return;
    }

    const orderId = path.split('/')[3];
    const order = state.orders.find((candidate) => candidate.id === orderId && candidate.seller_user_id === user.id);

    if (!order) {
      sendError(res, 404, 'ORDER_NOT_FOUND', 'Order not found.');
      return;
    }

    sendSuccess(res, toSellerOrderDetail(order));
    return;
  }

  if (req.method === 'GET' && path.endsWith('/checkin/stats')) {
    const user = getAuthorizedUser(req, 'seller');

    if (!ensureAuthorized(res, user, 'seller')) {
      return;
    }

    const eventId = path.split('/')[3];
    const sellerProfile = getSellerProfileByUserId(user.id);
    const event = state.events.find(
      (candidate) => candidate.id === eventId && candidate.seller_profile_id === sellerProfile?.id,
    );

    if (!event) {
      sendError(res, 404, 'EVENT_NOT_FOUND', 'Event not found.');
      return;
    }

    const eventTickets = state.tickets.filter((ticket) => ticket.event_id === event.id);
    const checkedIn = eventTickets.filter((ticket) => ticket.status === 'used').length;

    sendSuccess(res, {
      event_id: event.id,
      event_title: event.title,
      total_tickets: eventTickets.length,
      checked_in: checkedIn,
      remaining: eventTickets.length - checkedIn,
      percentage: eventTickets.length === 0 ? 0 : (checkedIn / eventTickets.length) * 100,
      recent_checkins: state.checkins.filter((checkin) => checkin.event_id === event.id).slice(-10).reverse(),
    });
    return;
  }

  if (req.method === 'POST' && path.endsWith('/checkin')) {
    const user = getAuthorizedUser(req, 'seller');

    if (!ensureAuthorized(res, user, 'seller')) {
      return;
    }

    const eventId = path.split('/')[3];
    const body = await readBody(req);
    const sellerProfile = getSellerProfileByUserId(user.id);
    const event = state.events.find(
      (candidate) => candidate.id === eventId && candidate.seller_profile_id === sellerProfile?.id,
    );

    if (!event) {
      sendError(res, 404, 'EVENT_NOT_FOUND', 'Event not found.');
      return;
    }

    const ticket = state.tickets.find(
      (candidate) => candidate.event_id === eventId && candidate.ticket_code === body.ticket_code,
    );

    if (!ticket) {
      sendSuccess(res, {
        status: 'INVALID',
        ticket_id: null,
        ticket_code: body.ticket_code,
        buyer_name: null,
        buyer_email: null,
        tier_name: null,
        checked_in_at: null,
        message: 'Kode tiket tidak valid.',
      });
      return;
    }

    if (ticket.status === 'used') {
      sendSuccess(res, {
        status: 'ALREADY_USED',
        ticket_id: ticket.id,
        ticket_code: ticket.ticket_code,
        buyer_name: ticket.attendee_name,
        buyer_email: ticket.attendee_email,
        tier_name: ticket.tier_name,
        checked_in_at: ticket.checked_in_at,
        message: 'Tiket sudah pernah digunakan.',
      });
      return;
    }

    ticket.status = 'used';
    ticket.checked_in_at = new Date().toISOString();
    state.checkins.push({
      id: randomUUID(),
      event_id: event.id,
      ticket_id: ticket.id,
      ticket_code: ticket.ticket_code,
      buyer_name: ticket.attendee_name,
      buyer_email: ticket.attendee_email,
      tier_name: ticket.tier_name,
      checked_in_at: ticket.checked_in_at,
    });

    sendSuccess(res, {
      status: 'SUCCESS',
      ticket_id: ticket.id,
      ticket_code: ticket.ticket_code,
      buyer_name: ticket.attendee_name,
      buyer_email: ticket.attendee_email,
      tier_name: ticket.tier_name,
      checked_in_at: ticket.checked_in_at,
      message: 'Tiket valid dan berhasil di-check-in.',
    });
    return;
  }

  if (req.method === 'GET' && path === '/notifications') {
    const user = getAuthorizedUser(req);

    if (!ensureAuthorized(res, user)) {
      return;
    }

    sendSuccess(res, { notifications: [], unread_count: 0 }, buildMeta(0, 1, 20));
    return;
  }

  if (req.method === 'GET' && path === '/users/me') {
    const user = getAuthorizedUser(req);

    if (!ensureAuthorized(res, user)) {
      return;
    }

    sendSuccess(res, {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      avatar_url: user.avatar_url,
      role: user.role,
      status: user.status,
      email_verified_at: user.email_verified_at,
      created_at: user.created_at,
      updated_at: user.updated_at,
    });
    return;
  }

  if (req.method === 'PATCH' && path === '/users/me') {
    const user = getAuthorizedUser(req);

    if (!ensureAuthorized(res, user)) {
      return;
    }

    const body = await readBody(req);
    user.full_name = body.full_name ?? user.full_name;
    user.phone = body.phone ?? user.phone;
    user.avatar_url = body.avatar_url ?? user.avatar_url;
    user.updated_at = new Date().toISOString();

    sendSuccess(res, {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      avatar_url: user.avatar_url,
      role: user.role,
      status: user.status,
      email_verified_at: user.email_verified_at,
      created_at: user.created_at,
      updated_at: user.updated_at,
    });
    return;
  }

  if (req.method === 'PATCH' && path === '/users/me/password') {
    const user = getAuthorizedUser(req);

    if (!ensureAuthorized(res, user)) {
      return;
    }

    sendSuccess(res, { message: 'Password berhasil diperbarui.' });
    return;
  }

  if (req.method === 'POST' && path === '/reservations') {
    const user = getAuthorizedUser(req, 'buyer');

    if (!ensureAuthorized(res, user, 'buyer')) {
      return;
    }

    const body = await readBody(req);
    const event = state.events.find((candidate) => candidate.tiers.some((tier) => tier.id === body.ticket_tier_id));
    const tier = event?.tiers.find((candidate) => candidate.id === body.ticket_tier_id);

    if (!event || !tier) {
      sendError(res, 404, 'TIER_NOT_FOUND', 'Ticket tier not found.');
      return;
    }

    const remaining = Math.max(tier.quota - tier.sold_count - reservedCountForTier(tier.id), 0);
    if (remaining < Number(body.quantity)) {
      sendError(res, 409, 'SOLD_OUT', 'Tiket habis untuk tier yang dipilih.');
      return;
    }

    const reservation = {
      id: randomUUID(),
      user_id: user.id,
      event_id: event.id,
      event_slug: event.slug,
      event_title: event.title,
      ticket_tier_id: tier.id,
      tier_name: tier.name,
      quantity: Number(body.quantity),
      status: 'active',
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
    };

    state.reservations.push(reservation);
    sendSuccess(
      res,
      {
        reservation_id: reservation.id,
        expires_at: reservation.expires_at,
      },
      undefined,
      201,
    );
    return;
  }

  if (req.method === 'GET' && path.startsWith('/reservations/')) {
    const user = getAuthorizedUser(req, 'buyer');

    if (!ensureAuthorized(res, user, 'buyer')) {
      return;
    }

    const reservationId = path.split('/')[2];
    const reservation = state.reservations.find(
      (candidate) => candidate.id === reservationId && candidate.user_id === user.id,
    );

    if (!reservation) {
      sendError(res, 404, 'RESERVATION_NOT_FOUND', 'Reservation not found.');
      return;
    }

    sendSuccess(res, {
      id: reservation.id,
      user_id: reservation.user_id,
      ticket_tier_id: reservation.ticket_tier_id,
      quantity: reservation.quantity,
      status: reservation.status,
      expires_at: reservation.expires_at,
      created_at: reservation.created_at,
      remaining_seconds: Math.max(
        Math.floor((new Date(reservation.expires_at).getTime() - Date.now()) / 1000),
        0,
      ),
      event_id: reservation.event_id,
      event_slug: reservation.event_slug,
      event_title: reservation.event_title,
      tier_name: reservation.tier_name,
    });
    return;
  }

  if (req.method === 'DELETE' && path.startsWith('/reservations/')) {
    const user = getAuthorizedUser(req, 'buyer');

    if (!ensureAuthorized(res, user, 'buyer')) {
      return;
    }

    const reservationId = path.split('/')[2];
    const reservation = state.reservations.find(
      (candidate) => candidate.id === reservationId && candidate.user_id === user.id,
    );

    if (!reservation) {
      sendError(res, 404, 'RESERVATION_NOT_FOUND', 'Reservation not found.');
      return;
    }

    reservation.status = 'cancelled';
    sendSuccess(res, { reservation_id: reservation.id, status: reservation.status });
    return;
  }

  if (req.method === 'POST' && path === '/orders') {
    const user = getAuthorizedUser(req, 'buyer');

    if (!ensureAuthorized(res, user, 'buyer')) {
      return;
    }

    const body = await readBody(req);
    const reservation = state.reservations.find(
      (candidate) =>
        candidate.id === body.reservation_id &&
        candidate.user_id === user.id &&
        candidate.status === 'active',
    );

    if (!reservation) {
      sendError(res, 400, 'RESERVATION_NOT_FOUND', 'Reservation not found.');
      return;
    }

    const event = state.events.find((candidate) => candidate.id === reservation.event_id);
    const tier = event?.tiers.find((candidate) => candidate.id === reservation.ticket_tier_id);

    if (!event || !tier) {
      sendError(res, 404, 'TIER_NOT_FOUND', 'Ticket tier not found.');
      return;
    }

    reservation.status = 'converted';
    const sellerProfile = state.sellerProfiles.find((profile) => profile.id === event.seller_profile_id);
    const serviceFee = 5000;
    const now = new Date().toISOString();
    const order = {
      id: randomUUID(),
      reservation_id: reservation.id,
      order_number: createOrderNumber(),
      status: 'pending',
      total_amount: tier.price * reservation.quantity + serviceFee,
      service_fee: serviceFee,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      confirmed_at: null,
      created_at: now,
      updated_at: now,
      user_id: user.id,
      seller_user_id: sellerProfile?.user_id ?? null,
      event_id: event.id,
      event_slug: event.slug,
      event_title: event.title,
      items: [
        {
          id: randomUUID(),
          ticket_tier_id: tier.id,
          tier_name: tier.name,
          quantity: reservation.quantity,
          unit_price: tier.price,
          subtotal: tier.price * reservation.quantity,
        },
      ],
    };

    state.orders.push(order);
    state.payments.push({
      id: randomUUID(),
      order_id: order.id,
      method: 'bank_transfer',
      status: 'pending',
      amount: order.total_amount,
      external_ref: null,
      paid_at: null,
      created_at: now,
      updated_at: now,
    });

    sendSuccess(res, toOrderDetail(order), undefined, 201);
    return;
  }

  if (req.method === 'GET' && path === '/orders') {
    const user = getAuthorizedUser(req, 'buyer');

    if (!ensureAuthorized(res, user, 'buyer')) {
      return;
    }

    const orders = state.orders.filter((candidate) => candidate.user_id === user.id).map(toOrderListItem);
    sendSuccess(res, orders, buildMeta(orders.length, 1, 10));
    return;
  }

  if (req.method === 'GET' && path.startsWith('/orders/')) {
    const user = getAuthorizedUser(req, 'buyer');

    if (!ensureAuthorized(res, user, 'buyer')) {
      return;
    }

    const orderId = path.split('/')[2];
    const order = state.orders.find((candidate) => candidate.id === orderId && candidate.user_id === user.id);

    if (!order) {
      sendError(res, 404, 'ORDER_NOT_FOUND', 'Order not found.');
      return;
    }

    sendSuccess(res, toOrderDetail(order));
    return;
  }

  if (req.method === 'POST' && path.startsWith('/payments/') && path.endsWith('/pay')) {
    const user = getAuthorizedUser(req, 'buyer');

    if (!ensureAuthorized(res, user, 'buyer')) {
      return;
    }

    const orderId = path.split('/')[2];
    const order = state.orders.find((candidate) => candidate.id === orderId && candidate.user_id === user.id);
    const payment = state.payments.find((candidate) => candidate.order_id === orderId);
    const body = await readBody(req);

    if (!order || !payment) {
      sendError(res, 404, 'ORDER_NOT_FOUND', 'Order not found.');
      return;
    }

    payment.method = body.method;
    payment.status = 'pending';
    payment.external_ref = `PAY-${Date.now()}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
    payment.updated_at = new Date().toISOString();

    sendSuccess(res, {
      order_id: order.id,
      payment_id: payment.id,
      method: payment.method,
      status: payment.status,
      external_ref: payment.external_ref,
      payment_url: `http://localhost:${PORT}/mock-payment/${payment.external_ref}`,
    });
    return;
  }

  if (req.method === 'POST' && path === '/webhooks/payment') {
    const body = await readBody(req);
    const payment = state.payments.find((candidate) => candidate.external_ref === body.external_ref);

    if (!payment) {
      sendError(res, 404, 'PAYMENT_NOT_FOUND', 'Payment not found.');
      return;
    }

    const order = state.orders.find((candidate) => candidate.id === payment.order_id);

    payment.status = body.status === 'failed' ? 'failed' : 'success';
    payment.paid_at = body.status === 'success' ? body.paid_at ?? new Date().toISOString() : null;
    payment.updated_at = new Date().toISOString();

    if (body.status === 'success' && order.status !== 'confirmed') {
      order.status = 'confirmed';
      order.confirmed_at = payment.paid_at;
      order.updated_at = new Date().toISOString();

      const event = state.events.find((candidate) => candidate.id === order.event_id);
      const buyer = state.users.find((candidate) => candidate.id === order.user_id);

      for (const item of order.items) {
        const tier = event.tiers.find((candidate) => candidate.id === item.ticket_tier_id);
        tier.sold_count += item.quantity;

        for (let index = 0; index < item.quantity; index += 1) {
          state.tickets.push({
            id: randomUUID(),
            user_id: buyer.id,
            order_id: order.id,
            order_number: order.order_number,
            ticket_tier_id: item.ticket_tier_id,
            tier_name: item.tier_name,
            ticket_code: createTicketCode(),
            attendee_name: buyer.full_name,
            attendee_email: buyer.email,
            status: 'valid',
            issued_at: new Date().toISOString(),
            checked_in_at: null,
            event_id: event.id,
            event_slug: event.slug,
            event_title: event.title,
            event_start_at: event.start_at,
            venue_name: event.venue_name,
            venue_address: event.venue_address,
            venue_city: event.venue_city,
          });
        }
      }
    }

    sendSuccess(res, {
      order_id: order.id,
      payment_id: payment.id,
      external_ref: payment.external_ref,
      status: body.status === 'success' ? 'success' : 'failed',
    });
    return;
  }

  if (req.method === 'GET' && path === '/tickets') {
    const user = getAuthorizedUser(req, 'buyer');

    if (!ensureAuthorized(res, user, 'buyer')) {
      return;
    }

    const tickets = state.tickets.filter((candidate) => candidate.user_id === user.id).map((ticket) => ({
      id: ticket.id,
      order_id: ticket.order_id,
      order_number: ticket.order_number,
      ticket_tier_id: ticket.ticket_tier_id,
      tier_name: ticket.tier_name,
      ticket_code: ticket.ticket_code,
      status: ticket.status,
      issued_at: ticket.issued_at,
      event_id: ticket.event_id,
      event_slug: ticket.event_slug,
      event_title: ticket.event_title,
      event_start_at: ticket.event_start_at,
      venue_name: ticket.venue_name,
      venue_city: ticket.venue_city,
    }));

    sendSuccess(res, tickets, buildMeta(tickets.length, 1, 24));
    return;
  }

  if (req.method === 'GET' && path.startsWith('/tickets/')) {
    const user = getAuthorizedUser(req, 'buyer');

    if (!ensureAuthorized(res, user, 'buyer')) {
      return;
    }

    const ticketId = path.split('/')[2];
    const ticket = state.tickets.find((candidate) => candidate.id === ticketId && candidate.user_id === user.id);

    if (!ticket) {
      sendError(res, 404, 'TICKET_NOT_FOUND', 'Ticket not found.');
      return;
    }

    sendSuccess(res, {
      id: ticket.id,
      order_id: ticket.order_id,
      order_number: ticket.order_number,
      ticket_tier_id: ticket.ticket_tier_id,
      tier_name: ticket.tier_name,
      ticket_code: ticket.ticket_code,
      qr_data: ticket.ticket_code,
      attendee_name: ticket.attendee_name,
      attendee_email: ticket.attendee_email,
      status: ticket.status,
      issued_at: ticket.issued_at,
      checked_in_at: ticket.checked_in_at,
      event: {
        id: ticket.event_id,
        slug: ticket.event_slug,
        title: ticket.event_title,
        banner_url: null,
        start_at: ticket.event_start_at,
        end_at: ticket.event_start_at,
        venue_name: ticket.venue_name,
        venue_address: ticket.venue_address,
        venue_city: ticket.venue_city,
      },
    });
    return;
  }

  sendError(res, 404, 'NOT_FOUND', `No mock route registered for ${req.method} ${path}.`);
});

server.listen(PORT, () => {
  console.log(`Mock E2E API listening on http://localhost:${PORT}`);
});