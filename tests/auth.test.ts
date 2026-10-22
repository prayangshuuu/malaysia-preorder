import test from "node:test";
import assert from "node:assert/strict";
import { UserRole } from "@prisma/client";
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
} from "../lib/auth/session";
import {
  registerSchema,
} from "../lib/auth/validation";
import { isAdminOrStaffRole, AuthorizationError } from "../lib/auth/rbac";
import { rateLimit } from "../lib/auth/rate-limit";

// Set AUTH_SECRET for test runner
process.env.AUTH_SECRET =
  process.env.AUTH_SECRET ||
  "test-secret-at-least-32-characters-long-1234567890";

test("Password Hashing & Verification", async () => {
  const plain = "Secur3P@ssw0rd";
  const hash = await hashPassword(plain);

  assert.notEqual(hash, plain);
  assert.ok(await verifyPassword(plain, hash));
  assert.equal(await verifyPassword("wrongpassword", hash), false);
});

test("JWT Session Token Lifecycle", async () => {
  const payload = {
    userId: "cust_123",
    email: "customer@example.com",
    role: UserRole.CUSTOMER,
    name: "Rahim Chowdhury",
    isActive: true,
  };

  const token = await createSessionToken(payload);
  assert.ok(typeof token === "string" && token.length > 20);

  const decoded = await verifySessionToken(token);
  assert.ok(decoded);
  assert.equal(decoded.userId, "cust_123");
  assert.equal(decoded.email, "customer@example.com");
  assert.equal(decoded.role, UserRole.CUSTOMER);
  assert.equal(decoded.isActive, true);
});

test("Tampered Session Token is Rejected", async () => {
  const token = await createSessionToken({
    userId: "cust_123",
    email: "customer@example.com",
    role: UserRole.CUSTOMER,
    name: "Rahim",
    isActive: true,
  });

  const tamperedToken = token.slice(0, -6) + "xxxxxx";
  const decoded = await verifySessionToken(tamperedToken);
  assert.equal(decoded, null);
});

test("RBAC: Role Hierarchy and Staff Permissions", () => {
  assert.equal(isAdminOrStaffRole(UserRole.CUSTOMER), false);
  assert.equal(isAdminOrStaffRole(UserRole.ADMIN), true);
  assert.equal(isAdminOrStaffRole(UserRole.OPERATIONS), true);
  assert.equal(isAdminOrStaffRole(UserRole.FINANCE), true);
  assert.equal(isAdminOrStaffRole(UserRole.SUPPORT), true);
});

test("Validation: Customer Registration Schema", () => {
  // Valid
  const valid = registerSchema.safeParse({
    name: "Karim Ullah",
    email: "Karim@Example.Com",
    phone: "01812345678",
    password: "Password123",
  });
  assert.ok(valid.success);
  if (valid.success) {
    assert.equal(valid.data.email, "karim@example.com"); // downcased
  }

  // Invalid email
  const invalidEmail = registerSchema.safeParse({
    name: "Karim",
    email: "not-an-email",
    password: "Password123",
  });
  assert.equal(invalidEmail.success, false);

  // Password too short
  const shortPass = registerSchema.safeParse({
    name: "Karim",
    email: "karim@example.com",
    password: "abc",
  });
  assert.equal(shortPass.success, false);
});

test("IDOR Ownership Simulation & Denials", () => {
  const customerA = "user_aaa_111";
  const customerB = "user_bbb_222";
  const adminStaff = "admin_999";

  function simulateAccess(requestUserId: string, requestUserRole: UserRole, resourceOwnerId: string) {
    const isOwner = requestUserId === resourceOwnerId;
    const isStaff = isAdminOrStaffRole(requestUserRole);

    if (!isOwner && !isStaff) {
      throw new AuthorizationError("Access denied: You do not have permission to access this record.", 403);
    }
    return true;
  }

  // Owner can access
  assert.equal(simulateAccess(customerA, UserRole.CUSTOMER, customerA), true);

  // Admin can access
  assert.equal(simulateAccess(adminStaff, UserRole.ADMIN, customerA), true);

  // Cross-customer access is strictly DENIED
  assert.throws(
    () => simulateAccess(customerB, UserRole.CUSTOMER, customerA),
    (err: unknown) => {
      assert.ok(err instanceof AuthorizationError);
      assert.equal(err.statusCode, 403);
      return true;
    }
  );
});

test("Rate Limiter correctly bounds requests", async () => {
  const ip = "test-ip-" + Date.now();
  const limit = 3;

  const r1 = await rateLimit(ip, { limit, windowSeconds: 60 });
  assert.equal(r1.success, true);
  assert.equal(r1.remaining, 2);

  const r2 = await rateLimit(ip, { limit, windowSeconds: 60 });
  assert.equal(r2.success, true);
  assert.equal(r2.remaining, 1);

  const r3 = await rateLimit(ip, { limit, windowSeconds: 60 });
  assert.equal(r3.success, true);
  assert.equal(r3.remaining, 0);

  // 4th should fail
  const r4 = await rateLimit(ip, { limit, windowSeconds: 60 });
  assert.equal(r4.success, false);
  assert.equal(r4.remaining, 0);
  assert.ok(r4.retryAfterSeconds > 0);
});
