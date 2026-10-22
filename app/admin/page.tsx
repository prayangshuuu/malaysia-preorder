import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { requireAdminOrStaff, isAdminOrStaffRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function AdminDashboardPage() {
  const session = await getCurrentSession();
  if (!session || !isAdminOrStaffRole(session.role)) {
    redirect("/admin/login");
  }

  await requireAdminOrStaff();

  // Load operational metrics
  const [
    totalProducts,
    publishedProducts,
    totalCategories,
    totalCustomers,
    pendingInquiries,
    activeOrders,
    recentProducts,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { status: "PUBLISHED" } }),
    prisma.productCategory.count(),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.productInquiry.count({ where: { status: "SUBMITTED" } }),
    prisma.order.count({
      where: {
        status: {
          in: ["PAID", "PROCUREMENT", "PACKING", "DISPATCHED", "IN_TRANSIT"],
        },
      },
    }),
    prisma.product.findMany({
      take: 5,
      orderBy: { updatedAt: "desc" },
      include: {
        category: true,
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Operations Console</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Real-time status of cross-border catalog products, categories, sourcing inquiries, and orders.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/products/new"
            className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-amber-400 transition shadow"
          >
            + New Product
          </Link>
          <Link
            href="/admin/categories"
            className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition"
          >
            Manage Categories
          </Link>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href="/admin/products"
          className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl hover:border-zinc-700 transition block"
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            Catalogue Products
          </span>
          <div className="text-3xl font-bold text-zinc-100 mt-2">
            {totalProducts}
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            {publishedProducts} active & visible to customers
          </p>
        </Link>

        <Link
          href="/admin/categories"
          className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl hover:border-zinc-700 transition block"
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Departments & Categories
          </span>
          <div className="text-3xl font-bold text-zinc-100 mt-2">
            {totalCategories}
          </div>
          <p className="text-xs text-zinc-500 mt-1">Structured product departments</p>
        </Link>

        <Link
          href="/admin/orders"
          className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl hover:border-zinc-700 transition block group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Active Orders
            </span>
            <span className="text-xs text-zinc-500 group-hover:text-amber-400">Manage →</span>
          </div>
          <div className="text-3xl font-bold text-emerald-400 mt-2">
            {activeOrders}
          </div>
          <p className="text-xs text-zinc-500 mt-1">In fulfillment pipeline</p>
        </Link>

        <Link
          href="/admin/inquiries"
          className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl hover:border-zinc-700 transition block"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
              Pending Inquiries
            </span>
            <span className="text-xs text-zinc-500">Manage →</span>
          </div>
          <div className="text-3xl font-bold text-blue-400 mt-2">
            {pendingInquiries}
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            {totalCustomers} registered customers
          </p>
        </Link>
      </div>

      {/* Recent Catalog Activity Table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">
            Recently Updated Products
          </h2>
          <Link
            href="/admin/products"
            className="text-xs font-semibold text-amber-400 hover:text-amber-300"
          >
            View All Products →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/60 text-zinc-400 uppercase tracking-wider border-b border-zinc-800 font-semibold">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Pricing</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 text-zinc-300">
              {recentProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                    No products added yet.
                  </td>
                </tr>
              ) : (
                recentProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-800/40">
                    <td className="px-4 py-3 font-medium text-zinc-100">{p.title}</td>
                    <td className="px-4 py-3 text-zinc-400">{p.category.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                          p.status === "PUBLISHED"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : p.status === "DRAFT"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {p.pricingType === "FIXED_PRICE" && p.displayPriceBDT
                        ? `৳ ${Number(p.displayPriceBDT).toLocaleString()}`
                        : "Quote Only"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/products/${p.id}`}
                        className="rounded px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
                      >
                        Edit
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
