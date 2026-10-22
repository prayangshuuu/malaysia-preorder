import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { assertResourceOwnership, AuthorizationError } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { formatBDT } from "@/lib/formatters";
import { InquiryReplyBox } from "@/components/inquiries/InquiryReplyBox";
import { InquiryStatus } from "@prisma/client";

export const metadata = {
  title: "Inquiry Details | Malaysia Pre-Order",
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
    label: "Quote Issued",
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

export default async function CustomerInquiryDetailPage({
  params,
}: {
  params: Promise<{ inquiryId: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }

  const { inquiryId } = await params;

  const inquiry = await prisma.productInquiry.findUnique({
    where: { id: inquiryId },
    include: {
      attachments: true,
      messages: {
        where: { isStaffOnly: false }, // Security: Never expose staff-only messages to customer
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
        orderBy: { createdAt: "asc" },
      },
      quotes: {
        orderBy: { version: "desc" },
        include: {
          lineItems: true,
        },
      },
      product: {
        select: {
          id: true,
          title: true,
          slug: true,
          images: { take: 1, select: { imageUrl: true } },
        },
      },
    },
  });

  if (!inquiry) {
    notFound();
  }

  // IDOR Protection: enforce customer ownership
  try {
    await assertResourceOwnership(inquiry.userId);
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      redirect("/unauthorized");
    }
    throw err;
  }

  const badge = statusBadges[inquiry.status] || {
    label: inquiry.status,
    className: "bg-zinc-100 text-zinc-700 border-zinc-200",
  };

  const isClosed = inquiry.status === InquiryStatus.CANCELLED || inquiry.status === InquiryStatus.DECLINED;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-zinc-200 dark:border-zinc-800 gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
            <Link href="/account" className="hover:text-zinc-900 dark:hover:text-zinc-100">
              Account
            </Link>
            <span>/</span>
            <Link href="/account/inquiries" className="hover:text-zinc-900 dark:hover:text-zinc-100">
              Product Requests
            </Link>
            <span>/</span>
            <span className="text-zinc-900 dark:text-zinc-100 font-medium">{inquiry.inquiryNumber}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {inquiry.productName}
            </h1>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.className}`}
            >
              {badge.label}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Inquiry Ref: <span className="font-mono">{inquiry.inquiryNumber}</span> • Submitted on{" "}
            {new Date(inquiry.createdAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        <Link
          href="/account/inquiries"
          className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Back to All Inquiries
        </Link>
      </div>

      {/* Main Content Grid */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Details & Quotes & Messages */}
        <div className="lg:col-span-2 space-y-6">
          {/* Action Callout if Needs Information */}
          {inquiry.status === InquiryStatus.NEEDS_INFORMATION && (
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 text-xs text-purple-900 dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-300">
              <strong className="font-bold text-sm block mb-1">Action Required: More Information Requested</strong>
              Our Kuala Lumpur sourcing team has requested additional details to verify availability or pricing. Please review staff messages below and submit your reply.
            </div>
          )}

          {/* Quotations Section */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center justify-between">
              <span>Official Quotations</span>
              <span className="text-xs font-normal text-zinc-500">
                {inquiry.quotes.length} version{inquiry.quotes.length === 1 ? "" : "s"}
              </span>
            </h2>

            {inquiry.quotes.length === 0 ? (
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950/50 p-4 text-xs text-zinc-500 text-center border border-dashed border-zinc-200 dark:border-zinc-800">
                No quote issued yet. Our team in Kuala Lumpur is reviewing supplier costs and air freight. You will receive an official guaranteed quotation here.
              </div>
            ) : (
              <div className="space-y-4">
                {inquiry.quotes.map((q) => (
                  <div
                    key={q.id}
                    className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20 p-5"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-emerald-100 dark:border-emerald-900/40">
                      <div>
                        <span className="font-mono text-xs font-bold text-emerald-900 dark:text-emerald-300">
                          {q.quoteNumber} (v{q.version})
                        </span>
                        <span className="ml-2 inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-200 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                          {q.status}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-zinc-500 block">Total Guaranteed BDT</span>
                        <span className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100">
                          {formatBDT(q.totalAmountBDT)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                      <div>
                        <span className="text-[11px] text-zinc-400 block">Items Subtotal:</span>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">{formatBDT(q.itemsSubtotalBDT)}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-zinc-400 block">Shipping / Air Cargo:</span>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">{formatBDT(q.shippingFeeBDT)}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-zinc-400 block">Service & Handling:</span>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">{formatBDT(q.serviceFeeBDT)}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-zinc-400 block">Customs & Clearance:</span>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">{formatBDT(q.customsFeeBDT)}</span>
                      </div>
                    </div>

                    {q.validUntil && (
                      <p className="mt-3 text-[11px] text-amber-700 dark:text-amber-400">
                        ⏳ Quote validity deadline: {new Date(q.validUntil).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    )}

                    {q.customerNotes && (
                      <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 bg-white/60 dark:bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                        <strong className="text-zinc-700 dark:text-zinc-300">Quote Terms: </strong>
                        {q.customerNotes}
                      </p>
                    )}

                    {/* Order Placement CTA for valid quotes */}
                    {(q.status === "SENT" || q.status === "ACCEPTED") && (
                      <div className="mt-4 pt-3 border-t border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between">
                        <span className="text-[11px] text-zinc-500">
                          {q.status === "ACCEPTED" ? "Quote accepted. Proceed to checkout." : "Ready to place pre-order with this guaranteed price?"}
                        </span>
                        <Link
                          href={`/checkout?quoteId=${q.id}`}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm"
                        >
                          Accept & Confirm Pre-Order →
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Conversation / Staff Responses */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              Messages & Staff Responses ({inquiry.messages.length})
            </h2>

            {inquiry.messages.length === 0 ? (
              <p className="text-xs text-zinc-500 py-3 text-center">
                No messages yet. Our team will update this thread as your request progresses.
              </p>
            ) : (
              <div className="space-y-4">
                {inquiry.messages.map((msg) => {
                  const isStaff = msg.sender.role !== "CUSTOMER";
                  return (
                    <div
                      key={msg.id}
                      className={`p-4 rounded-xl text-xs border ${
                        isStaff
                          ? "bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/40"
                          : "bg-zinc-50 border-zinc-200 dark:bg-zinc-800/50 dark:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-900 dark:text-zinc-100">
                            {isStaff ? "🇲🇾 Sourcing Specialist" : msg.sender.name}
                          </span>
                          {isStaff && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                              Operations Staff
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-zinc-400">
                          {new Date(msg.createdAt).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </div>
                      <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                        {msg.messageText}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Customer Reply Box */}
            <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">
              <InquiryReplyBox inquiryId={inquiry.id} isClosed={isClosed} />
            </div>
          </div>
        </div>

        {/* Right Column: Sourcing Specs, Attachments, Status History */}
        <div className="space-y-6">
          {/* Sourcing Specifications Card */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm text-xs">
            <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 mb-3">
              Request Specifications
            </h3>

            <div className="space-y-3">
              <div>
                <span className="text-zinc-400 block text-[11px]">Requested Product</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {inquiry.productName}
                </span>
              </div>

              {inquiry.referenceUrl && (
                <div>
                  <span className="text-zinc-400 block text-[11px]">Reference Web Link</span>
                  <a
                    href={inquiry.referenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 dark:text-emerald-400 underline font-mono break-all"
                  >
                    {inquiry.referenceUrl}
                  </a>
                </div>
              )}

              {inquiry.brandOrModel && (
                <div>
                  <span className="text-zinc-400 block text-[11px]">Brand / Model</span>
                  <span className="text-zinc-800 dark:text-zinc-200">{inquiry.brandOrModel}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-zinc-400 block text-[11px]">Quantity</span>
                  <span className="text-zinc-800 dark:text-zinc-200 font-bold">
                    {inquiry.quantityRequested} unit{inquiry.quantityRequested > 1 ? "s" : ""}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[11px]">Target Budget</span>
                  <span className="text-zinc-800 dark:text-zinc-200 font-bold">
                    {inquiry.targetBudgetBDT ? formatBDT(inquiry.targetBudgetBDT) : "Not specified"}
                  </span>
                </div>
              </div>

              {inquiry.specifications && (
                <div>
                  <span className="text-zinc-400 block text-[11px]">Customer Notes & Options</span>
                  <p className="mt-1 p-2 rounded bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                    {inquiry.specifications}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Attachments Card */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm text-xs">
            <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 mb-3">
              Attachments & Photos ({inquiry.attachments.length})
            </h3>

            {inquiry.attachments.length === 0 ? (
              <p className="text-zinc-400">No image attachments provided.</p>
            ) : (
              <div className="space-y-2">
                {inquiry.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-center justify-between"
                  >
                    <span className="truncate max-w-[180px] font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                      📎 {att.fileName || "Attachment"}
                    </span>
                    <a
                      href={att.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-semibold text-emerald-600 hover:text-emerald-700"
                    >
                      View ↗
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Timestamped Status History Card */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm text-xs">
            <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 mb-3">
              Status History Timeline
            </h3>

            <div className="relative pl-4 space-y-4 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-200 dark:before:bg-zinc-800">
              {inquiry.statusHistory.map((hist) => (
                <div key={hist.id} className="relative">
                  <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-zinc-900" />
                  <div>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">
                      {hist.toStatus}
                    </span>
                    <span className="block text-[10px] text-zinc-400">
                      {new Date(hist.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {hist.reason && (
                      <p className="mt-0.5 text-zinc-500 text-[11px]">{hist.reason}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
