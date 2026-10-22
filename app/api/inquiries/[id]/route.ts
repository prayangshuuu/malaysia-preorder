import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { assertResourceOwnership, AuthorizationError } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/inquiries/[id]
 *
 * Retrieves an inquiry by ID only after verifying the requesting user owns it
 * or has staff/admin privileges (IDOR protection).
 *
 * Confidentiality rules:
 * - Customers CANNOT see `adminPrivateNotes`.
 * - Customers CANNOT see `isStaffOnly: true` messages.
 * - Sourcing costs & private supplier details are omitted.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const isStaff =
      session.role === "ADMIN" ||
      session.role === "OPERATIONS" ||
      session.role === "FINANCE" ||
      session.role === "SUPPORT";

    const inquiry = await prisma.productInquiry.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        attachments: {
          select: {
            id: true,
            fileUrl: true,
            fileName: true,
            fileType: true,
            fileSizeBytes: true,
            createdAt: true,
          },
        },
        messages: {
          where: isStaff ? {} : { isStaffOnly: false },
          orderBy: { createdAt: "asc" },
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
        },
        statusHistory: {
          orderBy: { createdAt: "desc" },
        },
        quotes: {
          select: {
            id: true,
            quoteNumber: true,
            version: true,
            status: true,
            totalAmountBDT: true,
            validUntil: true,
            itemsSubtotalBDT: true,
            shippingFeeBDT: true,
            serviceFeeBDT: true,
            createdAt: true,
          },
          orderBy: { version: "desc" },
        },
      },
    });

    if (!inquiry) {
      return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
    }

    // IDOR Protection: asserts customer owns the resource or has staff privileges
    await assertResourceOwnership(inquiry.userId);

    // Filter out private staff notes if customer is viewing
    const sanitizedInquiry = {
      ...inquiry,
      adminPrivateNotes: isStaff ? inquiry.adminPrivateNotes : undefined,
    };

    return NextResponse.json({ inquiry: sanitizedInquiry }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
