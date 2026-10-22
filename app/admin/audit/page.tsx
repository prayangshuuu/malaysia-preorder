import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { requireAdminOrStaff, isAdminOrStaffRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const metadata = {
  title: "Admin Security & Operational Audit Trail | Malaysia Pre-Order",
};

interface AuditPageProps {
  searchParams: Promise<{
    action?: string;
    page?: string;
  }>;
}

export default async function AdminAuditPage({ searchParams }: AuditPageProps) {
  const session = await getCurrentSession();
  if (!session || !isAdminOrStaffRole(session.role)) {
    redirect("/admin/login");
  }

  await requireAdminOrStaff();

  const { action, page: pageParam } = await searchParams;
  const page = parseInt(pageParam || "1", 10) || 1;
  const pageSize = 20;

  const where = action ? { action } : {};

  const [logs, totalCount] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-zinc-800 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Immutable Audit Log & Security Trail
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Full compliance record of administrative actions, ledger postings, state transitions, and sourcing updates.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/70 text-zinc-400 uppercase tracking-wider border-b border-zinc-800 font-semibold">
              <tr>
                <th className="px-4 py-3.5">Timestamp</th>
                <th className="px-4 py-3.5">Action</th>
                <th className="px-4 py-3.5">Actor</th>
                <th className="px-4 py-3.5">Entity</th>
                <th className="px-4 py-3.5">Details Snapshot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 text-zinc-300">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                    No audit records logged.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-800/40">
                    <td className="px-4 py-3.5 font-mono text-zinc-400 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-amber-400">
                      {log.action}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-semibold text-zinc-200 block">
                        {log.actorEmail || "SYSTEM"}
                      </span>
                      {log.actorRole && (
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {log.actorRole}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-zinc-300">
                      {log.entityType}
                      {log.entityId && (
                        <span className="text-[10px] text-zinc-500 block truncate max-w-[120px]">
                          {log.entityId}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-400 font-mono text-[11px] max-w-sm truncate">
                      {log.metadata ? JSON.stringify(log.metadata) : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs pt-2">
          <Link
            href={`/admin/audit?page=${Math.max(1, page - 1)}`}
            className={`px-3 py-1.5 rounded-lg border border-zinc-700 ${
              page <= 1 ? "opacity-40 pointer-events-none" : "hover:bg-zinc-800 text-zinc-300"
            }`}
          >
            Previous
          </Link>
          <span className="text-zinc-500">
            Page {page} of {totalPages}
          </span>
          <Link
            href={`/admin/audit?page=${page + 1}`}
            className={`px-3 py-1.5 rounded-lg border border-zinc-700 ${
              page >= totalPages ? "opacity-40 pointer-events-none" : "hover:bg-zinc-800 text-zinc-300"
            }`}
          >
            Next
          </Link>
        </div>
      )}
    </div>
  );
}
