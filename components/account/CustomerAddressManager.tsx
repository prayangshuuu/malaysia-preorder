"use client";

import { useState } from "react";
import {
  createAddressAction,
  deleteAddressAction,
  setDefaultAddressAction,
} from "@/app/actions/customer-account";

interface AddressManagerProps {
  initialAddresses: Array<{
    id: string;
    recipientName: string;
    phoneNumber: string;
    streetAddress: string;
    thanaOrUpazila: string | null;
    district: string;
    division: string;
    postalCode: string | null;
    country: string;
    isDefault: boolean;
  }>;
}

export function CustomerAddressManager({ initialAddresses }: AddressManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAddAddress(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await createAddressAction(formData);
      if (res.success) {
        setShowAddForm(false);
        (e.target as HTMLFormElement).reset();
      } else {
        setError(res.error || "Failed to add address");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(addressId: string) {
    if (!confirm("Are you sure you want to remove this delivery address?")) return;
    const formData = new FormData();
    formData.append("addressId", addressId);
    await deleteAddressAction(formData);
  }

  async function handleSetDefault(addressId: string) {
    const formData = new FormData();
    formData.append("addressId", addressId);
    await setDefaultAddressAction(formData);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
          Delivery Addresses ({initialAddresses.length})
        </h2>
        <button
          type="button"
          onClick={() => { setShowAddForm(!showAddForm); setError(null); }}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
        >
          {showAddForm ? "Cancel" : "+ Add New Address"}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg text-xs bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          {error}
        </div>
      )}

      {/* Add Address Form */}
      {showAddForm && (
        <form onSubmit={handleAddAddress} className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            New Bangladesh Delivery Address
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Recipient Name *
              </label>
              <input
                type="text"
                name="recipientName"
                required
                placeholder="e.g. Tanzim Hasan"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Phone Number *
              </label>
              <input
                type="tel"
                name="phoneNumber"
                required
                placeholder="01712345678"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Street / Building / Road Details *
            </label>
            <input
              type="text"
              name="streetAddress"
              required
              placeholder="e.g. House 42, Road 11, Block D, Banani"
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Thana / Upazila
              </label>
              <input
                type="text"
                name="thanaOrUpazila"
                placeholder="e.g. Banani"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                District *
              </label>
              <input
                type="text"
                name="district"
                required
                placeholder="Dhaka"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Division *
              </label>
              <input
                type="text"
                name="division"
                required
                placeholder="Dhaka"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                name="isDefault"
                value="true"
                className="rounded border-zinc-300 text-emerald-600 focus:ring-0"
              />
              Set as default shipping address
            </label>

            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Saving..." : "Save Address"}
            </button>
          </div>
        </form>
      )}

      {/* Address List */}
      {initialAddresses.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
          <p className="text-xs text-zinc-500">No delivery addresses saved yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {initialAddresses.map((addr) => (
            <div
              key={addr.id}
              className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 text-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                    {addr.recipientName}
                  </span>
                  {addr.isDefault && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      Default
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!addr.isDefault && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(addr.id)}
                      className="text-zinc-500 hover:text-emerald-600 transition-colors font-medium cursor-pointer"
                    >
                      Make Default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(addr.id)}
                    className="text-rose-600 hover:text-rose-700 transition-colors font-medium ml-2 cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="text-zinc-500 mt-1">{addr.phoneNumber}</div>
              <div className="text-zinc-700 dark:text-zinc-300 mt-1.5 leading-relaxed">
                {addr.streetAddress}
                {addr.thanaOrUpazila ? `, ${addr.thanaOrUpazila}` : ""}
                <br />
                {addr.district}, {addr.division} {addr.postalCode ? `- ${addr.postalCode}` : ""}
                <br />
                {addr.country}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
