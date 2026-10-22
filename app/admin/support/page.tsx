import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { isAdminOrStaffRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { SupportTicketStatus } from "@prisma/client";
import { getEmailProviderConfig } from "@/lib/notifications";

export const metadata = {
  title: "Support Tickets & Inquiries | Admin Console",
};

interface AdminSupportPageProps {
  searchParams: Promise<{
    status?: string;
    page?: string;
    q?: string;
  }>;
}

export default async function AdminSupportPage({ searchParams }: AdminSupportPageProps) {
  const session = await getCurrentSession();
  if (!session || !isAdminOrStaffRole(session.role)) {
    redirect("/admin/login");
  }

  const { status: statusFilter, page: pageParam, q } = await searchParams;
  const page = parseInt(pageParam || "1", 10) || 1;
  const pageSize = 15;

  const whereClause: {
    status?: SupportTicketStatus;
    OR?: Array<{
      ticketNumber?: { contains: string; mode: "insensitive" };
      customerEmail?: { contains: string; mode: "insensitive" };
      customerName?: { contains: string; mode: "insensitive" };
      subject?: { contains: string; mode: "insensitive" };
    }>;
  } = {};

  if (statusFilter && Object.values(SupportTicketStatus).includes(statusFilter as SupportTicketStatus)) {
    whereClause.status = statusFilter as SupportTicketStatus;
  }

  if (q && q.trim().length > 0) {
    const query = q.trim();
    whereClause.OR = [
      { ticketNumber: { contains: query, mode: "insensitive" } },
      { customerEmail: { contains: query, mode: "insensitive" } },
      { customerName: { contains: query, mode: "insensitive" } },
      { subject: { contains: query, mode: "insensitive" } },
    ];
  }

  const [tickets, totalCount, statusCounts] = await Promise.all([
    prisma.supportTicket.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: {
          select: { messages: true },
        },
      },
    }),
    prisma.supportTicket.count({ where: whereClause }),
    prisma.supportTicket.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);
  const emailConfig = getEmailProviderConfig();

  const countByStatus = statusCounts.reduce(
    (acc, item) => {
      acc[item.status] = item._count._all;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <AdminHeader currentPath="/admin/support" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Header bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-zinc-800 gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Support & Helpdesk</h1>
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                {totalCount} Tickets
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Customer communications, inquiry troubleshooting, and staff notes.
            </p>
          </div>

          <div className="text-xs text-right">
            <span className="px-2.5 py-1 rounded border border-zinc-800 bg-zinc-900 text-zinc-400 font-mono">
              Outgoing Email: {emailConfig.isConfigured ? "SMTP Configured" : "Disabled (In-App Only)"}
            </span>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2 mb-6 text-xs">
          <Link
            href="/admin/support"
            className={`px-3 py-1.5 rounded-lg border transition ${
              !statusFilter
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400 font-semibold"
                : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            All Tickets ({Object.values(countByStatus).reduce((a, b) => a + b, 0)})
          </Link>
          {Object.values(SupportTicketStatus).map((st) => (
            <Link
              key={st}
              href={`/admin/support?status=${st}`}
              className={`px-3 py-1.5 rounded-lg border transition ${
                statusFilter === st
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400 font-semibold"
                  : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {st} ({countByStatus[st] || 0})
            </Link>
          ))}
        </div>

        {/* Tickets Table */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/90 text-zinc-400 border-b border-zinc-800 uppercase font-mono tracking-wider">
                <tr>
                  <th className="py-3 px-4">Ticket</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Messages</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-zinc-500 text-sm">
                      No support tickets found matching criteria.
                    </td>
                  </tr>
                ) : (
                  tickets.map((t) => {
                    const statusColor =
                      t.status === "OPEN"
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        : t.status === "IN_PROGRESS"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : t.status === "RESOLVED"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-zinc-800 text-zinc-400 border-zinc-700";

                    return (
                      <tr key={t.id} className="hover:bg-zinc-800/40 transition">
                        <td className="py-3.5 px-4 font-mono font-medium text-amber-400">
                          {t.ticketNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-zinc-200">{t.customerName}</div>
                          <div className="text-zinc-500 text-[11px] font-mono">{t.customerEmail}</div>
                          {t.customerPhone && (
                            <div className="text-zinc-500 text-[11px]">{t.customerPhone}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-zinc-300 max-w-xs truncate font-medium">
                          {t.subject}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border ${statusColor}`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-zinc-400 font-mono">
                          {t._count.messages}
                        </td>
                        <td className="py-3.5 px-4 text-zinc-400">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            href={`/admin/support/${t.id}`}
                            className="inline-flex px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-200 hover:text-amber-400 hover:border-zinc-600 transition"
                          >
                            View & Reply
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-zinc-800 text-xs">
              <Link
                href={`/admin/support?page=${Math.max(1, page - 1)}${statusFilter ? `&status=${statusFilter}` : ""}`}
                className={`px-3 py-1.5 rounded-lg border border-zinc-700 ${
                  page <= 1 ? "opacity-30 pointer-events-none" : "hover:bg-zinc-800"
                }`}
              >
                Previous
              </Link>
              <span className="text-zinc-500">
                Page {page} of {totalPages}
              </span>
              <Link
                href={`/admin/support?page=${page + 1}${statusFilter ? `&status=${statusFilter}` : ""}`}
                className={`px-3 py-1.5 rounded-lg border border-zinc-700 ${
                  page >= totalPages ? "opacity-30 pointer-events-none" : "hover:bg-zinc-800"
                }`}
              >
                Next
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
