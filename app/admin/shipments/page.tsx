import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { requireAdminOrStaff, isAdminOrStaffRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const metadata = {
  title: "Admin Air Freight & Consignments | Malaysia Pre-Order",
};

export default async function AdminShipmentsListPage() {
  const session = await getCurrentSession();
  if (!session || !isAdminOrStaffRole(session.role)) {
    redirect("/admin/login");
  }

  await requireAdminOrStaff();

  const shipments = await prisma.shipment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          shippingRecipientName: true,
          shippingDistrict: true,
        },
      },
      events: {
        orderBy: { timestamp: "desc" },
        take: 1,
      },
    },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-zinc-800 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Air Freight & Consignment Tracking
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Monitor international flights from Kuala Lumpur to Dhaka, customs inspections, and courier dispatches.
          </p>
        </div>

        <Link
          href="/admin/orders"
          className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-amber-400 transition shadow"
        >
          Orders Queue
        </Link>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/70 text-zinc-400 uppercase tracking-wider border-b border-zinc-800 font-semibold">
              <tr>
                <th className="px-4 py-3.5">Consignment Ref</th>
                <th className="px-4 py-3.5">Order</th>
                <th className="px-4 py-3.5">Recipient & District</th>
                <th className="px-4 py-3.5">Carrier / AWB</th>
                <th className="px-4 py-3.5">Weight</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 text-zinc-300">
              {shipments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                    No consignments generated yet. Create shipments from order pages.
                  </td>
                </tr>
              ) : (
                shipments.map((s) => (
                  <tr key={s.id} className="hover:bg-zinc-800/40">
                    <td className="px-4 py-3.5 font-mono font-bold text-zinc-100">
                      {s.shipmentNumber}
                    </td>
                    <td className="px-4 py-3.5 font-mono">
                      <Link href={`/admin/orders/${s.order.id}`} className="text-amber-400 hover:underline">
                        {s.order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      {s.order.shippingRecipientName} ({s.order.shippingDistrict})
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-semibold">{s.carrierName || "Consolidated Air"}</span>
                      {s.trackingNumber && (
                        <div className="font-mono text-[11px] text-zinc-400">{s.trackingNumber}</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-mono">
                      {s.weightKg ? `${s.weightKg} kg` : "-"}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                          s.status === "DELIVERED"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : s.status === "DELAYED"
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={`/admin/orders/${s.order.id}`}
                        className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold"
                      >
                        Manage →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
