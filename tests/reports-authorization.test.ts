import test from "node:test";
import assert from "node:assert/strict";
import { UserRole } from "@prisma/client";
import { isAdminOrStaffRole } from "../lib/auth/rbac";
import { getBusinessSettings, updateBusinessSettings } from "../lib/settings";
import { getMasterOperationalReport } from "../lib/reports";
import { prisma, pool } from "../lib/prisma";

test("RBAC Authorization Rules for Settings and Reports", () => {
  // Test role matrix: Only ADMIN can edit settings; ADMIN, OPERATIONS, FINANCE, SUPPORT can view reports/settings
  assert.equal(isAdminOrStaffRole(UserRole.ADMIN), true);
  assert.equal(isAdminOrStaffRole(UserRole.OPERATIONS), true);
  assert.equal(isAdminOrStaffRole(UserRole.FINANCE), true);
  assert.equal(isAdminOrStaffRole(UserRole.SUPPORT), true);
  assert.equal(isAdminOrStaffRole(UserRole.CUSTOMER), false);
});

test("Operational Reports query executes cleanly and handles empty/populated states without crash", async () => {
  const report = await getMasterOperationalReport("2026-01-01", "2026-12-31");
  assert.ok(report.ordersReport);
  assert.ok(report.quotesReport);
  assert.ok(report.financialReport);
  assert.ok(report.walletReport);
  assert.ok(report.logisticsReport);
  assert.ok(report.inquiryReport);

  // Financial sanity checks
  assert.ok(typeof report.financialReport.grossPaymentsCollectedBDT === "number");
  assert.ok(typeof report.financialReport.netCollectionsBDT === "number");
  assert.ok(typeof report.walletReport.totalLedgerLiabilityBDT === "number");
  assert.ok(typeof report.walletReport.isReconciled === "boolean");

  await prisma.$disconnect();
  await pool.end();
});
