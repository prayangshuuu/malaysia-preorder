import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { requireAdminOrStaff, isAdminOrStaffRole } from "@/lib/auth/rbac";
import { getAdminCategories } from "@/lib/admin-catalog";
import { CategoryManagementView } from "@/components/admin/CategoryManagementView";

export default async function AdminCategoriesPage() {
  const session = await getCurrentSession();
  if (!session || !isAdminOrStaffRole(session.role)) {
    redirect("/admin/login");
  }

  await requireAdminOrStaff();

  const categories = await getAdminCategories();

  return <CategoryManagementView categories={categories} />;
}
