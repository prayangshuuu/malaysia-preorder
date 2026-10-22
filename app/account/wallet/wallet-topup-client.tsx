"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function WalletTopUpClient() {
  const router = useRouter();
  const [amount, setAmount] = useState<string>("1000");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const predefinedAmounts = [500, 1000, 2500, 5000, 10000];

  const handleTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsedAmount = parseFloat(amount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid top-up amount");
      return;
    }

    try {
      setIsSubmitting(true);
      const idempotencyKey = `topup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const res = await fetch("/api/wallet/topup/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountBDT: parsedAmount,
          idempotencyKey,
          providerName: "safe-dev-payment",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to initiate top-up");
      }

      // Check payment action url or details
      if (data.paymentInitiation?.actionDetails?.redirectUrl) {
        window.location.href = data.paymentInitiation.actionDetails.redirectUrl;
      } else {
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to initiate top-up");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Add Funds (Top-Up)</h3>
        <span className="text-[10px] uppercase font-semibold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
          bKash / Nagad / Cards
        </span>
      </div>

      <p className="text-xs text-zinc-500 mb-4">
        Credits are posted immediately after verified payment confirmation.
      </p>

      {error && (
        <div className="mb-3 p-2.5 rounded-lg text-xs bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900">
          {error}
        </div>
      )}

      <form onSubmit={handleTopUp} className="space-y-4">
        <div>
          <label htmlFor="topup-amount" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Amount (BDT)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-zinc-400 font-bold text-sm">৳</span>
            <input
              id="topup-amount"
              type="number"
              min="10"
              max="500000"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              placeholder="e.g. 1000"
              disabled={isSubmitting}
              required
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {predefinedAmounts.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(String(preset))}
              className={`px-2.5 py-1 text-xs rounded-md border transition ${
                amount === String(preset)
                  ? "bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              ৳{preset}
            </button>
          ))}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition"
        >
          {isSubmitting ? "Initiating Gateway Session..." : "Proceed to Secure Payment"}
        </button>
      </form>
    </div>
  );
}
