import type { Metadata } from "next";
import { getPublicBusinessSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Contact & Customer Support | Malaysia Direct BD",
  description: "Get in touch with our Kuala Lumpur sourcing operations and Dhaka distribution support.",
};

export default async function ContactPage() {
  const settings = await getPublicBusinessSettings();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">
          Contact Customer Support
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {settings.tagline || "We are here to assist with your cross-border pre-orders from Malaysia to Bangladesh."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm space-y-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 font-bold">
            📞
          </div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            Helpline & Direct Support
          </h2>
          <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
            <div>
              <span className="text-xs uppercase font-mono text-zinc-400 block">Hotline Phone</span>
              <a href={`tel:${settings.supportPhone}`} className="font-semibold text-emerald-600 dark:text-emerald-400">
                {settings.supportPhone}
              </a>
            </div>
            <div>
              <span className="text-xs uppercase font-mono text-zinc-400 block">Email Inquiries</span>
              <a href={`mailto:${settings.supportEmail}`} className="font-semibold text-emerald-600 dark:text-emerald-400">
                {settings.supportEmail}
              </a>
            </div>
            {settings.whatsappNumber && (
              <div>
                <span className="text-xs uppercase font-mono text-zinc-400 block">WhatsApp Sourcing Desk</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {settings.whatsappNumber}
                </span>
              </div>
            )}
            {settings.businessHours && (
              <div>
                <span className="text-xs uppercase font-mono text-zinc-400 block">Working Hours</span>
                <span className="text-zinc-700 dark:text-zinc-300">{settings.businessHours}</span>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm space-y-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-500 font-bold">
            🏢
          </div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            Operating Offices
          </h2>
          <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
            {settings.dhakaOfficeAddress && (
              <div>
                <span className="text-xs uppercase font-mono text-zinc-400 block">
                  Bangladesh Distribution Hub
                </span>
                <p className="mt-0.5 text-zinc-700 dark:text-zinc-300">
                  {settings.dhakaOfficeAddress}
                </p>
              </div>
            )}
            {settings.klOfficeAddress && (
              <div>
                <span className="text-xs uppercase font-mono text-zinc-400 block">
                  Malaysia Sourcing Office
                </span>
                <p className="mt-0.5 text-zinc-700 dark:text-zinc-300">
                  {settings.klOfficeAddress}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
          Currency & Exchange Rate Guarantee
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          {settings.exchangeRateHandling.rulesDocumentation}
        </p>
      </div>
    </div>
  );
}
