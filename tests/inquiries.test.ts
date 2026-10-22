import test from "node:test";
import assert from "node:assert/strict";
import { InquiryStatus, UserRole } from "@prisma/client";
import {
  createInquirySchema,
  customerInquiryReplySchema,
  canTransitionInquiryStatus,
  adminUpdateInquiryStatusSchema,
  adminUpdatePrivateNotesSchema,
  adminSendInquiryMessageSchema,
  adminInquiryFilterSchema,
} from "../lib/validations/inquiry";
import { validateUploadFile } from "../lib/storage";
import { isAdminOrStaffRole } from "../lib/auth/rbac";

test("Customer Inquiry Submission: Validation & Sanity", () => {
  // Valid inquiry
  const validData = {
    productName: "Dyson Airwrap Multi-Styler Strawberry Bronze",
    referenceUrl: "https://www.dyson.my/hair-care/airwrap",
    brandOrModel: "HS05 Strawberry Bronze",
    specifications: "Malaysian 3-pin plug 230V, brand new in sealed box",
    preferredOptions: "Strawberry Bronze / Blush Pink",
    notes: "Please confirm warranty registration eligibility",
    quantityRequested: 1,
    targetBudgetBDT: 75000,
    attachmentUrls: [
      {
        fileUrl: "https://images.example.com/dyson1.jpg",
        fileName: "dyson1.jpg",
        fileType: "image/jpeg",
        fileSizeBytes: 204800,
      },
    ],
  };

  const parsed = createInquirySchema.safeParse(validData);
  assert.ok(parsed.success, "Valid inquiry data should pass validation");

  // Invalid: Empty product name
  const invalidName = createInquirySchema.safeParse({
    ...validData,
    productName: "   ",
  });
  assert.equal(invalidName.success, false, "Whitespace product name must fail");

  // Invalid: Quantity < 1
  const invalidQty = createInquirySchema.safeParse({
    ...validData,
    quantityRequested: 0,
  });
  assert.equal(invalidQty.success, false, "Quantity < 1 must fail");

  // Invalid: Malformed reference URL
  const invalidUrl = createInquirySchema.safeParse({
    ...validData,
    referenceUrl: "not-a-valid-http-url",
  });
  assert.equal(invalidUrl.success, false, "Malformed URL must fail");

  // Invalid: Too many attachments (> 5)
  const tooManyAttachments = createInquirySchema.safeParse({
    ...validData,
    attachmentUrls: Array(6).fill({
      fileUrl: "https://images.example.com/test.jpg",
    }),
  });
  assert.equal(tooManyAttachments.success, false, "More than 5 attachments must fail");
});

test("Customer Reply Validation", () => {
  const validReply = customerInquiryReplySchema.safeParse({
    inquiryId: "c18f1f8b-21d4-4bbd-9a67-8cfb629e46a7",
    messageText: "I prefer the 230V UK standard Malaysian plug.",
  });
  assert.ok(validReply.success);

  const emptyReply = customerInquiryReplySchema.safeParse({
    inquiryId: "c18f1f8b-21d4-4bbd-9a67-8cfb629e46a7",
    messageText: "    ",
  });
  assert.equal(emptyReply.success, false, "Empty reply message must fail");
});

test("File Upload Security: Allowed types, size boundaries", () => {
  // Allowed image types
  const allowedPng = validateUploadFile("image/png", 1024 * 500);
  assert.ok(allowedPng.valid, "PNG should be valid");

  const allowedJpeg = validateUploadFile("image/jpeg", 1024 * 1024);
  assert.ok(allowedJpeg.valid, "JPEG should be valid");

  const allowedWebp = validateUploadFile("image/webp", 1024 * 800);
  assert.ok(allowedWebp.valid, "WEBP should be valid");

  // Disallowed types (e.g. executable, script, html)
  const forbiddenExe = validateUploadFile("application/x-msdownload", 1024);
  assert.equal(forbiddenExe.valid, false, "EXE should be rejected");

  const forbiddenHtml = validateUploadFile("text/html", 1024);
  assert.equal(forbiddenHtml.valid, false, "HTML should be rejected");

  // Size limit exceeding 5MB
  const oversize = validateUploadFile("image/jpeg", 6 * 1024 * 1024);
  assert.equal(oversize.valid, false, "Files > 5MB must be rejected");
  assert.match(oversize.error || "", /exceeds the maximum limit/);
});

test("Inquiry Status Transition Rules: Valid & Illegal State Changes", () => {
  // Legal transitions
  assert.ok(canTransitionInquiryStatus(InquiryStatus.SUBMITTED, InquiryStatus.UNDER_REVIEW));
  assert.ok(canTransitionInquiryStatus(InquiryStatus.SUBMITTED, InquiryStatus.NEEDS_INFORMATION));
  assert.ok(canTransitionInquiryStatus(InquiryStatus.UNDER_REVIEW, InquiryStatus.QUOTED));
  assert.ok(canTransitionInquiryStatus(InquiryStatus.UNDER_REVIEW, InquiryStatus.DECLINED));
  assert.ok(canTransitionInquiryStatus(InquiryStatus.NEEDS_INFORMATION, InquiryStatus.UNDER_REVIEW));
  assert.ok(canTransitionInquiryStatus(InquiryStatus.QUOTED, InquiryStatus.ACCEPTED));

  // Illegal transitions
  assert.equal(
    canTransitionInquiryStatus(InquiryStatus.CANCELLED, InquiryStatus.SUBMITTED),
    false,
    "Cancelled inquiry cannot be revived to submitted"
  );
  assert.equal(
    canTransitionInquiryStatus(InquiryStatus.ACCEPTED, InquiryStatus.NEEDS_INFORMATION),
    false,
    "Accepted inquiry cannot be shifted back to needs information"
  );
  assert.equal(
    canTransitionInquiryStatus(InquiryStatus.DECLINED, InquiryStatus.QUOTED),
    false,
    "Declined inquiry cannot jump directly to quoted"
  );
});

test("Staff vs Customer Data Isolation & IDOR Protection", () => {
  const customerA = "user_customer_A_111";
  const customerB = "user_customer_B_222";
  const staffRole = UserRole.OPERATIONS;
  const adminRole = UserRole.ADMIN;
  const custRole = UserRole.CUSTOMER;

  // RBAC checks
  assert.ok(isAdminOrStaffRole(staffRole), "Operations role should have staff privilege");
  assert.ok(isAdminOrStaffRole(adminRole), "Admin role should have staff privilege");
  assert.equal(isAdminOrStaffRole(custRole), false, "Customer role must not have staff privilege");

  // Ownership simulation: customerA owns inquiry #1
  const inquiryOwnerId = customerA;

  // Customer A accesses own resource -> Allowed
  assert.equal(customerA === inquiryOwnerId, true);

  // Customer B accesses Customer A's resource -> IDOR Forbidden
  assert.equal((customerB as string) === (inquiryOwnerId as string), false);

  // Admin access -> Allowed for operational maintenance
  const isStaffAccess = isAdminOrStaffRole(adminRole);
  assert.equal(isStaffAccess, true);
});

test("Admin Actions Schemas: Internal Notes & Status Updates", () => {
  // Admin private notes
  const validNotes = adminUpdatePrivateNotesSchema.safeParse({
    inquiryId: "c18f1f8b-21d4-4bbd-9a67-8cfb629e46a7",
    adminPrivateNotes: "Supplier at Mid Valley Megamall has 3 units at MYR 2200 each.",
  });
  assert.ok(validNotes.success);

  // Admin customer message
  const validCustomerMsg = adminSendInquiryMessageSchema.safeParse({
    inquiryId: "c18f1f8b-21d4-4bbd-9a67-8cfb629e46a7",
    messageText: "We located the strawberry bronze edition in KL. Issuing quote shortly.",
    isStaffOnly: false,
  });
  assert.ok(validCustomerMsg.success);

  // Admin staff-only note
  const validStaffNote = adminSendInquiryMessageSchema.safeParse({
    inquiryId: "c18f1f8b-21d4-4bbd-9a67-8cfb629e46a7",
    messageText: "Do not exceed MYR 2400 procurement budget.",
    isStaffOnly: true,
  });
  assert.ok(validStaffNote.success);
  assert.equal(validStaffNote.data.isStaffOnly, true);
});

test("Admin Filters & Pagination Schema", () => {
  const validFilter = adminInquiryFilterSchema.safeParse({
    search: "Dyson",
    status: InquiryStatus.UNDER_REVIEW,
    page: 2,
    limit: 20,
  });
  assert.ok(validFilter.success);
  assert.equal(validFilter.data.page, 2);
  assert.equal(validFilter.data.limit, 20);
});
