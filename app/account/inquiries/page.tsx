import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatBDT } from "@/lib/formatters";
import { InquiryStatus } from "@prisma/client";

export const metadata = {
  title: "My Product Inquiries | Malaysia Pre-Order",
};

const statusBadges: Record<InquiryStatus, { label: string; className: string }> = {
  SUBMITTED: {
    label: "Submitted",
    className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900/50",
  },
  UNDER_REVIEW: {
    label: "Under Review",
    className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900/50",
  },
  NEEDS_INFORMATION: {
    label: "Needs Information",
    className: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-900/50",
  },
  QUOTED: {
    label: "Quote Available",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900/50 font-bold",
  },
  ACCEPTED: {
    label: "Quote Accepted",
    className: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-200",
  },
  DECLINED: {
    label: "Declined",
    className: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  },
  CANCELLED: {
    label: "Cancelled",
    className: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900/50",
  },
};

export default async function CustomerInquiriesListPage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?redirect=/account/inquiries");
  }

  const inquiries = await prisma.productInquiry.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    include: {
      quotes: {
        where: { status: { in: ["SENT", "ACCEPTED"] } },
        orderBy: { version: "desc" },
        take: 1,
        select: {
          id: true,
          quoteNumber: true,
          totalAmountBDT: true,
          status: true,
          validUntil: true,
        },
      },
      _count: {
        select: {
          messages: {
            where: { isStaffOnly: false },
          },
          attachments: true,
        },
      },
    },
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
            <Link href="/account" className="hover:text-zinc-900 dark:hover:text-zinc-100">
              Account
            </Link>
            <span>/</span>
            <span className="text-zinc-900 dark:text-zinc-100 font-medium">Product Inquiries</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            My Product Requests
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Track inquiries submitted for custom sourcing from Malaysian stores.
          </p>
        </div>

        <Link
          href="/inquire"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm transition"
        >
          + New Product Request
        </Link>
      </div>

      {/* Inquiry List */}
      <div className="mt-8 space-y-4">
        {inquiries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 p-12 text-center">
            <div className="text-3xl mb-3">🛍️</div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              No inquiries submitted yet
            </h3>
            <p className="mt-1 text-xs text-zinc-500 max-w-sm mx-auto">
              Want an item from Shopee Malaysia, Lazada MY, or a retail store in Kuala Lumpur? Submit your request and our local buyers will inspect availability and calculate guaranteed landing costs.
            </p>
            <div className="mt-6">
              <Link
                href="/inquire"
                className="inline-flex items-center px-4 py-2 rounded-lg bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 transition"
              >
                Submit First Request
              </Link>
            </div>
          </div>
        ) : (
          inquiries.map((inq) => {
            const badge = statusBadges[inq.status] || {
              label: inq.status,
              className: "bg-zinc-100 text-zinc-700 border-zinc-200",
            };

            const latestQuote = inq.quotes[0];
            const hasQuote = Boolean(latestQuote);

            return (
              <div
                key={inq.id}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {inq.inquiryNumber}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    {inq.status === "NEEDS_INFORMATION" && (
                      <span className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold animate-pulse">
                        ● Action Required
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-zinc-400">
                    Submitted: {new Date(inq.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>

                <div className="py-3">
                  <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {inq.productName}
                  </h2>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                    {inq.brandOrModel && (
                      <span>Model: <strong className="text-zinc-700 dark:text-zinc-300">{inq.brandOrModel}</strong></span>
                    )}
                    <span>Qty: <strong className="text-zinc-700 dark:text-zinc-300">{inq.quantityRequested}</strong></span>
                    {inq.targetBudgetBDT && (
                      <span>Target: <strong className="text-zinc-700 dark:text-zinc-300">{formatBDT(inq.targetBudgetBDT)}</strong></span>
                    )}
                  </div>
                </div>

                {/* Footer with Quote availability and View Details link */}
                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs">
                    {hasQuote ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                        <span>🏷️ Official Quote Issued:</span>
                        <strong className="text-sm font-extrabold">{formatBDT(latestQuote.totalAmountBDT)}</strong>
                        <span className="text-[11px] text-zinc-500">({latestQuote.status})</span>
                      </span>
                    ) : (
                      <span className="text-zinc-500">
                        {inq.status === "SUBMITTED"
                          ? "Awaiting inspection by Kuala Lumpur procurement team"
                          : inq.status === "UNDER_REVIEW"
                          ? "Procurement team verifying wholesale pricing & availability"
                          : "No quote issued yet"}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {inq._count.messages > 0 && (
                      <span className="text-xs text-zinc-500">
                        💬 {inq._count.messages} message{inq._count.messages > 1 ? "s" : ""}
                      </span>
                    )}
                    <Link
                      href={`/account/inquiries/${inq.id}`}
                      className="px-3.5 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition"
                    >
                      View Details & Reply →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
