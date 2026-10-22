"use client";

import { useState } from "react";
import { submitSupportTicketAction } from "@/app/actions/support";

interface ContactSupportFormProps {
  initialEmail?: string;
  initialName?: string;
}

export function ContactSupportForm({ initialEmail, initialName }: ContactSupportFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    ticketNumber: string;
    message: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await submitSupportTicketAction(formData);
      if (res.success && res.ticketNumber) {
        setSuccessResult({
          ticketNumber: res.ticketNumber,
          message: res.message || "Support ticket submitted successfully.",
        });
      } else {
        setError(res.error || "Failed to submit inquiry. Please try again.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected network error occurred.");
    } finally {
      setLoading(false);
    }
  }

  if (successResult) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/50 p-8 dark:bg-emerald-950/20 text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400 mb-4">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          Inquiry Successfully Logged!
        </h3>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
          {successResult.message}
        </p>
        <div className="mt-6 inline-block rounded-lg bg-white dark:bg-zinc-900 px-4 py-2 border border-zinc-200 dark:border-zinc-800 text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
          Ticket Reference: #{successResult.ticketNumber}
        </div>
        <p className="mt-4 text-xs text-zinc-500">
          Our team usually responds within 2-4 business hours on Malaysia working days.
        </p>
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setSuccessResult(null)}
            className="text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 underline"
          >
            Submit another inquiry
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-sm">
          {error}
        </div>
      )}

      {/* Honeypot hidden input for spam bots */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="companyWebsite">Website</label>
        <input
          type="text"
          id="companyWebsite"
          name="companyWebsite"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label
            htmlFor="customerName"
            className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300"
          >
            Your Name *
          </label>
          <input
            id="customerName"
            name="customerName"
            type="text"
            required
            defaultValue={initialName || ""}
            placeholder="Tanvir Ahmed"
            className="mt-2 block w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div>
          <label
            htmlFor="customerEmail"
            className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300"
          >
            Email Address *
          </label>
          <input
            id="customerEmail"
            name="customerEmail"
            type="email"
            required
            defaultValue={initialEmail || ""}
            placeholder="tanvir@example.com"
            className="mt-2 block w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label
            htmlFor="customerPhone"
            className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300"
          >
            Contact Phone / WhatsApp (Optional)
          </label>
          <input
            id="customerPhone"
            name="customerPhone"
            type="tel"
            placeholder="+8801712345678"
            className="mt-2 block w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div>
          <label
            htmlFor="subject"
            className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300"
          >
            Subject / Order Reference *
          </label>
          <input
            id="subject"
            name="subject"
            type="text"
            required
            placeholder="Inquiry regarding Order #ORD-2026-0042"
            className="mt-2 block w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="message"
          className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300"
        >
          Message / Details *
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          placeholder="Please describe your question or issue in detail..."
          className="mt-2 block w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <p className="mt-2 text-xs text-zinc-500">
          Never share credit card CVV codes or confidential passwords in support messages.
        </p>
      </div>

      <div>
        <button
          type="submit"
          disabled={loading}
          className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-emerald-600 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 transition"
        >
          {loading ? "Submitting Inquiry..." : "Send Support Message"}
        </button>
      </div>
    </form>
  );
}
