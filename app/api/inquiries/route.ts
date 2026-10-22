import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { assertResourceOwnership, requireAuth, AuthorizationError } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/inquiries
 * Retrieves current customer's inquiries, or staff can list inquiries.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const searchParams = request.nextUrl.searchParams;
    const isStaff =
      session.role === "ADMIN" ||
      session.role === "OPERATIONS" ||
      session.role === "FINANCE" ||
      session.role === "SUPPORT";

    // If staff requests all or filtered
    const whereClause = isStaff && searchParams.get("all") === "true"
      ? {}
      : { userId: session.userId };

    const inquiries = await prisma.productInquiry.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            attachments: true,
            messages: true,
            quotes: true,
          },
        },
        quotes: {
          select: {
            id: true,
            quoteNumber: true,
            version: true,
            status: true,
            totalAmountBDT: true,
            validUntil: true,
          },
          orderBy: { version: "desc" },
        },
      },
    });

    return NextResponse.json({ inquiries }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
