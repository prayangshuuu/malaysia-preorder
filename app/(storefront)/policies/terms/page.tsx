import type { Metadata } from "next";
import { getPublicBusinessSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Terms & Conditions | Malaysia Direct BD",
  description: "Official pre-order terms and conditions for sourcing goods from Malaysia to Bangladesh.",
};

export default async function TermsPolicyPage() {
  const settings = await getPublicBusinessSettings();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">
          Terms & Conditions
        </h1>
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
          Operated by {settings.companyName} • Last updated: October 2026
        </p>
      </div>

      <div className="prose prose-zinc dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-line text-zinc-700 dark:text-zinc-300">
        {settings.policies.termsAndConditions}
      </div>
    </div>
  );
}
