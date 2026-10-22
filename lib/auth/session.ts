import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { UserRole } from "@prisma/client";

export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "mb_auth_session";
const SESSION_EXPIRY_DAYS = Number(process.env.AUTH_SESSION_EXPIRY_DAYS || 7);

export interface AuthSessionPayload {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
  isActive: boolean;
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET must be configured and be at least 32 characters long in your environment."
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * Hash a plain text password with bcrypt
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plainPassword, salt);
}

/**
 * Verify a plain text password against a hash
 */
export async function verifyPassword(
  plainPassword: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hash);
}

/**
 * Create a cryptographically signed JWT token for the user session
 */
export async function createSessionToken(payload: AuthSessionPayload): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT({
    sub: payload.userId,
    email: payload.email,
    role: payload.role,
    name: payload.name,
    isActive: payload.isActive,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_EXPIRY_DAYS}d`)
    .sign(secret);
}

/**
 * Verify and decode a JWT token string
 */
export async function verifySessionToken(
  token: string
): Promise<AuthSessionPayload | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });

    if (
      !payload.sub ||
      !payload.email ||
      !payload.role ||
      typeof payload.isActive !== "boolean"
    ) {
      return null;
    }

    return {
      userId: payload.sub as string,
      email: payload.email as string,
      role: payload.role as UserRole,
      name: (payload.name as string) || "",
      isActive: payload.isActive as boolean,
    };
  } catch {
    return null;
  }
}

/**
 * Sets the httpOnly, secure, sameSite session cookie
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  const maxAge = SESSION_EXPIRY_DAYS * 24 * 60 * 60;

  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

/**
 * Clears the session cookie upon logout
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Retrieves and validates the current session from incoming cookies.
 * Does NOT expose raw secrets or full DB state to caller.
 */
export async function getCurrentSession(): Promise<AuthSessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (!token) {
      return null;
    }

    const session = await verifySessionToken(token);
    if (!session || !session.isActive) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Convenience alias for components expecting getCurrentUser()
 */
export async function getCurrentUser(): Promise<AuthSessionPayload | null> {
  return getCurrentSession();
}

/**
 * Require admin or staff role
 */
export async function requireAdminOrStaff(): Promise<AuthSessionPayload> {
  const session = await getCurrentSession();
  if (!session || session.role === "CUSTOMER") {
    throw new Error("Unauthorized");
  }
  return session;
}

