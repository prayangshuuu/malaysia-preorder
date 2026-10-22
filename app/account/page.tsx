import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { logoutAction } from "@/lib/auth/actions";
import AccountProfileForm from "./profile-form";

export default async function AccountPage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      profile: true,
      addresses: {
        orderBy: { createdAt: "desc" },
      },
      walletAccount: true,
      _count: {
        select: {
          orders: true,
          inquiries: true,
          quotesAccepted: true,
        },
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  const walletBalance = user.walletAccount?.balance
    ? Number(user.walletAccount.balance).toFixed(2)
    : "0.00";

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-8 border-b border-zinc-200 dark:border-zinc-800 gap-4">
        <div>
          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 mb-2">
            Customer Account
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {user.name}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {user.email} {user.phone ? `• ${user.phone}` : ""}
          </p>
        </div>

        <form action={logoutAction}>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 my-8">
        <Link
          href="/account/wallet"
          className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 transition group block"
        >
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase font-medium text-zinc-500 group-hover:text-emerald-600 transition">
              Wallet Balance
            </div>
            <span className="text-xs font-semibold text-emerald-600">Top up &rarr;</span>
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
            ৳ {walletBalance}
          </div>
          <div className="text-xs text-zinc-400 mt-1">Available for pre-orders (Audited)</div>
        </Link>

        <Link
          href="/account/orders"
          className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-medium text-zinc-500 group-hover:text-emerald-600">Active Orders</span>
            <span className="text-xs text-zinc-400">Track →</span>
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
            {user._count.orders}
          </div>
          <div className="text-xs text-zinc-400 mt-1">Malaysia → Bangladesh</div>
        </Link>

        <Link
          href="/account/inquiries"
          className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-medium text-zinc-500 group-hover:text-emerald-600">Product Inquiries</span>
            <span className="text-xs text-zinc-400">View →</span>
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
            {user._count.inquiries}
          </div>
          <div className="text-xs text-zinc-400 mt-1">Requested products</div>
        </Link>

        <Link
          href="/account/quotes"
          className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 hover:border-amber-500/50 transition-colors block"
        >
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase font-medium text-zinc-500">Quotations</div>
            <span className="text-xs text-amber-500 font-semibold">View →</span>
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
            {user._count.quotesAccepted}
          </div>
          <div className="text-xs text-zinc-400 mt-1">Accepted & pending quotes</div>
        </Link>

        <Link
          href="/account/notifications"
          className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 transition group block"
        >
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase font-medium text-zinc-500 group-hover:text-emerald-600">Alerts</div>
            <span className="text-xs text-emerald-600 font-semibold">View →</span>
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
            History
          </div>
          <div className="text-xs text-zinc-400 mt-1">Notification log & updates</div>
        </Link>
      </div>

      {/* Profile & Addresses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Profile Settings */}
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">
            Profile Details
          </h2>
          <AccountProfileForm
            initialData={{
              name: user.name,
              phone: user.phone || "",
              preferredCity: user.profile?.preferredCity || "",
              district: user.profile?.district || "",
              division: user.profile?.division || "",
              defaultNotes: user.profile?.defaultNotes || "",
            }}
          />
        </div>

        {/* Addresses */}
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Delivery Addresses
            </h2>
          </div>

          {user.addresses.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
              <p className="text-sm text-zinc-500">No delivery addresses saved yet.</p>
              <p className="text-xs text-zinc-400 mt-1">
                You can save addresses for quick checkout and customs dispatch.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {user.addresses.map((addr) => (
                <div
                  key={addr.id}
                  className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {addr.recipientName}
                    </span>
                    {addr.isDefault && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="text-zinc-500 text-xs mt-1">{addr.phoneNumber}</div>
                  <div className="text-zinc-600 dark:text-zinc-300 mt-2">
                    {addr.streetAddress},{" "}
                    {addr.thanaOrUpazila ? `${addr.thanaOrUpazila}, ` : ""}
                    {addr.district}, {addr.division}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
