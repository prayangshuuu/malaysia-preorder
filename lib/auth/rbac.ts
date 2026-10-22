import { UserRole } from "@prisma/client";
import { getCurrentSession, AuthSessionPayload } from "./session";

export class AuthorizationError extends Error {
  public statusCode: number;

  constructor(message = "Unauthorized", statusCode = 401) {
    super(message);
    this.name = "AuthorizationError";
    this.statusCode = statusCode;
  }
}

/**
 * Ensures user is authenticated. Throws AuthorizationError (401) if not.
 */
export async function requireAuth(): Promise<AuthSessionPayload> {
  const session = await getCurrentSession();
  if (!session) {
    throw new AuthorizationError("You must be logged in to access this resource.", 401);
  }
  return session;
}

/**
 * Checks if the current role is an internal staff/admin role
 */
export function isAdminOrStaffRole(role: UserRole): boolean {
  return (
    role === UserRole.ADMIN ||
    role === UserRole.OPERATIONS ||
    role === UserRole.FINANCE ||
    role === UserRole.SUPPORT
  );
}

/**
 * Ensures the authenticated user has an Admin or Staff role. Throws 403 if forbidden.
 */
export async function requireAdminOrStaff(
  allowedRoles?: UserRole[]
): Promise<AuthSessionPayload> {
  const session = await requireAuth();

  const permitted = allowedRoles
    ? allowedRoles.includes(session.role)
    : isAdminOrStaffRole(session.role);

  if (!permitted) {
    throw new AuthorizationError(
      "Forbidden: You do not have permission to access this administrative area.",
      403
    );
  }

  return session;
}

/**
 * Ensures strict ADMIN role (for critical actions like provisioning, system settings, user role changes).
 */
export async function requireSuperAdmin(): Promise<AuthSessionPayload> {
  const session = await requireAuth();

  if (session.role !== UserRole.ADMIN) {
    throw new AuthorizationError(
      "Forbidden: Super Administrator privileges are required.",
      403
    );
  }

  return session;
}

/**
 * IDOR Prevention: Enforces resource ownership.
 * Allows resource access IF the current user is the owner (matching resourceOwnerId)
 * OR if the current user has staff/admin permissions.
 */
export async function assertResourceOwnership(
  resourceOwnerId: string,
  options: { allowStaff?: boolean; errorMessage?: string } = {}
): Promise<AuthSessionPayload> {
  const session = await requireAuth();
  const allowStaff = options.allowStaff ?? true;

  const isOwner = session.userId === resourceOwnerId;
  const isStaff = allowStaff && isAdminOrStaffRole(session.role);

  if (!isOwner && !isStaff) {
    throw new AuthorizationError(
      options.errorMessage || "Access denied: You do not have permission to access this record.",
      403
    );
  }

  return session;
}
