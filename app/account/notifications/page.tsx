import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { CustomerNotificationList } from "@/components/account/CustomerNotificationList";
import { getEmailProviderConfig } from "@/lib/notifications";

export const metadata = {
  title: "Notification History & Preferences | Malaysia Pre-Order",
};

interface NotificationPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function CustomerNotificationsPage({ searchParams }: NotificationPageProps) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }

  const { page: pageParam } = await searchParams;
  const page = parseInt(pageParam || "1", 10) || 1;
  const pageSize = 15;

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({
      where: { userId: session.userId },
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize);
  const emailConfig = getEmailProviderConfig();

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-6">
        <Link href="/account" className="hover:underline">
          Dashboard
        </Link>
        <span>/</span>
        <span className="text-zinc-900 dark:text-zinc-100 font-medium">Notifications</span>
      </div>

      <div className="pb-6 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Notifications & Alerts
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Real-time updates regarding quotation validity, payments, sourcing, and flight manifests.
          </p>
        </div>

        {/* Email delivery truthfulness note */}
        <div className="text-right">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            Email Alerts: {emailConfig.isConfigured ? "Active" : "In-App Only (SMTP Disabled)"}
          </span>
        </div>
      </div>

      <CustomerNotificationList notifications={notifications} />

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800 text-xs">
          <Link
            href={`/account/notifications?page=${Math.max(1, page - 1)}`}
            className={`px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 ${
              page <= 1 ? "opacity-40 pointer-events-none" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            Previous
          </Link>
          <span className="text-zinc-500">
            Page {page} of {totalPages}
          </span>
          <Link
            href={`/account/notifications?page=${page + 1}`}
            className={`px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 ${
              page >= totalPages ? "opacity-40 pointer-events-none" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            Next
          </Link>
        </div>
      )}
    </div>
  );
}
