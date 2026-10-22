import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { requireAdminOrStaff, isAdminOrStaffRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { formatBDT } from "@/lib/formatters";
import { AdminInquiryControls } from "@/components/admin/AdminInquiryControls";
import { InquiryStatus } from "@prisma/client";

export const metadata = {
  title: "Manage Inquiry | Operations Console",
};

const statusBadges: Record<InquiryStatus, string> = {
  SUBMITTED: "bg-blue-950/60 text-blue-300 border-blue-800",
  UNDER_REVIEW: "bg-amber-950/60 text-amber-300 border-amber-800",
  NEEDS_INFORMATION: "bg-purple-950/60 text-purple-300 border-purple-800",
  QUOTED: "bg-emerald-950/60 text-emerald-300 border-emerald-800",
  ACCEPTED: "bg-emerald-900/60 text-emerald-200 border-emerald-700",
  DECLINED: "bg-zinc-800 text-zinc-400 border-zinc-700",
  CANCELLED: "bg-rose-950/60 text-rose-300 border-rose-800",
};

export default async function AdminInquiryDetailPage({
  params,
}: {
  params: Promise<{ inquiryId: string }>;
}) {
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
          id: true,
          name: true,
          email: true,
          phone: true,
          profile: true,
        },
      },
      attachments: true,
      messages: {
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
          createdBy: { select: { name: true, email: true } },
          acceptedBy: { select: { name: true, email: true } },
        },
      },
    },
  });

  if (!inquiry) {
    notFound();
  }

  const badgeClass = statusBadges[inquiry.status] || "bg-zinc-800 text-zinc-300";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top Bar */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            href="/admin/inquiries"
            className="w-9 h-9 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg flex items-center justify-center text-zinc-300 transition"
          >
            ←
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-zinc-100 font-mono">
                {inquiry.inquiryNumber}
              </h1>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeClass}`}
              >
                {inquiry.status.replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Customer: <span className="text-zinc-200 font-semibold">{inquiry.user.name}</span> ({inquiry.user.email})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">
            Submitted: {new Date(inquiry.createdAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Product Details, Attachments, Timeline Messages */}
          <div className="lg:col-span-2 space-y-6">
            {/* Sourced Product Information */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-base font-bold text-zinc-100 mb-4">
                Requested Item Sourcing Details
              </h2>

              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-zinc-400 block text-[11px] uppercase tracking-wider font-semibold">
                    Product Title / Name
                  </span>
                  <p className="text-base font-bold text-zinc-100 mt-0.5">{inquiry.productName}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <span className="text-zinc-400 block text-[11px] uppercase tracking-wider font-semibold">
                      Brand / Model
                    </span>
                    <p className="text-zinc-200 mt-0.5 font-medium">
                      {inquiry.brandOrModel || "Not specified"}
                    </p>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[11px] uppercase tracking-wider font-semibold">
                      Quantity Requested
                    </span>
                    <p className="text-zinc-200 mt-0.5 font-bold text-sm">
                      {inquiry.quantityRequested} unit{inquiry.quantityRequested > 1 ? "s" : ""}
                    </p>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[11px] uppercase tracking-wider font-semibold">
                      Customer Target Budget
                    </span>
                    <p className="text-zinc-200 mt-0.5 font-bold text-sm">
                      {inquiry.targetBudgetBDT ? formatBDT(inquiry.targetBudgetBDT) : "None specified"}
                    </p>
                  </div>
                </div>

                {inquiry.referenceUrl && (
                  <div>
                    <span className="text-zinc-400 block text-[11px] uppercase tracking-wider font-semibold">
                      Reference URL
                    </span>
                    <a
                      href={inquiry.referenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-400 hover:text-amber-300 underline font-mono break-all mt-0.5 inline-block"
                    >
                      {inquiry.referenceUrl} ↗
                    </a>
                  </div>
                )}

                {inquiry.specifications && (
                  <div>
                    <span className="text-zinc-400 block text-[11px] uppercase tracking-wider font-semibold">
                      Customer Specifications & Notes
                    </span>
                    <div className="mt-1 p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                      {inquiry.specifications}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Attachments Section */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-base font-bold text-zinc-100 mb-3 flex items-center justify-between">
                <span>Customer Uploaded Attachments & Photos</span>
                <span className="text-xs text-zinc-400 font-mono">
                  {inquiry.attachments.length} attached
                </span>
              </h2>

              {inquiry.attachments.length === 0 ? (
                <p className="text-xs text-zinc-500 py-3 text-center border border-dashed border-zinc-800 rounded-xl">
                  No reference photos uploaded with this inquiry.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {inquiry.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="p-3 rounded-xl border border-zinc-800 bg-zinc-950 flex items-center justify-between"
                    >
                      <div className="overflow-hidden mr-2">
                        <span className="font-mono text-xs text-zinc-200 truncate block">
                          📎 {att.fileName || "Customer Image"}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {att.fileType || "image"} {att.fileSizeBytes ? `• ${Math.round(att.fileSizeBytes / 1024)} KB` : ""}
                        </span>
                      </div>
                      <a
                        href={att.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-amber-400 whitespace-nowrap"
                      >
                        Inspect ↗
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Conversation Timeline & Messages (Separated Staff vs Customer) */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-base font-bold text-zinc-100 mb-4 flex items-center justify-between">
                <span>Inquiry Communication Thread</span>
                <span className="text-xs text-zinc-400">
                  {inquiry.messages.length} message{inquiry.messages.length === 1 ? "" : "s"}
                </span>
              </h2>

              {inquiry.messages.length === 0 ? (
                <p className="text-xs text-zinc-500 py-4 text-center border border-dashed border-zinc-800 rounded-xl">
                  No communication recorded yet. Use the control panel on the right to send a customer message or staff note.
                </p>
              ) : (
                <div className="space-y-3">
                  {inquiry.messages.map((msg) => {
                    const isStaff = msg.sender.role !== "CUSTOMER";

                    return (
                      <div
                        key={msg.id}
                        className={`p-4 rounded-xl text-xs border ${
                          msg.isStaffOnly
                            ? "bg-rose-950/20 border-rose-900/40 text-rose-200"
                            : isStaff
                            ? "bg-amber-950/20 border-amber-900/40 text-amber-200"
                            : "bg-zinc-950 border-zinc-800 text-zinc-300"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-100">
                              {msg.sender.name}
                            </span>
                            <span className="text-[10px] text-zinc-400">({msg.sender.role})</span>
                            {msg.isStaffOnly ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-900/80 text-rose-200 uppercase">
                                🔒 Internal Staff Only
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-900/80 text-emerald-200 uppercase">
                                👁️ Visible to Customer
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-zinc-500">
                            {new Date(msg.createdAt).toLocaleTimeString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.messageText}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Issued Quotations (Explicit Admin Control) */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-zinc-100">Issued Quotations</h2>
                  <p className="text-xs text-zinc-400">
                    Quotes require explicit admin action and verification.
                  </p>
                </div>
              </div>

              {inquiry.quotes.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-zinc-800 text-center text-xs text-zinc-500">
                  No quotation created yet for this inquiry.
                </div>
              ) : (
                <div className="space-y-4">
                  {inquiry.quotes.map((q) => (
                    <div
                      key={q.id}
                      className="p-4 rounded-xl border border-emerald-900/60 bg-emerald-950/10 text-xs"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                        <div>
                          <span className="font-mono font-bold text-emerald-400">
                            {q.quoteNumber} (v{q.version})
                          </span>
                          <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-800 text-zinc-300">
                            {q.status}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-bold text-emerald-400">
                            {formatBDT(q.totalAmountBDT)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 text-zinc-400 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                        <div>Subtotal: {formatBDT(q.itemsSubtotalBDT)}</div>
                        <div>Shipping: {formatBDT(q.shippingFeeBDT)}</div>
                        <div>Service Fee: {formatBDT(q.serviceFeeBDT)}</div>
                        <div>Customs: {formatBDT(q.customsFeeBDT)}</div>
                      </div>

                      {q.estCostMYR && (
                        <div className="mt-2 p-2 rounded bg-zinc-950/60 border border-zinc-800/80 text-[11px] text-amber-300">
                          🔒 Internal Cost: {q.estCostMYR.toString()} MYR (Rate: {q.estExchangeRate?.toString()} BDT/MYR)
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Status Transitions, Internal Notes & Actions */}
          <div className="space-y-6">
            {/* Customer Snapshot */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-xs text-zinc-300">
              <h3 className="font-bold text-sm text-zinc-100 mb-3">Customer Profile</h3>
              <div className="space-y-2">
                <div>
                  <span className="text-zinc-500 text-[11px] block">Full Name:</span>
                  <span className="font-semibold text-zinc-100">{inquiry.user.name}</span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[11px] block">Email:</span>
                  <span className="font-mono text-zinc-200">{inquiry.user.email}</span>
                </div>
                {inquiry.user.phone && (
                  <div>
                    <span className="text-zinc-500 text-[11px] block">Phone:</span>
                    <span className="font-mono text-zinc-200">{inquiry.user.phone}</span>
                  </div>
                )}
                {inquiry.user.profile?.division && (
                  <div>
                    <span className="text-zinc-500 text-[11px] block">Location:</span>
                    <span className="text-zinc-200">
                      {inquiry.user.profile.district}, {inquiry.user.profile.division}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Admin Interactive Controls (Status, Notes, Reply) */}
            <AdminInquiryControls
              inquiryId={inquiry.id}
              currentStatus={inquiry.status}
              initialPrivateNotes={inquiry.adminPrivateNotes || ""}
              customerName={inquiry.user.name}
            />

            {/* Status History Timeline */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-xs text-zinc-300">
              <h3 className="font-bold text-sm text-zinc-100 mb-3">
                Audit & Status History ({inquiry.statusHistory.length})
              </h3>

              <div className="relative pl-4 space-y-4 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-800">
                {inquiry.statusHistory.map((hist) => (
                  <div key={hist.id} className="relative">
                    <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-4 ring-zinc-900" />
                    <div>
                      <span className="font-bold text-zinc-200">
                        {hist.toStatus}
                      </span>
                      {hist.fromStatus && (
                        <span className="text-zinc-500 text-[10px] ml-1">
                          (from {hist.fromStatus})
                        </span>
                      )}
                      <span className="block text-[10px] text-zinc-500">
                        {new Date(hist.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {hist.reason && (
                        <p className="mt-0.5 text-zinc-400 text-[11px]">{hist.reason}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
