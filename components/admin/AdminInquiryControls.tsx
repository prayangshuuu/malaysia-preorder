"use client";

import { useState } from "react";
import {
  adminUpdateInquiryStatusAction,
  adminUpdatePrivateNotesAction,
  adminSendInquiryMessageAction,
} from "@/app/actions/inquiry";
import { InquiryStatus } from "@prisma/client";

interface AdminInquiryControlsProps {
  inquiryId: string;
  currentStatus: InquiryStatus;
  initialPrivateNotes: string;
  customerName: string;
}

const statusOptions: { value: InquiryStatus; label: string }[] = [
  { value: "SUBMITTED", label: "Submitted" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "NEEDS_INFORMATION", label: "Needs Information" },
  { value: "QUOTED", label: "Quoted" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "DECLINED", label: "Declined" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function AdminInquiryControls({
  inquiryId,
  currentStatus,
  initialPrivateNotes,
  customerName,
}: AdminInquiryControlsProps) {
  // Status state
  const [status, setStatus] = useState<InquiryStatus>(currentStatus);
  const [statusReason, setStatusReason] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Private notes state
  const [privateNotes, setPrivateNotes] = useState(initialPrivateNotes);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesMessage, setNotesMessage] = useState<string | null>(null);

  // Messaging state
  const [messageText, setMessageText] = useState("");
  const [isStaffOnly, setIsStaffOnly] = useState(false);
  const [setNeedsInfo, setSetNeedsInfo] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [msgFeedback, setMsgFeedback] = useState<string | null>(null);

  // Handle status update
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusLoading(true);
    setStatusMessage(null);

    try {
      const res = await adminUpdateInquiryStatusAction({
        inquiryId,
        targetStatus: status,
        reason: statusReason.trim() || undefined,
      });

      if (!res.success) {
        setStatusMessage(`✕ Error: ${res.message}`);
      } else {
        setStatusMessage("✓ Status updated successfully.");
        setStatusReason("");
      }
    } catch (err: unknown) {
      setStatusMessage(`✕ ${err instanceof Error ? err.message : "Error updating status."}`);
    } finally {
      setStatusLoading(false);
    }
  };

  // Handle private notes save
  const handleSavePrivateNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotesLoading(true);
    setNotesMessage(null);

    try {
      const res = await adminUpdatePrivateNotesAction({
        inquiryId,
        adminPrivateNotes: privateNotes,
      });

      if (!res.success) {
        setNotesMessage(`✕ Error: ${res.message}`);
      } else {
        setNotesMessage("✓ Internal private notes saved.");
      }
    } catch (err: unknown) {
      setNotesMessage(`✕ ${err instanceof Error ? err.message : "Error saving notes."}`);
    } finally {
      setNotesLoading(false);
    }
  };

  // Handle send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    setMessageLoading(true);
    setMsgFeedback(null);

    try {
      const res = await adminSendInquiryMessageAction({
        inquiryId,
        messageText: messageText.trim(),
        isStaffOnly,
        setNeedsInformation: setNeedsInfo,
      });

      if (!res.success) {
        setMsgFeedback(`✕ Error: ${res.message}`);
      } else {
        setMsgFeedback(
          isStaffOnly
            ? "✓ Internal staff note added (invisible to customer)."
            : "✓ Customer-visible message sent and notified."
        );
        setMessageText("");
        setSetNeedsInfo(false);
      }
    } catch (err: unknown) {
      setMsgFeedback(`✕ ${err instanceof Error ? err.message : "Error sending message."}`);
    } finally {
      setMessageLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Status Management Card */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-xs text-zinc-300">
        <h3 className="font-bold text-sm text-zinc-100 mb-3 flex items-center justify-between">
          <span>Inquiry Lifecycle Status</span>
          <span className="font-mono text-[10px] text-amber-400">Current: {currentStatus}</span>
        </h3>

        {statusMessage && (
          <div className="mb-3 p-2 rounded bg-zinc-800 text-[11px] text-zinc-200">
            {statusMessage}
          </div>
        )}

        <form onSubmit={handleUpdateStatus} className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
              Select New Status:
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as InquiryStatus)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} ({opt.value})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
              Reason / Transition Audit Note:
            </label>
            <input
              type="text"
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="e.g. Sourcing stock verified in Sunway Pyramid"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={statusLoading || status === currentStatus}
              className="rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 transition disabled:opacity-50"
            >
              {statusLoading ? "Updating..." : "Update Status"}
            </button>
          </div>
        </form>
      </div>

      {/* 2. Admin Private Notes Card (Isolated from Customer) */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-xs text-zinc-300">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-sm text-zinc-100">Internal Sourcing Notes</h3>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-900/60">
            🔒 Private Staff Only
          </span>
        </div>
        <p className="text-[11px] text-zinc-400 mb-3">
          Never visible to customers. Store supplier contacts, purchase prices in MYR, wholesale warehouse links, or internal margins.
        </p>

        {notesMessage && (
          <div className="mb-3 p-2 rounded bg-zinc-800 text-[11px] text-zinc-200">
            {notesMessage}
          </div>
        )}

        <form onSubmit={handleSavePrivateNotes} className="space-y-3">
          <textarea
            rows={4}
            value={privateNotes}
            onChange={(e) => setPrivateNotes(e.target.value)}
            placeholder="e.g. Supplier contact: Mr. Lee WhatsApp +6012..., wholesale cost MYR 180, expected parcel weight 1.2kg."
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2.5 text-xs font-mono text-zinc-200 focus:border-amber-500 focus:outline-none"
          />

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={notesLoading}
              className="rounded-lg bg-zinc-800 px-3.5 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition disabled:opacity-50"
            >
              {notesLoading ? "Saving..." : "Save Internal Notes"}
            </button>
          </div>
        </form>
      </div>

      {/* 3. Send Message / Communication Card */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-xs text-zinc-300">
        <h3 className="font-bold text-sm text-zinc-100 mb-2">Send Message / Request Information</h3>
        <p className="text-[11px] text-zinc-400 mb-3">
          Reply directly to {customerName} or record an internal staff note in the inquiry timeline.
        </p>

        {msgFeedback && (
          <div className="mb-3 p-2 rounded bg-zinc-800 text-[11px] text-zinc-200">
            {msgFeedback}
          </div>
        )}

        <form onSubmit={handleSendMessage} className="space-y-3">
          <textarea
            rows={3}
            required
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder={
              isStaffOnly
                ? "Type staff note to be recorded internally..."
                : "Type message to be sent to customer with notification..."
            }
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2.5 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none"
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="space-y-1">
              <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                <input
                  type="checkbox"
                  checked={isStaffOnly}
                  onChange={(e) => setIsStaffOnly(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-950 text-amber-500 focus:ring-0"
                />
                <span className="text-[11px] font-semibold">
                  Staff-Only Note (Hide from Customer)
                </span>
              </label>

              {!isStaffOnly && (
                <label className="flex items-center gap-2 cursor-pointer text-purple-400">
                  <input
                    type="checkbox"
                    checked={setNeedsInfo}
                    onChange={(e) => setSetNeedsInfo(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-950 text-purple-500 focus:ring-0"
                  />
                  <span className="text-[11px]">
                    Mark inquiry as &quot;Needs Information&quot;
                  </span>
                </label>
              )}
            </div>

            <button
              type="submit"
              disabled={messageLoading || !messageText.trim()}
              className="rounded-lg bg-zinc-100 px-4 py-2 text-xs font-bold text-zinc-900 hover:bg-white transition disabled:opacity-50"
            >
              {messageLoading ? "Sending..." : isStaffOnly ? "Save Staff Note" : "Send Customer Reply"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
