import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { requireAdminOrStaff, isAdminOrStaffRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const metadata = {
  title: "Admin Customers & Support Inquiries | Malaysia Pre-Order",
};

export default async function AdminCustomersPage() {
  const session = await getCurrentSession();
  if (!session || !isAdminOrStaffRole(session.role)) {
    redirect("/admin/login");
  }

  await requireAdminOrStaff();

  const [customers, supportTickets] = await Promise.all([
    prisma.user.findMany({
      where: { role: "CUSTOMER" },
      orderBy: { createdAt: "desc" },
      include: {
        profile: true,
        _count: {
          select: {
            orders: true,
            inquiries: true,
          },
        },
        walletAccount: {
          select: { balance: true },
        },
      },
      take: 50,
    }),
    prisma.supportTicket.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
      },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-zinc-800 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Registered Customers & Support
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Customer directory, order histories, wallet accounts, and support tickets.
          </p>
        </div>
      </div>

      {/* Customer Directory */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">
            Customer Directory ({customers.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/70 text-zinc-400 uppercase tracking-wider border-b border-zinc-800 font-semibold">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">District</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Inquiries</th>
                <th className="px-4 py-3">Wallet</th>
                <th className="px-4 py-3 text-right">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 text-zinc-300">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                    No customers registered yet.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-800/40">
                    <td className="px-4 py-3 font-medium text-zinc-100">
                      {c.name}
                      <span className="text-[11px] text-zinc-400 block">{c.email}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-400">{c.phone || "-"}</td>
                    <td className="px-4 py-3">{c.profile?.district || "Dhaka"}</td>
                    <td className="px-4 py-3 font-bold text-emerald-400">{c._count.orders}</td>
                    <td className="px-4 py-3 font-bold text-amber-400">{c._count.inquiries}</td>
                    <td className="px-4 py-3 font-mono font-bold text-zinc-200">
                      ৳ {c.walletAccount ? Number(c.walletAccount.balance).toFixed(2) : "0.00"}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-500 font-mono">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Support Queries / Tickets */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">
          Support Queries & Inquiries ({supportTickets.length})
        </h2>

        {supportTickets.length === 0 ? (
          <p className="text-xs text-zinc-500 italic py-4">No support tickets submitted.</p>
        ) : (
          <div className="space-y-3">
            {supportTickets.map((t) => (
              <div
                key={t.id}
                className="p-4 rounded-xl border border-zinc-800 bg-zinc-950 text-xs flex justify-between items-center"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-amber-400">{t.ticketNumber}</span>
                    <span className="font-bold text-zinc-200">{t.subject}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-300">
                      {t.status}
                    </span>
                  </div>
                  <div className="text-zinc-400 text-[11px] mt-1">
                    From: {t.customerName} ({t.customerEmail}) • {new Date(t.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
