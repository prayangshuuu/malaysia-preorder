"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  reorderCategoriesAction,
} from "@/app/actions/admin-catalog";
import { generateSlug } from "@/lib/validations/admin-product";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  displayOrder: number;
  isActive: boolean;
  parent: { id: string; name: string } | null;
  _count: {
    products: number;
    children: number;
  };
}

interface CategoryManagementViewProps {
  categories: Category[];
}

export function CategoryManagementView({ categories }: CategoryManagementViewProps) {
  const router = useRouter();

  // Form Modal / Inline Editor State
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form Fields
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [autoSlug, setAutoSlug] = useState(true);
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [displayOrder, setDisplayOrder] = useState<number>(0);
  const [isActive, setIsActive] = useState(true);

  // Status
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const startCreate = () => {
    setEditingCategory(null);
    setName("");
    setSlug("");
    setAutoSlug(true);
    setDescription("");
    setImageUrl("");
    setParentId("");
    setDisplayOrder(categories.length);
    setIsActive(true);
    setErrorMsg(null);
    setFieldErrors({});
    setIsCreating(true);
  };

  const startEdit = (cat: Category) => {
    setIsCreating(false);
    setEditingCategory(cat);
    setName(cat.name);
    setSlug(cat.slug);
    setAutoSlug(false);
    setDescription(cat.description || "");
    setImageUrl(cat.imageUrl || "");
    setParentId(cat.parentId || "");
    setDisplayOrder(cat.displayOrder);
    setIsActive(cat.isActive);
    setErrorMsg(null);
    setFieldErrors({});
  };

  const cancelEditor = () => {
    setEditingCategory(null);
    setIsCreating(false);
    setErrorMsg(null);
    setFieldErrors({});
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (autoSlug) {
      setSlug(generateSlug(val));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setFieldErrors({});

    const payload = {
      name,
      slug,
      description: description || null,
      imageUrl: imageUrl || null,
      parentId: parentId || null,
      displayOrder: Number(displayOrder),
      isActive,
    };

    try {
      const res = editingCategory
        ? await updateCategoryAction({ ...payload, id: editingCategory.id })
        : await createCategoryAction(payload);

      if (!res.success) {
        setErrorMsg(res.message || "Failed to save category.");
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
        setLoading(false);
        return;
      }

      setSuccessMsg(res.message || "Saved successfully!");
      setLoading(false);
      cancelEditor();
      router.refresh();
    } catch {
      setErrorMsg("An unexpected server error occurred.");
      setLoading(false);
    }
  };

  const handleDelete = async (cat: Category) => {
    if (
      !confirm(
        `Are you sure you want to delete category "${cat.name}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    const res = await deleteCategoryAction(cat.id);
    if (!res.success) {
      setErrorMsg(res.message || "Failed to delete category.");
      setLoading(false);
      return;
    }

    setSuccessMsg(res.message || "Category deleted.");
    setLoading(false);
    router.refresh();
  };

  const handleMoveOrder = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const reorderedList = [...categories];
    const [moved] = reorderedList.splice(index, 1);
    reorderedList.splice(targetIndex, 0, moved);

    const orders = reorderedList.map((item, idx) => ({
      id: item.id,
      displayOrder: idx,
    }));

    setLoading(true);
    const res = await reorderCategoriesAction({ orders });
    if (!res.success) {
      setErrorMsg(res.message || "Failed to update category order.");
    } else {
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-100">Product Categories</h2>
          <p className="text-xs text-zinc-400 mt-1">
            Organize catalog products into hierarchical departments with custom display order.
          </p>
        </div>
        {!isCreating && !editingCategory && (
          <button
            onClick={startCreate}
            className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-amber-400 transition shadow"
          >
            + Create New Category
          </button>
        )}
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-medium text-rose-300">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-medium text-emerald-300">
          {successMsg}
        </div>
      )}

      {/* Inline Create / Edit Drawer */}
      {(isCreating || editingCategory) && (
        <div className="rounded-2xl border border-amber-500/40 bg-zinc-900 p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400">
              {editingCategory ? `Edit Category: ${editingCategory.name}` : "Create New Category"}
            </h3>
            <button
              onClick={cancelEditor}
              className="text-xs text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Coffee & Traditional Beverages"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
                  required
                />
                {fieldErrors.name && (
                  <p className="mt-1 text-xs text-rose-400">{fieldErrors.name[0]}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    URL Slug *
                  </label>
                  <label className="text-[11px] text-zinc-400 flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={autoSlug}
                      onChange={(e) => setAutoSlug(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-950 text-amber-500"
                    />
                    Auto-slug
                  </label>
                </div>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => {
                    setAutoSlug(false);
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                  }}
                  placeholder="coffee-beverages"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 font-mono focus:border-amber-500 focus:outline-none"
                  required
                />
                {fieldErrors.slug && (
                  <p className="mt-1 text-xs text-rose-400">{fieldErrors.slug[0]}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-1">
                  Parent Category
                </label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
                >
                  <option value="">None (Top-Level Category)</option>
                  {categories
                    .filter((c) => !editingCategory || c.id !== editingCategory.id)
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                </select>
                {fieldErrors.parentId && (
                  <p className="mt-1 text-xs text-rose-400">{fieldErrors.parentId[0]}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-1">
                  Display Order
                </label>
                <input
                  type="number"
                  min="0"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(Number(e.target.value))}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-1">
                  Visibility
                </label>
                <select
                  value={isActive ? "true" : "false"}
                  onChange={(e) => setIsActive(e.target.value === "true")}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
                >
                  <option value="true">Active (Visible)</option>
                  <option value="false">Inactive (Hidden)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-1">
                Description
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional customer-facing description of goods in this category."
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-1">
                Category Banner / Icon URL
              </label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/category-cover.jpg"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={cancelEditor}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-amber-500 px-5 py-2 text-xs font-bold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
              >
                {loading ? "Saving..." : editingCategory ? "Save Changes" : "Create Category"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Category Table */}
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/60 text-zinc-400 uppercase tracking-wider border-b border-zinc-800 font-semibold">
              <tr>
                <th className="px-4 py-3.5 w-16 text-center">Order</th>
                <th className="px-4 py-3.5">Category Name</th>
                <th className="px-4 py-3.5">Slug</th>
                <th className="px-4 py-3.5">Parent</th>
                <th className="px-4 py-3.5 text-center">Products</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 text-zinc-300">
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-zinc-500">
                    No categories found. Click &quot;+ Create New Category&quot; to begin.
                  </td>
                </tr>
              ) : (
                categories.map((cat, idx) => (
                  <tr key={cat.id} className="hover:bg-zinc-800/40 transition">
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1 font-mono text-zinc-400">
                        <span>{cat.displayOrder}</span>
                        <div className="flex flex-col ml-1">
                          <button
                            type="button"
                            onClick={() => handleMoveOrder(idx, "up")}
                            disabled={idx === 0 || loading}
                            className="text-[10px] text-zinc-400 hover:text-amber-400 disabled:opacity-20"
                            title="Move Up"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveOrder(idx, "down")}
                            disabled={idx === categories.length - 1 || loading}
                            className="text-[10px] text-zinc-400 hover:text-amber-400 disabled:opacity-20"
                            title="Move Down"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-zinc-100">
                      {cat.name}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-zinc-400">
                      /{cat.slug}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-400">
                      {cat.parent ? cat.parent.name : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono">
                      <span className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-300">
                        {cat._count.products}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          cat.isActive
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-zinc-800 text-zinc-500 border border-zinc-700"
                        }`}
                      >
                        {cat.isActive ? "Active" : "Hidden"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-2">
                      <button
                        onClick={() => startEdit(cat)}
                        className="rounded px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(cat)}
                        disabled={cat._count.products > 0 || cat._count.children > 0}
                        title={
                          cat._count.products > 0
                            ? "Cannot delete category with associated products"
                            : undefined
                        }
                        className="rounded px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
