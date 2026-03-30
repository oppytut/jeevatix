import { sign, verify } from 'hono/jwt';

const ACCESS_TOKEN_TTL_SECONDS = 60 * 15;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const JWT_ALGORITHM = 'HS256';

const USER_ROLES = ['buyer', 'seller', 'admin'] as const;
const TOKEN_TYPES = ['access', 'refresh'] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type TokenType = (typeof TOKEN_TYPES)[number];

export type TokenPayloadInput = {
  id: string;
  email: string;
  role: UserRole;
};

export type TokenPayload = TokenPayloadInput & {
  jti: string;
  type: TokenType;
  iat: number;
  exp: number;
};

function createTokenPayload(
  payload: TokenPayloadInput,
  type: TokenType,
  ttlSeconds: number,
): TokenPayload {
  const issuedAt = Math.floor(Date.now() / 1000);

  return {
    ...payload,
    jti: crypto.randomUUID(),
    type,
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
  };
}

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && USER_ROLES.includes(value as UserRole);
}

function isTokenType(value: unknown): value is TokenType {
  return typeof value === 'string' && TOKEN_TYPES.includes(value as TokenType);
}

function assertTokenPayload(payload: Record<string, unknown>): TokenPayload {
  if (
    typeof payload.id !== 'string' ||
    typeof payload.email !== 'string' ||
    typeof payload.jti !== 'string' ||
    !isUserRole(payload.role) ||
    !isTokenType(payload.type) ||
    typeof payload.iat !== 'number' ||
    typeof payload.exp !== 'number'
  ) {
    throw new Error('Invalid token payload.');
  }

  return {
    id: payload.id,
    email: payload.email,
    jti: payload.jti,
    role: payload.role,
    type: payload.type,
    iat: payload.iat,
    exp: payload.exp,
  };
}

export async function generateAccessToken(
  payload: TokenPayloadInput,
  secret: string,
): Promise<string> {
  return sign(createTokenPayload(payload, 'access', ACCESS_TOKEN_TTL_SECONDS), secret);
}

export async function generateRefreshToken(
  payload: TokenPayloadInput,
  secret: string,
): Promise<string> {
  return sign(createTokenPayload(payload, 'refresh', REFRESH_TOKEN_TTL_SECONDS), secret);
}

export async function verifyToken(token: string, secret: string): Promise<TokenPayload> {
  const payload = (await verify(token, secret, JWT_ALGORITHM)) as Record<string, unknown>;
  return assertTokenPayload(payload);
}

export { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS, JWT_ALGORITHM };
