import { redirect, notFound } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { requireAdminOrStaff, isAdminOrStaffRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { AdminQuoteForm } from "@/components/admin/AdminQuoteForm";
import Link from "next/link";

interface PageProps {
  params: Promise<{ inquiryId: string }>;
}

export default async function AdminInquiryQuotePage({ params }: PageProps) {
  const session = await getCurrentSession();
  if (!session || !isAdminOrStaffRole(session.role)) {
    redirect("/admin/login");
  }

  await requireAdminOrStaff();

  const { inquiryId } = await params;

  const inquiry = await prisma.productInquiry.findUnique({
    where: { id: inquiryId },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
        },
      },
      quotes: {
        orderBy: { version: "desc" },
        select: {
          id: true,
          quoteNumber: true,
          version: true,
          status: true,
          totalAmountBDT: true,
          createdAt: true,
        },
      },
      attachments: true,
    },
  });

  if (!inquiry) {
    notFound();
  }

  const clientInquiry = {
    id: inquiry.id,
    inquiryNumber: inquiry.inquiryNumber,
    productName: inquiry.productName,
    brandOrModel: inquiry.brandOrModel,
    referenceUrl: inquiry.referenceUrl,
    quantityRequested: inquiry.quantityRequested,
    targetBudgetBDT: inquiry.targetBudgetBDT ? Number(inquiry.targetBudgetBDT) : null,
    user: inquiry.user,
    quotes: inquiry.quotes.map((q) => ({
      id: q.id,
      quoteNumber: q.quoteNumber,
      version: q.version,
      status: q.status,
      totalAmountBDT: Number(q.totalAmountBDT),
      createdAt: q.createdAt.toISOString(),
    })),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/admin/inquiries/${inquiry.id}`}
          className="text-xs text-zinc-400 hover:text-amber-400 transition-colors flex items-center gap-1.5"
        >
          ← Back to Inquiry Details
        </Link>

        <span className="text-xs font-mono px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
          Inquiry: <span className="text-amber-400 font-bold">{inquiry.inquiryNumber}</span>
        </span>
      </div>

      <AdminQuoteForm inquiry={clientInquiry} />
    </div>
  );
}
