import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { assertResourceOwnership, AuthorizationError } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

/**
 * Access-controlled attachment proxy/download route.
 * Prevents unauthorized or cross-customer access to uploaded inquiry attachments.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { attachmentId } = await params;

    const attachment = await prisma.inquiryAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        inquiry: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    // IDOR Protection: asserts customer owns the inquiry or has staff privileges
    await assertResourceOwnership(attachment.inquiry.userId);

    // Return attachment details / redirect to secure fileUrl
    return NextResponse.json({
      id: attachment.id,
      inquiryId: attachment.inquiryId,
      fileName: attachment.fileName,
      fileType: attachment.fileType,
      fileSizeBytes: attachment.fileSizeBytes,
      fileUrl: attachment.fileUrl,
      createdAt: attachment.createdAt,
    });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
