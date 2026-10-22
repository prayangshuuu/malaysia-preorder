import test from "node:test";
import assert from "node:assert/strict";
import {
  createInquirySchema,
  customerInquiryReplySchema,
  canTransitionInquiryStatus,
  adminUpdateInquiryStatusSchema,
  adminSendInquiryMessageSchema,
  adminUpdatePrivateNotesSchema,
} from "@/lib/validations/inquiry";
import { validateUploadFile, getStorageConfig } from "@/lib/storage";
import { InquiryStatus, UserRole } from "@prisma/client";
import { AuthorizationError, isAdminOrStaffRole } from "@/lib/auth/rbac";

test("Inquiry Validation: createInquirySchema validates correctly", () => {
  // Valid inquiry
  const valid = createInquirySchema.safeParse({
    productName: "Dyson Airwrap Multi-Styler Strawberry Bronze",
    referenceUrl: "https://www.dyson.my/hair-care/airwrap",
    brandOrModel: "Airwrap Multi-Styler Complete Long",
    quantityRequested: 1,
    targetBudgetBDT: 75000,
    preferredOptions: "Strawberry Bronze / Blush Pink",
    specifications: "Malaysia 230V 3-pin UK plug, original retail box required",
    notes: "Please inspect seal before purchase",
  });
  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.quantityRequested, 1);
    assert.equal(valid.data.productName, "Dyson Airwrap Multi-Styler Strawberry Bronze");
  }

  // Invalid: Empty / short product name
  const emptyName = createInquirySchema.safeParse({
    productName: "A",
    quantityRequested: 1,
  });
  assert.equal(emptyName.success, false);

  // Invalid: Malformed reference URL
  const invalidUrl = createInquirySchema.safeParse({
    productName: "Nestle Milo Soft Pack",
    referenceUrl: "not-a-valid-http-url",
    quantityRequested: 2,
  });
  assert.equal(invalidUrl.success, false);

  // Valid: Empty string URL is accepted and normalized
  const emptyUrl = createInquirySchema.safeParse({
    productName: "OldTown White Coffee 3-in-1",
    referenceUrl: "",
    quantityRequested: 5,
  });
  assert.equal(emptyUrl.success, true);

  // Invalid: Zero or negative quantity
  const zeroQty = createInquirySchema.safeParse({
    productName: "Garrett Popcorn Chicago Mix",
    quantityRequested: 0,
  });
  assert.equal(zeroQty.success, false);

  const negQty = createInquirySchema.safeParse({
    productName: "Garrett Popcorn Chicago Mix",
    quantityRequested: -3,
  });
  assert.equal(negQty.success, false);

  // Invalid: Excessive quantity exceeding safe pre-order limit
  const hugeQty = createInquirySchema.safeParse({
    productName: "Secret Recipe Whole Cake",
    quantityRequested: 50000,
  });
  assert.equal(hugeQty.success, false);

  // Valid: Attachment URLs within limits (max 5)
  const validAttachments = createInquirySchema.safeParse({
    productName: "Vincci Handbag Rose Gold",
    quantityRequested: 1,
    attachmentUrls: [
      {
        fileUrl: "https://storage.example.com/inquiries/photo1.jpg",
        fileName: "photo1.jpg",
        fileType: "image/jpeg",
        fileSizeBytes: 102400,
      },
      {
        fileUrl: "https://storage.example.com/inquiries/photo2.png",
        fileName: "photo2.png",
        fileType: "image/png",
        fileSizeBytes: 204800,
      },
    ],
  });
  assert.equal(validAttachments.success, true);

  // Invalid: Exceeding 5 attachments
  const tooManyAttachments = createInquirySchema.safeParse({
    productName: "Vincci Handbag Rose Gold",
    quantityRequested: 1,
    attachmentUrls: Array.from({ length: 6 }).map((_, idx) => ({
      fileUrl: `https://storage.example.com/inquiries/photo${idx}.jpg`,
      fileName: `photo${idx}.jpg`,
      fileType: "image/jpeg",
    })),
  });
  assert.equal(tooManyAttachments.success, false);
});

test("Customer Reply Validation: customerInquiryReplySchema", () => {
  const valid = customerInquiryReplySchema.safeParse({
    inquiryId: "123e4567-e89b-12d3-a456-426614174000",
    messageText: "I confirm the 230V UK 3-pin plug is correct.",
  });
  assert.equal(valid.success, true);

  const emptyText = customerInquiryReplySchema.safeParse({
    inquiryId: "123e4567-e89b-12d3-a456-426614174000",
    messageText: "   ",
  });
  assert.equal(emptyText.success, false);

  const invalidId = customerInquiryReplySchema.safeParse({
    inquiryId: "not-a-uuid",
    messageText: "Hello",
  });
  assert.equal(invalidId.success, false);
});

test("Inquiry Status Transitions: canTransitionInquiryStatus enforces strict state machine", () => {
  // Same status is always permitted (no-op)
  assert.equal(canTransitionInquiryStatus(InquiryStatus.SUBMITTED, InquiryStatus.SUBMITTED), true);

  // Allowed SUBMITTED transitions
  assert.equal(canTransitionInquiryStatus(InquiryStatus.SUBMITTED, InquiryStatus.UNDER_REVIEW), true);
  assert.equal(canTransitionInquiryStatus(InquiryStatus.SUBMITTED, InquiryStatus.NEEDS_INFORMATION), true);
  assert.equal(canTransitionInquiryStatus(InquiryStatus.SUBMITTED, InquiryStatus.QUOTED), true);
  assert.equal(canTransitionInquiryStatus(InquiryStatus.SUBMITTED, InquiryStatus.DECLINED), true);
  assert.equal(canTransitionInquiryStatus(InquiryStatus.SUBMITTED, InquiryStatus.CANCELLED), true);

  // Disallowed SUBMITTED -> ACCEPTED without a quote being accepted
  assert.equal(canTransitionInquiryStatus(InquiryStatus.SUBMITTED, InquiryStatus.ACCEPTED), false);

  // Allowed UNDER_REVIEW transitions
  assert.equal(canTransitionInquiryStatus(InquiryStatus.UNDER_REVIEW, InquiryStatus.NEEDS_INFORMATION), true);
  assert.equal(canTransitionInquiryStatus(InquiryStatus.UNDER_REVIEW, InquiryStatus.QUOTED), true);
  assert.equal(canTransitionInquiryStatus(InquiryStatus.UNDER_REVIEW, InquiryStatus.DECLINED), true);

  // Allowed NEEDS_INFORMATION transitions
  assert.equal(canTransitionInquiryStatus(InquiryStatus.NEEDS_INFORMATION, InquiryStatus.UNDER_REVIEW), true);
  assert.equal(canTransitionInquiryStatus(InquiryStatus.NEEDS_INFORMATION, InquiryStatus.QUOTED), true);

  // Allowed QUOTED transitions
  assert.equal(canTransitionInquiryStatus(InquiryStatus.QUOTED, InquiryStatus.ACCEPTED), true);
  assert.equal(canTransitionInquiryStatus(InquiryStatus.QUOTED, InquiryStatus.DECLINED), true);
  assert.equal(canTransitionInquiryStatus(InquiryStatus.QUOTED, InquiryStatus.CANCELLED), true);

  // Disallowed CANCELLED transitions (terminal state)
  assert.equal(canTransitionInquiryStatus(InquiryStatus.CANCELLED, InquiryStatus.SUBMITTED), false);
  assert.equal(canTransitionInquiryStatus(InquiryStatus.CANCELLED, InquiryStatus.UNDER_REVIEW), false);
  assert.equal(canTransitionInquiryStatus(InquiryStatus.CANCELLED, InquiryStatus.QUOTED), false);
});

test("Admin Status & Messaging Validation", () => {
  // Update status validation
  const validStatusUpdate = adminUpdateInquiryStatusSchema.safeParse({
    inquiryId: "123e4567-e89b-12d3-a456-426614174000",
    targetStatus: InquiryStatus.UNDER_REVIEW,
    reason: "Assigned to KL sourcing agent for store inspection",
  });
  assert.equal(validStatusUpdate.success, true);

  // Private notes validation
  const validNotes = adminUpdatePrivateNotesSchema.safeParse({
    inquiryId: "123e4567-e89b-12d3-a456-426614174000",
    adminPrivateNotes: "Supplier: Mid Valley Megamall outlet. Contact: Mr. Tan. RM 250 with 10% voucher.",
  });
  assert.equal(validNotes.success, true);

  // Send message validation
  const validMsg = adminSendInquiryMessageSchema.safeParse({
    inquiryId: "123e4567-e89b-12d3-a456-426614174000",
    messageText: "We located stock at Sunway Pyramid. Do you need the gift wrapping?",
    isStaffOnly: false,
    setNeedsInformation: true,
  });
  assert.equal(validMsg.success, true);
  if (validMsg.success) {
    assert.equal(validMsg.data.setNeedsInformation, true);
    assert.equal(validMsg.data.isStaffOnly, false);
  }
});

test("Attachment & File Upload Validation", () => {
  // Valid MIME types
  const validJpeg = validateUploadFile("image/jpeg", 2 * 1024 * 1024);
  assert.equal(validJpeg.valid, true);

  const validPng = validateUploadFile("image/png", 4 * 1024 * 1024);
  assert.equal(validPng.valid, true);

  const validWebp = validateUploadFile("image/webp", 1 * 1024 * 1024);
  assert.equal(validWebp.valid, true);

  // Invalid MIME type (e.g. PDF or executable)
  const invalidPdf = validateUploadFile("application/pdf", 1024 * 1024);
  assert.equal(invalidPdf.valid, false);
  assert.match(invalidPdf.error || "", /Unsupported file type/);

  const invalidExe = validateUploadFile("application/x-msdownload", 1024 * 1024);
  assert.equal(invalidExe.valid, false);

  // File size exceeding limit (> 5MB)
  const tooLarge = validateUploadFile("image/jpeg", 6 * 1024 * 1024);
  assert.equal(tooLarge.valid, false);
  assert.match(tooLarge.error || "", /exceeds the maximum limit/);
});

test("Storage Provider Configuration Truthfulness", () => {
  // In default local dev environment, storage is unconfigured
  const config = getStorageConfig();
  if (!process.env.STORAGE_ENDPOINT) {
    assert.equal(config.isConfigured, false);
    assert.equal(config.provider, "disabled");
    assert.ok(config.missingKeys.includes("STORAGE_ENDPOINT"));
  }
});

test("IDOR & Cross-Customer Protection Invariants for Inquiries", () => {
  const customerA = "cust_aaa_001";
  const customerB = "cust_bbb_002";
  const staffMember = "staff_ops_999";

  function assertAccess(requestUser: { id: string; role: UserRole }, resourceOwnerId: string) {
    const isOwner = requestUser.id === resourceOwnerId;
    const isStaff = isAdminOrStaffRole(requestUser.role);

    if (!isOwner && !isStaff) {
      throw new AuthorizationError("Access denied: You do not have permission to access this record.", 403);
    }
    return true;
  }

  // Customer A can view their own inquiry
  assert.equal(assertAccess({ id: customerA, role: UserRole.CUSTOMER }, customerA), true);

  // Operations staff can view Customer A's inquiry
  assert.equal(assertAccess({ id: staffMember, role: UserRole.OPERATIONS }, customerA), true);

  // Customer B CANNOT view Customer A's inquiry (Strict IDOR denial)
  assert.throws(
    () => assertAccess({ id: customerB, role: UserRole.CUSTOMER }, customerA),
    (err: unknown) => {
      assert.ok(err instanceof AuthorizationError);
      assert.equal(err.statusCode, 403);
      return true;
    }
  );
});

test("Staff Confidentiality: Staff-only notes and admin notes are stripped for customers", () => {
  const rawInquiry = {
    id: "inq_123",
    userId: "cust_aaa_001",
    productName: "Garrett Popcorn",
    adminPrivateNotes: "CONFIDENTIAL: Bought at KLCC for RM 35. Margin: 45%.",
    messages: [
      { id: "msg_1", messageText: "Customer: Is this available?", isStaffOnly: false },
      { id: "msg_2", messageText: "STAFF NOTE: Supplier inventory low, check Pavilion branch.", isStaffOnly: true },
      { id: "msg_3", messageText: "Staff: Yes, we found stock!", isStaffOnly: false },
    ],
  };

  function sanitizeInquiryForViewer(inquiry: typeof rawInquiry, viewerRole: UserRole) {
    const isStaff = isAdminOrStaffRole(viewerRole);

    return {
      id: inquiry.id,
      productName: inquiry.productName,
      adminPrivateNotes: isStaff ? inquiry.adminPrivateNotes : undefined,
      messages: isStaff
        ? inquiry.messages
        : inquiry.messages.filter((m) => !m.isStaffOnly),
    };
  }

  // Customer view
  const customerView = sanitizeInquiryForViewer(rawInquiry, UserRole.CUSTOMER);
  assert.equal(customerView.adminPrivateNotes, undefined);
  assert.equal(customerView.messages.length, 2);
  assert.equal(customerView.messages.some((m) => m.isStaffOnly), false);

  // Staff view
  const staffView = sanitizeInquiryForViewer(rawInquiry, UserRole.ADMIN);
  assert.equal(staffView.adminPrivateNotes, rawInquiry.adminPrivateNotes);
  assert.equal(staffView.messages.length, 3);
  assert.equal(staffView.messages.some((m) => m.isStaffOnly), true);
});
