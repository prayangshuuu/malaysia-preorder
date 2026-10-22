"use client";

import { useState } from "react";
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/app/actions/customer-account";
import Link from "next/link";

interface NotificationsProps {
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    status: string;
    linkUrl: string | null;
    createdAt: Date | string;
  }>;
}

export function CustomerNotificationList({ notifications }: NotificationsProps) {
  const [loading, setLoading] = useState(false);

  async function handleMarkAllRead() {
    setLoading(true);
    try {
      await markAllNotificationsReadAction();
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkRead(id: string) {
    const formData = new FormData();
    formData.append("notificationId", id);
    await markNotificationReadAction(formData);
  }

  const unreadCount = notifications.filter((n) => n.status === "UNREAD").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            Notifications ({notifications.length})
          </h2>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-zinc-950">
              {unreadCount} unread
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={loading}
            className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer disabled:opacity-50"
          >
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
          <div className="text-2xl mb-2">🔔</div>
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No notifications</p>
          <p className="text-xs text-zinc-400 mt-0.5">
            You will be alerted here when quotations are prepared, payments verified, or order milestones reach Dhaka.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {notifications.map((notif) => {
            const isUnread = notif.status === "UNREAD";
            return (
              <div
                key={notif.id}
                className={`p-4 rounded-xl border text-xs transition-colors flex items-start justify-between gap-4 ${
                  isUnread
                    ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-300/70 dark:border-amber-900/50"
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                    )}
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">
                      {notif.title}
                    </span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {notif.message}
                  </p>
                  <div className="flex items-center gap-3 pt-1 text-[11px] text-zinc-400 font-mono">
                    <span>{new Date(notif.createdAt).toLocaleString()}</span>
                    {notif.linkUrl && (
                      <Link
                        href={notif.linkUrl}
                        className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                      >
                        View Details →
                      </Link>
                    )}
                  </div>
                </div>

                {isUnread && (
                  <button
                    type="button"
                    onClick={() => handleMarkRead(notif.id)}
                    className="text-[11px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 shrink-0 cursor-pointer"
                  >
                    Mark read
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
