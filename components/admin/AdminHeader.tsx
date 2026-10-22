import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/session";
import { logoutAction } from "@/lib/auth/actions";

interface AdminHeaderProps {
  currentPath?: string;
}

export async function AdminHeader({ currentPath }: AdminHeaderProps) {
  const session = await getCurrentSession();

  const navigation = [
    { name: "Overview", href: "/admin" },
    { name: "Inquiries", href: "/admin/inquiries" },
    { name: "Quotes", href: "/admin/quotes" },
    { name: "Orders", href: "/admin/orders" },
    { name: "Support", href: "/admin/support" },
    { name: "Wallet Ledger", href: "/admin/wallet" },
    { name: "Reports", href: "/admin/reports" },
    { name: "Settings", href: "/admin/settings" },
    { name: "Products", href: "/admin/products" },
    { name: "Categories", href: "/admin/categories" },
    { name: "Public Storefront", href: "/products", target: "_blank" },
  ];

  return (
    <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-6">
            <Link href="/admin" className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-center text-amber-500 font-bold text-sm">
                MP
              </div>
              <div className="hidden sm:block">
                <span className="text-sm font-semibold text-zinc-100 block">
                  Admin & Operations Console
                </span>
                <span className="text-xs text-zinc-400 block">
                  Malaysia → Bangladesh Logistics
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex space-x-1" aria-label="Admin Navigation">
              {navigation.map((item) => {
                const isActive = currentPath === item.href || (item.href !== "/admin" && currentPath?.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    target={item.target}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-zinc-800 text-amber-400 border border-zinc-700"
                        : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60"
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            {session && (
              <div className="text-right hidden sm:block">
                <p className="text-xs font-medium text-zinc-200">{session.name || session.email}</p>
                <div className="flex items-center justify-end space-x-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] uppercase font-mono tracking-wider text-amber-400">
                    {session.role}
                  </span>
                </div>
              </div>
            )}

            <form action={logoutAction}>
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 transition-colors"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
