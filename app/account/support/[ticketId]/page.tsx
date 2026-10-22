import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { sanitizeSupportMessagesForCustomer } from "@/lib/support";
import { addTicketMessageAction } from "@/app/actions/support";

export const metadata = {
  title: "Support Ticket Conversation | Malaysia Pre-Order",
};

interface CustomerTicketPageProps {
  params: Promise<{ ticketId: string }>;
}

export default async function CustomerTicketPage({ params }: CustomerTicketPageProps) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }

  const { ticketId } = await params;

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          sender: {
            select: {
              name: true,
              role: true,
            },
          },
        },
      },
    },
  });

  if (!ticket) {
    notFound();
  }

  // IDOR & Privacy check: User must own the ticket (or match email)
  if (ticket.userId !== session.userId && ticket.customerEmail !== session.email.toLowerCase()) {
    redirect("/unauthorized");
  }

  // Filter out internal staff-only notes
  const customerSafeMessages = sanitizeSupportMessagesForCustomer(ticket.messages);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-6">
        <Link href="/account" className="hover:underline">
          Dashboard
        </Link>
        <span>/</span>
        <span className="text-zinc-900 dark:text-zinc-100 font-medium font-mono">
          {ticket.ticketNumber}
        </span>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900/60 mb-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-xs px-2.5 py-0.5 rounded font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                {ticket.ticketNumber}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                Status: {ticket.status}
              </span>
            </div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{ticket.subject}</h1>
          </div>
          <span className="text-xs text-zinc-500">
            Created: {new Date(ticket.createdAt).toLocaleDateString()}
          </span>
        </div>

        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          Our support desk reviews messages continually. You can post additional details or questions below.
        </p>
      </div>

      {/* Message Timeline */}
      <div className="space-y-4 mb-8">
        {customerSafeMessages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-2xl p-5 border text-sm ${
              msg.isStaff
                ? "bg-emerald-50/50 border-emerald-200/80 dark:bg-emerald-950/20 dark:border-emerald-900/40"
                : "bg-white border-zinc-200 dark:bg-zinc-900/60 dark:border-zinc-800"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                {msg.isStaff ? "Support Operations Team" : "You (Customer)"}
              </span>
              <span className="text-zinc-400 text-xs">
                {new Date(msg.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
              {msg.messageText}
            </div>
          </div>
        ))}
      </div>

      {/* Reply Box */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900/60 shadow-sm">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-3">Add Message</h3>
        <form
          action={async (formData: FormData) => {
            "use server";
            await addTicketMessageAction(formData);
          }}
          className="space-y-4"
        >
          <input type="hidden" name="ticketId" value={ticket.id} />
          <textarea
            name="messageText"
            rows={4}
            required
            placeholder="Type your reply or additional information..."
            className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <div className="text-right">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition"
            >
              Send Reply
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
