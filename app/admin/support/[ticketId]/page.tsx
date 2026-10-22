import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { isAdminOrStaffRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { SupportTicketStatus } from "@prisma/client";
import { addTicketMessageAction, updateTicketStatusAction } from "@/app/actions/support";

export const metadata = {
  title: "Ticket Detail & Staff Notes | Admin Console",
};

interface AdminTicketDetailPageProps {
  params: Promise<{ ticketId: string }>;
}

export default async function AdminTicketDetailPage({ params }: AdminTicketDetailPageProps) {
  const session = await getCurrentSession();
  if (!session || !isAdminOrStaffRole(session.role)) {
    redirect("/admin/login");
  }

  const { ticketId } = await params;

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <AdminHeader currentPath="/admin/support" />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-zinc-500 mb-6">
          <Link href="/admin" className="hover:text-zinc-300">
            Console
          </Link>
          <span>/</span>
          <Link href="/admin/support" className="hover:text-zinc-300">
            Support
          </Link>
          <span>/</span>
          <span className="text-zinc-200 font-mono">{ticket.ticketNumber}</span>
        </div>

        {/* Ticket Header & Status Controls */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                  {ticket.ticketNumber}
                </span>
                <span className="text-xs px-2.5 py-1 rounded font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                  Status: {ticket.status}
                </span>
              </div>
              <h1 className="text-xl font-bold text-zinc-50 mt-2">{ticket.subject}</h1>
            </div>

            {/* Status Transition Form */}
            <form
              action={async (formData: FormData) => {
                "use server";
                await updateTicketStatusAction(formData);
              }}
              className="flex items-center gap-2"
            >
              <input type="hidden" name="ticketId" value={ticket.id} />
              <select
                name="status"
                defaultValue={ticket.status}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none"
              >
                {Object.values(SupportTicketStatus).map((st) => (
                  <option key={st} value={st}>
                    Change to {st}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-zinc-950 font-semibold text-xs hover:bg-amber-400 transition"
              >
                Update
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs">
            <div>
              <span className="text-zinc-500 block">Customer Name</span>
              <span className="font-medium text-zinc-200">{ticket.customerName}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Email Address</span>
              <span className="font-medium text-zinc-200 font-mono">{ticket.customerEmail}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Contact Phone</span>
              <span className="font-medium text-zinc-200">{ticket.customerPhone || "Not provided"}</span>
            </div>
          </div>
        </div>

        {/* Message Thread */}
        <div className="space-y-4 mb-8">
          <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">
            Communication History
          </h2>

          {ticket.messages.map((msg) => {
            const isInternal = msg.isStaff && msg.messageText.startsWith("[INTERNAL STAFF NOTE");

            return (
              <div
                key={msg.id}
                className={`rounded-xl border p-5 text-sm ${
                  isInternal
                    ? "border-amber-500/30 bg-amber-950/20"
                    : msg.isStaff
                    ? "border-emerald-500/30 bg-emerald-950/20"
                    : "border-zinc-800 bg-zinc-900/40"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-200 text-xs">
                      {msg.sender?.name || (msg.isStaff ? "Support Operations" : ticket.customerName)}
                    </span>
                    {isInternal ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Staff Internal Note (Hidden from Customer)
                      </span>
                    ) : msg.isStaff ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Public Staff Reply
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                        Customer
                      </span>
                    )}
                  </div>
                  <span className="text-zinc-500 text-xs">
                    {new Date(msg.createdAt).toLocaleString()}
                  </span>
                </div>

                <div className="text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {msg.messageText}
                </div>
              </div>
            );
          })}
        </div>

        {/* Reply & Internal Note Composer */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
          <h3 className="text-sm font-bold text-zinc-200 mb-4">Post Response or Internal Staff Note</h3>

          <form
            action={async (formData: FormData) => {
              "use server";
              await addTicketMessageAction(formData);
            }}
            className="space-y-4"
          >
            <input type="hidden" name="ticketId" value={ticket.id} />

            <div>
              <textarea
                name="messageText"
                rows={4}
                required
                placeholder="Type reply to customer or private staff note..."
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <label className="flex items-center gap-2 text-xs text-amber-300 cursor-pointer">
                <input
                  type="checkbox"
                  name="isStaffOnlyNote"
                  value="true"
                  className="rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-0"
                />
                <span>Save as Internal Staff Note (Customer will NOT see this or receive alerts)</span>
              </label>

              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-amber-500 text-zinc-950 font-semibold text-xs hover:bg-amber-400 transition"
              >
                Send Message / Save Note
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
