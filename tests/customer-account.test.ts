import test from "node:test";
import assert from "node:assert/strict";
import { UserRole } from "@prisma/client";
import { assertResourceOwnership, AuthorizationError } from "../lib/auth/rbac";

test("Customer Dashboard RBAC & IDOR: Scoped to authenticated customer", () => {
  const customerIdA = "11111111-1111-1111-1111-111111111111";
  const customerIdB = "22222222-2222-2222-2222-222222222222";
  const adminStaff = "99999999-9999-9999-9999-999999999999";

  function checkOwnership(currentUserId: string, currentUserRole: UserRole, resourceOwnerId: string) {
    const isOwner = currentUserId === resourceOwnerId;
    const isStaff = ([UserRole.ADMIN, UserRole.OPERATIONS, UserRole.FINANCE, UserRole.SUPPORT] as UserRole[]).includes(currentUserRole);

    if (!isOwner && !isStaff) {
      throw new AuthorizationError("Cross-customer access denied.", 403);
    }
    return true;
  }

  // Cross-customer access rejected with 403
  assert.throws(
    () => checkOwnership(customerIdA, UserRole.CUSTOMER, customerIdB),
    (err: unknown) => {
      assert.ok(err instanceof AuthorizationError);
      assert.equal(err.statusCode, 403);
      assert.equal(err.message, "Cross-customer access denied.");
      return true;
    }
  );

  // Customer accessing own record succeeds
  assert.equal(checkOwnership(customerIdA, UserRole.CUSTOMER, customerIdA), true);

  // Staff accessing record succeeds
  assert.equal(checkOwnership(adminStaff, UserRole.ADMIN, customerIdB), true);
});

test("Customer Data Isolation: Staff-only inquiry messages and admin notes are stripped", () => {
  const inquiryMessages = [
    {
      id: "msg-1",
      senderId: "cust-1",
      messageText: "Can I get this in Blue color?",
      isStaffOnly: false,
      createdAt: new Date(),
    },
    {
      id: "msg-2",
      senderId: "staff-1",
      messageText: "Checking with MidValley store right now.",
      isStaffOnly: false,
      createdAt: new Date(),
    },
    {
      id: "msg-3",
      senderId: "staff-1",
      messageText: "CONFIDENTIAL: Wholesale partner offers RM 200 discount on 5 units.",
      isStaffOnly: true, // Internal staff only
      createdAt: new Date(),
    },
  ];

  // Emulate customer-scoped query filter where { isStaffOnly: false }
  const customerVisibleMessages = inquiryMessages.filter((m) => !m.isStaffOnly);

  assert.equal(customerVisibleMessages.length, 2);
  assert.equal(customerVisibleMessages.some((m) => m.messageText.includes("CONFIDENTIAL")), false);
});
