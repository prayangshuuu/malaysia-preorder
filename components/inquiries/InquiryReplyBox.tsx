"use client";

import { useState } from "react";
import { customerReplyInquiryAction } from "@/app/actions/inquiry";

interface InquiryReplyBoxProps {
  inquiryId: string;
  isClosed?: boolean;
}

export function InquiryReplyBox({ inquiryId, isClosed = false }: InquiryReplyBoxProps) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (isClosed) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-500 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
        This inquiry has been finalized or closed. New replies are disabled.
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await customerReplyInquiryAction({
        inquiryId,
        messageText: message.trim(),
      });

      if (!res.success) {
        setError(res.message || "Failed to submit reply.");
      } else {
        setSuccess(res.message || "Reply sent!");
        setMessage("");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error sending reply.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm">
      <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2">
        Reply to Sourcing Team
      </h3>
      <p className="text-xs text-zinc-500 mb-4">
        Need to clarify variants, confirm requested details, or answer staff questions? Reply below.
      </p>

      {success && (
        <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900/50 dark:text-emerald-300">
          ✓ {success}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-300">
          ✕ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          rows={3}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message or answer to the sourcing specialist here..."
          className="w-full rounded-lg border border-zinc-300 bg-zinc-50 p-3 text-xs text-zinc-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || !message.trim()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send Reply"}
          </button>
        </div>
      </form>
    </div>
  );
}
