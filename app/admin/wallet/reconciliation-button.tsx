"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminReconciliationButton({ walletId }: { walletId: string }) {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const handleReconcile = async () => {
    setIsRunning(true);
    setResultMessage(null);

    try {
      const res = await fetch("/api/wallet/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to run reconciliation check");
      }

      if (data.isConsistent) {
        setResultMessage("Audit verified: Balance perfectly matches ledger sum.");
      } else {
        setResultMessage(`Discrepancy detected: ${data.discrepancyBDT} BDT!`);
      }

      router.refresh();
    } catch (err: unknown) {
      setResultMessage(err instanceof Error ? err.message : "Error running audit");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleReconcile}
        disabled={isRunning}
        className="px-2.5 py-1 text-xs rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 disabled:opacity-50 transition"
      >
        {isRunning ? "Verifying..." : "Verify Audit"}
      </button>
      {resultMessage && (
        <span className="text-[10px] text-amber-400 block max-w-xs text-right">
          {resultMessage}
        </span>
      )}
    </div>
  );
}
