import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatBDT } from "@/lib/formatters";
import Link from "next/link";
import { expireOutdatedQuotes } from "@/lib/quotes/service";

export default async function CustomerQuotesListPage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }

  // Auto-expire outdated
  await expireOutdatedQuotes();

  const quotes = await prisma.quote.findMany({
    where: {
      inquiry: {
        userId: session.userId,
      },
    },
    orderBy: [{ createdAt: "desc" }],
    include: {
      inquiry: {
        select: {
          id: true,
          inquiryNumber: true,
          productName: true,
        },
      },
      lineItems: {
        select: {
          id: true,
          title: true,
          quantity: true,
        },
      },
    },
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-zinc-200 dark:border-zinc-800 gap-4 mb-8">
        <div>
          <span className="text-xs uppercase font-bold tracking-wider text-amber-500">
            Account Dashboard
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mt-1">
            My Sourcing Quotations
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Review detailed pricing, shipping choices, and accept your customized cross-border quotes.
          </p>
        </div>

        <Link
          href="/inquire"
          className="inline-flex items-center px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 text-zinc-950 hover:bg-amber-400 transition-colors shadow-sm"
        >
          + Request New Product
        </Link>
      </div>

      {quotes.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 text-xl font-bold">
            ৳
          </div>
          <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
            No Quotations Yet
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto mt-1 mb-5">
            When you request items from Malaysia via our custom inquiry form, our sourcing team will review availability and prepare an itemized quote for you.
          </p>
          <Link
            href="/inquire"
            className="inline-flex items-center px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 hover:bg-zinc-800 transition-colors"
          >
            Submit an Inquiry
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
          {quotes.map((q) => {
            const isAccepted = q.status === "ACCEPTED";
            const isRejected = q.status === "REJECTED";
            const isSuperseded = q.status === "SUPERSEDED";
            const isExpired =
              q.status === "EXPIRED" ||
              (q.status === "SENT" && new Date(q.validUntil) < new Date());

            return (
              <div
                key={q.id}
                className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                      Quote #{q.quoteNumber}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
                      v{q.version}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        isAccepted
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : isRejected
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                          : isExpired
                          ? "bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300"
                          : isSuperseded
                          ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                      }`}
                    >
                      {isExpired ? "EXPIRED" : q.status}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {q.inquiry.productName}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap">
                    <span>Inquiry: {q.inquiry.inquiryNumber}</span>
                    <span>•</span>
                    <span>
                      {q.lineItems.length} item line{q.lineItems.length > 1 ? "s" : ""}
                    </span>
                    <span>•</span>
                    <span>
                      Valid until: {new Date(q.validUntil).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 border-t sm:border-t-0 pt-3 sm:pt-0 border-zinc-100 dark:border-zinc-800">
                  <div className="text-right">
                    <div className="text-base font-black text-amber-600 dark:text-amber-400">
                      {formatBDT(q.totalAmountBDT)}
                    </div>
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold">
                      Total in BDT
                    </span>
                  </div>

                  <Link
                    href={`/account/quotes/${q.id}`}
                    className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
                  >
                    View & Review Quote →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
