import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatBDT } from "@/lib/formatters";
import { createOrderAction } from "@/app/actions/orders";

export const metadata = {
  title: "Checkout & Order Confirmation | Malaysia Pre-Order",
};

export default async function CheckoutQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ quoteId?: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }

  const { quoteId } = await searchParams;
  if (!quoteId) {
    redirect("/account");
  }

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      inquiry: true,
      lineItems: true,
      orders: true,
    },
  });

  if (!quote) {
    notFound();
  }

  if (quote.inquiry.userId !== session.userId && session.role === "CUSTOMER") {
    redirect("/account");
  }

  // If already converted to an order, redirect to that order
  if (quote.orders.length > 0) {
    redirect(`/account/orders/${quote.orders[0].id}`);
  }

  // Fetch customer saved addresses for autofill
  const savedAddresses = await prisma.address.findMany({
    where: { userId: session.userId },
    orderBy: { isDefault: "desc" },
  });

  const defaultAddr = savedAddresses[0];

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-6">
        <Link href="/account" className="hover:underline">
          Dashboard
        </Link>
        <span>/</span>
        <span className="text-zinc-900 dark:text-zinc-100 font-medium">Order Confirmation</span>
      </div>

      <div className="pb-6 border-b border-zinc-200 dark:border-zinc-800 mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Confirm Your Pre-Order
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Review snapshotted pricing and specify delivery details for Quote{" "}
          <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">
            {quote.quoteNumber}
          </span>
          .
        </p>
      </div>

      <form
        action={async (formData: FormData) => {
          "use server";
          await createOrderAction(formData);
        }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      >
        <input type="hidden" name="quoteId" value={quote.id} />

        {/* Left Column: Delivery Address & Notes */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              Bangladesh Delivery Destination
            </h2>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Recipient Full Name *
                </label>
                <input
                  type="text"
                  name="recipientName"
                  required
                  defaultValue={defaultAddr?.recipientName || session.name}
                  placeholder="e.g. Tanvir Ahmed"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  name="phoneNumber"
                  required
                  defaultValue={defaultAddr?.phoneNumber || ""}
                  placeholder="e.g. 01712345678"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Street Address (House, Road, Area) *
                </label>
                <input
                  type="text"
                  name="streetAddress"
                  required
                  defaultValue={defaultAddr?.streetAddress || ""}
                  placeholder="e.g. House 14, Road 5, Block B, Dhanmondi"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Thana / Upazila
                  </label>
                  <input
                    type="text"
                    name="thanaOrUpazila"
                    defaultValue={defaultAddr?.thanaOrUpazila || ""}
                    placeholder="e.g. Dhanmondi"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    District *
                  </label>
                  <input
                    type="text"
                    name="district"
                    required
                    defaultValue={defaultAddr?.district || "Dhaka"}
                    placeholder="e.g. Dhaka, Chittagong"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Division *
                  </label>
                  <input
                    type="text"
                    name="division"
                    required
                    defaultValue={defaultAddr?.division || "Dhaka"}
                    placeholder="e.g. Dhaka, Chattogram"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Postal Code
                  </label>
                  <input
                    type="text"
                    name="postalCode"
                    defaultValue={defaultAddr?.postalCode || ""}
                    placeholder="e.g. 1205"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Customer Delivery Notes (Optional)
                </label>
                <textarea
                  name="customerNotes"
                  rows={2}
                  placeholder="e.g. Please call before doorstep arrival"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Agreed Items & Place Order Button */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              Quote Summary
            </h2>

            <div className="space-y-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
              {quote.lineItems.map((li) => (
                <div key={li.id} className="text-xs flex justify-between">
                  <span className="font-medium truncate max-w-[170px] text-zinc-800 dark:text-zinc-200">
                    {li.quantity}x {li.title}
                  </span>
                  <span className="font-mono text-zinc-600 dark:text-zinc-400">
                    {formatBDT(li.totalPriceBDT)}
                  </span>
                </div>
              ))}
            </div>

            <div className="py-3 border-b border-zinc-100 dark:border-zinc-800 space-y-1.5 text-xs text-zinc-500">
              <div className="flex justify-between">
                <span>Items Subtotal</span>
                <span>{formatBDT(quote.itemsSubtotalBDT)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping / Air Cargo</span>
                <span>{formatBDT(quote.shippingFeeBDT)}</span>
              </div>
              <div className="flex justify-between">
                <span>Service Fee</span>
                <span>{formatBDT(quote.serviceFeeBDT)}</span>
              </div>
              <div className="flex justify-between">
                <span>Customs Duties</span>
                <span>{formatBDT(quote.customsFeeBDT)}</span>
              </div>
            </div>

            <div className="pt-3 flex justify-between items-baseline mb-6">
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                Total Guaranteed (BDT)
              </span>
              <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {formatBDT(quote.totalAmountBDT)}
              </span>
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm cursor-pointer"
            >
              Confirm Pre-Order →
            </button>
            <p className="text-[11px] text-zinc-400 text-center mt-2">
              An order reference will be generated and you will be routed to your payment options.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
