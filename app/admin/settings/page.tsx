import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { requireAdminOrStaff, isAdminOrStaffRole } from "@/lib/auth/rbac";
import { getBusinessSettings } from "@/lib/settings";
import { AdminSettingsForm } from "@/components/admin/AdminSettingsForm";
import { UserRole } from "@prisma/client";

export default async function AdminSettingsPage() {
  const session = await getCurrentSession();
  if (!session || !isAdminOrStaffRole(session.role)) {
    redirect("/admin/login");
  }

  await requireAdminOrStaff();

  const settings = await getBusinessSettings();
  const canEdit = session.role === UserRole.ADMIN;

  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-800 pb-5">
        <h1 className="text-2xl font-bold text-zinc-100">Business & System Settings</h1>
        <p className="text-xs text-zinc-400 mt-1">
          Configure company profile, public policies, quote defaults, fees, shipping methods, and documented FX exchange rates.
        </p>
      </div>

      <AdminSettingsForm initialSettings={settings} canEdit={canEdit} />
    </div>
  );
}
