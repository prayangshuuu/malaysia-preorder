"use client";

import React, { useState } from "react";
import { BusinessSettings } from "@/lib/settings";

interface AdminSettingsFormProps {
  initialSettings: BusinessSettings;
  canEdit: boolean;
}

export function AdminSettingsForm({ initialSettings, canEdit }: AdminSettingsFormProps) {
  const [activeTab, setActiveTab] = useState<
    "company" | "policies" | "quotes_fees" | "shipping" | "payments" | "exchange_rate"
  >("company");

  const [settings, setSettings] = useState<BusinessSettings>(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    setIsSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save settings");
      }

      setStatusMessage({
        type: "success",
        text: "Business settings saved and change audit entry created successfully.",
      });
      setSettings(data.settings);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving settings";
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Notifications */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-sm font-medium border ${
            statusMessage.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
              : "bg-red-950/40 border-red-500/40 text-red-300"
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {!canEdit && (
        <div className="p-4 rounded-xl text-xs bg-amber-950/30 border border-amber-600/30 text-amber-300">
          <strong>View Only:</strong> You are currently logged in with staff permissions. Only users with the Super Administrator role may alter business policies, exchange rates, or fee structures.
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-3">
        {[
          { key: "company", label: "🏢 Company & Contact" },
          { key: "policies", label: "📜 Legal & Content Policies" },
          { key: "quotes_fees", label: "⚙️ Quote Validity & Fees" },
          { key: "shipping", label: "✈️ Shipping Methods" },
          { key: "payments", label: "💳 Payment Channels" },
          { key: "exchange_rate", label: "💱 Currency & Exchange Rate" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`px-3 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === tab.key
                ? "bg-amber-500 text-zinc-950"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 bg-zinc-900 border border-zinc-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: COMPANY & CONTACT */}
      {activeTab === "company" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-zinc-100">Company & Customer Support Details</h2>
          <p className="text-xs text-zinc-400">
            Public company contact info displayed on the customer portal, invoice headers, and footer.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Company Trade Name</label>
              <input
                type="text"
                disabled={!canEdit}
                value={settings.companyName}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 disabled:opacity-60"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Brand Tagline</label>
              <input
                type="text"
                disabled={!canEdit}
                value={settings.tagline || ""}
                onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Customer Support Email</label>
              <input
                type="email"
                disabled={!canEdit}
                value={settings.supportEmail}
                onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 disabled:opacity-60"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Customer Support Phone / Hotline</label>
              <input
                type="text"
                disabled={!canEdit}
                value={settings.supportPhone}
                onChange={(e) => setSettings({ ...settings, supportPhone: e.target.value })}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 disabled:opacity-60"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">WhatsApp Sourcing Hotline</label>
              <input
                type="text"
                disabled={!canEdit}
                value={settings.whatsappNumber || ""}
                onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Operating Business Hours</label>
              <input
                type="text"
                disabled={!canEdit}
                value={settings.businessHours || ""}
                onChange={(e) => setSettings({ ...settings, businessHours: e.target.value })}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 disabled:opacity-60"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-zinc-300 mb-1">Kuala Lumpur Logistics & Sourcing Office</label>
              <input
                type="text"
                disabled={!canEdit}
                value={settings.klOfficeAddress || ""}
                onChange={(e) => setSettings({ ...settings, klOfficeAddress: e.target.value })}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 disabled:opacity-60"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-zinc-300 mb-1">Dhaka Distribution Hub & Office Address</label>
              <input
                type="text"
                disabled={!canEdit}
                value={settings.dhakaOfficeAddress || ""}
                onChange={(e) => setSettings({ ...settings, dhakaOfficeAddress: e.target.value })}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 disabled:opacity-60"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: POLICIES */}
      {activeTab === "policies" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Legal & Customer Content Policies</h2>
            <p className="text-xs text-zinc-400">
              Manage live terms, privacy, refund/cancellation, shipping, and wallet policies. Markdown formatting supported.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-amber-400 mb-1">Terms & Conditions Policy</label>
              <textarea
                rows={6}
                disabled={!canEdit}
                value={settings.termsAndConditionsPolicy}
                onChange={(e) => setSettings({ ...settings, termsAndConditionsPolicy: e.target.value })}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 font-mono text-xs text-zinc-200 disabled:opacity-60"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-amber-400 mb-1">Privacy & Data Handling Policy</label>
              <textarea
                rows={6}
                disabled={!canEdit}
                value={settings.privacyPolicy}
                onChange={(e) => setSettings({ ...settings, privacyPolicy: e.target.value })}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 font-mono text-xs text-zinc-200 disabled:opacity-60"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-amber-400 mb-1">Refund & Cancellation Policy</label>
              <textarea
                rows={6}
                disabled={!canEdit}
                value={settings.refundAndCancellationPolicy}
                onChange={(e) => setSettings({ ...settings, refundAndCancellationPolicy: e.target.value })}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 font-mono text-xs text-zinc-200 disabled:opacity-60"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-amber-400 mb-1">Shipping & Customs Logistics Policy</label>
              <textarea
                rows={6}
                disabled={!canEdit}
                value={settings.shippingPolicy}
                onChange={(e) => setSettings({ ...settings, shippingPolicy: e.target.value })}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 font-mono text-xs text-zinc-200 disabled:opacity-60"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-amber-400 mb-1">Customer Wallet & Ledger Policy</label>
              <textarea
                rows={6}
                disabled={!canEdit}
                value={settings.walletPolicy}
                onChange={(e) => setSettings({ ...settings, walletPolicy: e.target.value })}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 font-mono text-xs text-zinc-200 disabled:opacity-60"
                required
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: QUOTE VALIDITY & FEES */}
      {activeTab === "quotes_fees" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-zinc-100">Quote Validity & Service Fees Defaults</h2>
          <p className="text-xs text-zinc-400">
            Define system-wide defaults pre-populated when issuing new quotations for customer inquiries.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Quote Default Validity (Days)
              </label>
              <input
                type="number"
                min={1}
                max={60}
                disabled={!canEdit}
                value={settings.quoteDefaultValidityDays}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    quoteDefaultValidityDays: parseInt(e.target.value) || 7,
                  })
                }
                className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 disabled:opacity-60"
                required
              />
              <span className="text-[11px] text-zinc-500">Days until quotation expires if unaccepted</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Default Service / Sourcing Fee (BDT)
              </label>
              <input
                type="number"
                min={0}
                disabled={!canEdit}
                value={settings.defaultServiceFeeBDT}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    defaultServiceFeeBDT: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 disabled:opacity-60"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Default Customs Fee (BDT)
              </label>
              <input
                type="number"
                min={0}
                disabled={!canEdit}
                value={settings.defaultCustomsFeeBDT}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    defaultCustomsFeeBDT: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 disabled:opacity-60"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Minimum Pre-Order Threshold (BDT)
              </label>
              <input
                type="number"
                min={0}
                disabled={!canEdit}
                value={settings.minimumOrderBDT}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    minimumOrderBDT: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 disabled:opacity-60"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Standard Customer Notes Boilerplate
              </label>
              <input
                type="text"
                disabled={!canEdit}
                value={settings.standardCustomerNotes || ""}
                onChange={(e) =>
                  setSettings({ ...settings, standardCustomerNotes: e.target.value })
                }
                className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 disabled:opacity-60"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SHIPPING OPTIONS */}
      {activeTab === "shipping" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Configurable Shipping Options</h2>
              <p className="text-xs text-zinc-400">
                Logistics channels presented to staff when generating quotes.
              </p>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  const newId = `opt-${Date.now().toString().slice(-4)}`;
                  setSettings({
                    ...settings,
                    shippingOptions: [
                      ...settings.shippingOptions,
                      {
                        id: newId,
                        name: "Custom Carrier Option",
                        description: "Standard delivery",
                        costBDT: 1000,
                        estDaysMin: 7,
                        estDaysMax: 14,
                        isDefault: false,
                      },
                    ],
                  });
                }}
                className="px-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 rounded-lg text-amber-400 font-semibold"
              >
                + Add Option
              </button>
            )}
          </div>

          <div className="space-y-3 pt-2">
            {settings.shippingOptions.map((opt, idx) => (
              <div
                key={opt.id}
                className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 grid grid-cols-1 md:grid-cols-6 gap-3 items-center"
              >
                <div className="md:col-span-2">
                  <label className="text-[10px] text-zinc-400 uppercase font-mono">Option Name</label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={opt.name}
                    onChange={(e) => {
                      const updated = [...settings.shippingOptions];
                      updated[idx].name = e.target.value;
                      setSettings({ ...settings, shippingOptions: updated });
                    }}
                    className="w-full rounded bg-zinc-900 border border-zinc-700 px-2 py-1 text-xs text-zinc-100"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-mono">Cost (BDT)</label>
                  <input
                    type="number"
                    disabled={!canEdit}
                    value={opt.costBDT}
                    onChange={(e) => {
                      const updated = [...settings.shippingOptions];
                      updated[idx].costBDT = parseFloat(e.target.value) || 0;
                      setSettings({ ...settings, shippingOptions: updated });
                    }}
                    className="w-full rounded bg-zinc-900 border border-zinc-700 px-2 py-1 text-xs text-zinc-100"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-mono">Est Days (Min-Max)</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      disabled={!canEdit}
                      value={opt.estDaysMin}
                      onChange={(e) => {
                        const updated = [...settings.shippingOptions];
                        updated[idx].estDaysMin = parseInt(e.target.value) || 1;
                        setSettings({ ...settings, shippingOptions: updated });
                      }}
                      className="w-1/2 rounded bg-zinc-900 border border-zinc-700 px-2 py-1 text-xs text-zinc-100"
                    />
                    <input
                      type="number"
                      disabled={!canEdit}
                      value={opt.estDaysMax}
                      onChange={(e) => {
                        const updated = [...settings.shippingOptions];
                        updated[idx].estDaysMax = parseInt(e.target.value) || 1;
                        setSettings({ ...settings, shippingOptions: updated });
                      }}
                      className="w-1/2 rounded bg-zinc-900 border border-zinc-700 px-2 py-1 text-xs text-zinc-100"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-3">
                  <input
                    type="radio"
                    id={`def-${opt.id}`}
                    name="default_shipping"
                    checked={opt.isDefault}
                    disabled={!canEdit}
                    onChange={() => {
                      const updated = settings.shippingOptions.map((o, i) => ({
                        ...o,
                        isDefault: i === idx,
                      }));
                      setSettings({ ...settings, shippingOptions: updated });
                    }}
                    className="rounded text-amber-500 focus:ring-amber-400"
                  />
                  <label htmlFor={`def-${opt.id}`} className="text-xs text-zinc-300">
                    Default
                  </label>
                </div>
                {canEdit && settings.shippingOptions.length > 1 && (
                  <div className="pt-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        const updated = settings.shippingOptions.filter((_, i) => i !== idx);
                        setSettings({ ...settings, shippingOptions: updated });
                      }}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: PAYMENT METHODS */}
      {activeTab === "payments" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-zinc-100">Enabled Payment Methods</h2>
          <p className="text-xs text-zinc-400">
            Control which payment methods customers can select during pre-order checkout.
          </p>

          <div className="space-y-3 pt-2">
            {settings.paymentMethods.map((method, idx) => (
              <div
                key={method.id}
                className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-wrap items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-zinc-100">{method.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                      {method.id}
                    </span>
                    {method.requiresManualVerification && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800/40">
                        Manual Verification
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={method.instructions || ""}
                    onChange={(e) => {
                      const updated = [...settings.paymentMethods];
                      updated[idx].instructions = e.target.value;
                      setSettings({ ...settings, paymentMethods: updated });
                    }}
                    placeholder="Instructions displayed to customer..."
                    className="mt-2 w-full rounded bg-zinc-900 border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-xs text-zinc-300 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={method.enabled}
                      disabled={!canEdit}
                      onChange={(e) => {
                        const updated = [...settings.paymentMethods];
                        updated[idx].enabled = e.target.checked;
                        setSettings({ ...settings, paymentMethods: updated });
                      }}
                      className="rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-amber-400 h-4 w-4"
                    />
                    <span>{method.enabled ? "Active" : "Disabled"}</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: EXCHANGE RATE HANDLING */}
      {activeTab === "exchange_rate" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-zinc-100">Currency Display & Documented Exchange Rate</h2>
          <p className="text-xs text-zinc-400">
            Rules and documented policies for cross-border currency conversion between Malaysian Ringgit (MYR) and Bangladeshi Taka (BDT).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Customer Display & Settlement Currency
              </label>
              <input
                type="text"
                disabled
                value={settings.baseDisplayCurrency}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-400 cursor-not-allowed"
              />
              <span className="text-[11px] text-zinc-500">Fixed system standard per MASTER_PROMPT</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Procurement Sourcing Currency
              </label>
              <input
                type="text"
                disabled
                value={settings.sourcingCurrency}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-400 cursor-not-allowed"
              />
              <span className="text-[11px] text-zinc-500">Retail purchase currency in Kuala Lumpur</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Default Indicative Rate (1 MYR = ? BDT)
              </label>
              <input
                type="number"
                step="0.01"
                min={1}
                disabled={!canEdit}
                value={settings.exchangeRateHandling.defaultRateMYRtoBDT}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    exchangeRateHandling: {
                      ...settings.exchangeRateHandling,
                      defaultRateMYRtoBDT: parseFloat(e.target.value) || 28.5,
                    },
                  })
                }
                className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 disabled:opacity-60"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Exchange Volatility Risk Buffer (%)
              </label>
              <input
                type="number"
                step="0.1"
                min={0}
                max={50}
                disabled={!canEdit}
                value={settings.exchangeRateHandling.bufferPercent}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    exchangeRateHandling: {
                      ...settings.exchangeRateHandling,
                      bufferPercent: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 disabled:opacity-60"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Rate Benchmark Source Description
              </label>
              <input
                type="text"
                disabled={!canEdit}
                value={settings.exchangeRateHandling.sourceDescription}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    exchangeRateHandling: {
                      ...settings.exchangeRateHandling,
                      sourceDescription: e.target.value,
                    },
                  })
                }
                className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 disabled:opacity-60"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-amber-400 mb-1">
                Documented Exchange Rate Handling Policy
              </label>
              <textarea
                rows={6}
                disabled={!canEdit}
                value={settings.exchangeRateHandling.rulesDocumentation}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    exchangeRateHandling: {
                      ...settings.exchangeRateHandling,
                      rulesDocumentation: e.target.value,
                    },
                  })
                }
                className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 font-mono text-xs text-zinc-200 disabled:opacity-60"
                required
              />
            </div>
          </div>
        </div>
      )}

      {/* Save Button Action */}
      {canEdit && (
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm shadow transition disabled:opacity-50"
          >
            {isSaving ? "Saving & Auditing Changes..." : "Save Settings Changes"}
          </button>
        </div>
      )}
    </form>
  );
}
