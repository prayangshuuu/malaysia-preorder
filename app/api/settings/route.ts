import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { requireAdminOrStaff, requireSuperAdmin, AuthorizationError } from "@/lib/auth/rbac";
import {
  getBusinessSettings,
  updateBusinessSettings,
  SettingsServiceError,
} from "@/lib/settings";

/**
 * GET /api/settings
 * Read current business settings. Authorized staff/admin only.
 */
export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireAdminOrStaff();

    const settings = await getBusinessSettings();
    return NextResponse.json({ settings });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[API GET /api/settings] Error:", err);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

/**
 * PUT /api/settings
 * Update business settings. Strict SUPERADMIN role required.
 * Generates audit log on changes.
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only authorized ADMIN role can change business configurations
    await requireSuperAdmin();

    const body = await request.json();
    const ipAddress = request.headers.get("x-forwarded-for") || null;
    const userAgent = request.headers.get("user-agent") || null;

    const updated = await updateBusinessSettings(
      body,
      {
        id: session.userId,
        email: session.email,
        role: session.role,
      },
      { ipAddress, userAgent }
    );

    return NextResponse.json({
      success: true,
      message: "Business settings updated and audited successfully",
      settings: updated,
    });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof SettingsServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[API PUT /api/settings] Error:", err);
    return NextResponse.json({ error: "Failed to update business settings" }, { status: 500 });
  }
}
