import { redirect, notFound } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  extractShippingOptionsFromQuote,
  extractTermsText,
  expireOutdatedQuotes,
} from "@/lib/quotes/service";
import { QuoteDetailView } from "@/components/quotes/QuoteDetailView";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerQuoteDetailPage({ params }: PageProps) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }

  const { id } = await params;

  // Run maintenance check
  await expireOutdatedQuotes();

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      lineItems: true,
      inquiry: {
        select: {
          id: true,
          inquiryNumber: true,
          productName: true,
          brandOrModel: true,
          userId: true,
        },
      },
    },
  });

  if (!quote) {
    notFound();
  }

  // IDOR Protection: Must be the inquiry owner or admin
  const isOwner = quote.inquiry.userId === session.userId;
  const isStaff = ["ADMIN", "OPERATIONS", "FINANCE", "SUPPORT"].includes(session.role);

  if (!isOwner && !isStaff) {
    redirect("/unauthorized");
  }

  const userAddresses = await prisma.address.findMany({
    where: { userId: session.userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  const shippingOptions = extractShippingOptionsFromQuote(quote);
  const cleanTerms = extractTermsText(quote.termsAndConditions);

  // Mask admin confidential fields
  const clientQuote = {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    version: quote.version,
    status: quote.status,
    validUntil: quote.validUntil.toISOString(),
    currency: quote.currency,
    itemsSubtotalBDT: Number(quote.itemsSubtotalBDT),
    serviceFeeBDT: Number(quote.serviceFeeBDT),
    shippingFeeBDT: Number(quote.shippingFeeBDT),
    customsFeeBDT: Number(quote.customsFeeBDT),
    discountBDT: Number(quote.discountBDT),
    totalAmountBDT: Number(quote.totalAmountBDT),
    shippingMethod: quote.shippingMethod,
    shippingOptions,
    estDispatchDaysMin: quote.estDispatchDaysMin,
    estDispatchDaysMax: quote.estDispatchDaysMax,
    estDeliveryDaysMin: quote.estDeliveryDaysMin,
    estDeliveryDaysMax: quote.estDeliveryDaysMax,
    customerNotes: quote.customerNotes,
    terms: cleanTerms,
    acceptedAt: quote.acceptedAt?.toISOString() || null,
    rejectedAt: quote.rejectedAt?.toISOString() || null,
    rejectionReason: quote.rejectionReason,
    lineItems: quote.lineItems.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      sourceUrl: item.sourceUrl,
      quantity: item.quantity,
      unitPriceBDT: Number(item.unitPriceBDT),
      totalPriceBDT: Number(item.totalPriceBDT),
    })),
    inquiry: {
      id: quote.inquiry.id,
      inquiryNumber: quote.inquiry.inquiryNumber,
      productName: quote.inquiry.productName,
      brandOrModel: quote.inquiry.brandOrModel,
    },
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href="/account/quotes"
          className="text-xs text-zinc-400 hover:text-amber-400 transition-colors flex items-center gap-1.5"
        >
          ← Back to All Quotations
        </Link>
      </div>

      <QuoteDetailView quote={clientQuote} userAddresses={userAddresses} />
    </div>
  );
}
