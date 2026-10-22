import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/session";
import { requireAdminOrStaff, isAdminOrStaffRole } from "@/lib/auth/rbac";
import { getAdminCategories } from "@/lib/admin-catalog";
import { prisma } from "@/lib/prisma";
import { ProductForm } from "@/components/admin/ProductForm";

export default async function AdminNewProductPage() {
  const session = await getCurrentSession();
  if (!session || !isAdminOrStaffRole(session.role)) {
    redirect("/admin/login");
  }

  await requireAdminOrStaff();

  const [categories, suppliers] = await Promise.all([
    getAdminCategories(),
    prisma.supplier.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center space-x-2 text-xs text-zinc-400">
        <Link href="/admin/products" className="hover:text-amber-400 transition">
          Products
        </Link>
        <span>/</span>
        <span className="text-zinc-200 font-semibold">New Product</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Create New Product</h1>
        <p className="text-xs text-zinc-400 mt-1">
          Add a Malaysian sourced item to the catalogue with BDT pricing, S3 media, and sourcing rules.
        </p>
      </div>

      <ProductForm
        categories={categories}
        suppliers={suppliers}
        isStaff={isAdminOrStaffRole(session.role)}
      />
    </div>
  );
}
