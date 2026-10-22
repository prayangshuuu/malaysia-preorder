import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { requireAdminOrStaff, isAdminOrStaffRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { formatBDT } from "@/lib/formatters";
import { InquiryStatus, Prisma } from "@prisma/client";

export const metadata = {
  title: "Inquiries Management | Operations Console",
};

const statusFilterBadges: Record<InquiryStatus, string> = {
  SUBMITTED: "bg-blue-950/60 text-blue-300 border-blue-800",
  UNDER_REVIEW: "bg-amber-950/60 text-amber-300 border-amber-800",
  NEEDS_INFORMATION: "bg-purple-950/60 text-purple-300 border-purple-800",
  QUOTED: "bg-emerald-950/60 text-emerald-300 border-emerald-800",
  ACCEPTED: "bg-emerald-900/60 text-emerald-200 border-emerald-700",
  DECLINED: "bg-zinc-800 text-zinc-400 border-zinc-700",
  CANCELLED: "bg-rose-950/60 text-rose-300 border-rose-800",
};

export default async function AdminInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const session = await getCurrentSession();
  if (!session || !isAdminOrStaffRole(session.role)) {
    redirect("/admin/login");
  }

  await requireAdminOrStaff();

  const params = await searchParams;
  const search = params.search?.trim();
  const statusParam = params.status as InquiryStatus | undefined;
  const page = parseInt(params.page || "1", 10) || 1;
  const pageSize = 15;

  // Build Prisma Where Clause
  const where: Prisma.ProductInquiryWhereInput = {};

  if (statusParam && Object.values(InquiryStatus).includes(statusParam)) {
    where.status = statusParam;
  }

  if (search) {
    where.OR = [
      { inquiryNumber: { contains: search, mode: "insensitive" } },
      { productName: { contains: search, mode: "insensitive" } },
      { brandOrModel: { contains: search, mode: "insensitive" } },
      { user: { name: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  // Count total and fetch items
  const [totalCount, inquiries, statusCounts] = await Promise.all([
    prisma.productInquiry.count({ where }),
    prisma.productInquiry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        quotes: {
          orderBy: { version: "desc" },
          take: 1,
          select: {
            id: true,
            quoteNumber: true,
            status: true,
            totalAmountBDT: true,
          },
        },
        _count: {
          select: {
            messages: true,
            attachments: true,
          },
        },
      },
    }),
    prisma.productInquiry.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  // Build quick map of counts
  const countByStatus: Partial<Record<InquiryStatus, number>> = {};
  for (const item of statusCounts) {
    countByStatus[item.status] = item._count._all;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            href="/admin"
            className="w-9 h-9 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-center text-amber-500 font-bold text-sm hover:bg-amber-500/20 transition"
          >
            ←
          </Link>
          <div>
            <h1 className="text-base font-semibold text-zinc-100">
              Customer Product Inquiries
            </h1>
            <p className="text-xs text-zinc-400">
              Review custom requests, inspect sourcing in KL, and issue verified quotations.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">
            Total Inquiries: <strong className="text-zinc-100">{totalCount}</strong>
          </span>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Search & Filter Bar */}
        <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <form method="GET" className="flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex-1 w-full md:w-auto flex gap-2">
              <input
                type="text"
                name="search"
                defaultValue={search || ""}
                placeholder="Search by inquiry #, product, brand, customer name or email..."
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
              />
              {statusParam && <input type="hidden" name="status" value={statusParam} />}
              <button
                type="submit"
                className="rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition"
              >
                Search
              </button>
            </div>

            {/* Clear filters if active */}
            {(search || statusParam) && (
              <Link
                href="/admin/inquiries"
                className="text-xs text-amber-400 hover:text-amber-300 font-medium"
              >
                Clear Filters
              </Link>
            )}
          </form>

          {/* Status Pills */}
          <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-zinc-800/80">
            <Link
              href={search ? `/admin/inquiries?search=${encodeURIComponent(search)}` : "/admin/inquiries"}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                !statusParam
                  ? "bg-amber-500 text-zinc-950 border-amber-400 font-bold"
                  : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200"
              }`}
            >
              All Inquiries
            </Link>

            {Object.values(InquiryStatus).map((st) => {
              const isSelected = statusParam === st;
              const count = countByStatus[st] || 0;
              return (
                <Link
                  key={st}
                  href={`/admin/inquiries?status=${st}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                    isSelected
                      ? "bg-amber-500 text-zinc-950 border-amber-400 font-bold"
                      : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200"
                  }`}
                >
                  {st.replace(/_/g, " ")} ({count})
                </Link>
              );
            })}
          </div>
        </div>

        {/* Table of Inquiries */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/80 text-zinc-400 border-b border-zinc-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Inquiry Ref</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Product Details</th>
                  <th className="py-3 px-4">Quantity / Budget</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Quote</th>
                  <th className="py-3 px-4">Submitted</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 text-zinc-300">
                {inquiries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-zinc-500">
                      No customer product inquiries found matching your filter criteria.
                    </td>
                  </tr>
                ) : (
                  inquiries.map((inq) => {
                    const badgeClass = statusFilterBadges[inq.status] || "bg-zinc-800 text-zinc-300";
                    const latestQuote = inq.quotes[0];

                    return (
                      <tr key={inq.id} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-amber-400">
                          {inq.inquiryNumber}
                          {inq._count.attachments > 0 && (
                            <span className="ml-1 text-[10px] text-zinc-400 font-sans">
                              📎 {inq._count.attachments}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-zinc-100">{inq.user.name}</div>
                          <div className="text-[11px] text-zinc-400">{inq.user.email}</div>
                          {inq.user.phone && (
                            <div className="text-[10px] text-zinc-500">{inq.user.phone}</div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="font-medium text-zinc-100 truncate">
                            {inq.productName}
                          </div>
                          {inq.brandOrModel && (
                            <div className="text-[11px] text-zinc-400 truncate">
                              Model: {inq.brandOrModel}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div>
                            Qty: <strong className="text-zinc-100">{inq.quantityRequested}</strong>
                          </div>
                          {inq.targetBudgetBDT && (
                            <div className="text-[11px] text-zinc-400">
                              Target: {formatBDT(inq.targetBudgetBDT)}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeClass}`}
                          >
                            {inq.status.replace(/_/g, " ")}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {latestQuote ? (
                            <div>
                              <span className="font-semibold text-emerald-400">
                                {formatBDT(latestQuote.totalAmountBDT)}
                              </span>
                              <span className="block text-[10px] text-zinc-400">
                                {latestQuote.quoteNumber} ({latestQuote.status})
                              </span>
                            </div>
                          ) : (
                            <span className="text-zinc-500 text-[11px]">No Quote</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap text-zinc-400 text-[11px]">
                          {new Date(inq.createdAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <Link
                            href={`/admin/inquiries/${inq.id}`}
                            className="inline-block px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 hover:text-white transition"
                          >
                            Manage →
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
              <div>
                Page {page} of {totalPages} ({totalCount} items)
              </div>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`/admin/inquiries?page=${page - 1}${statusParam ? `&status=${statusParam}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
                    className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                  >
                    Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/admin/inquiries?page=${page + 1}${statusParam ? `&status=${statusParam}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
                    className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                  >
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
