import { FormEvent, useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

type PageRow = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  content_i18n: Record<string, string>;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function safeSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getI18nText(obj: Record<string, string> | null | undefined, key: string) {
  return (obj?.[key] ?? "").toString();
}

export default function PagesAdmin() {
  const [items, setItems] = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = useMemo(() => items.find((p) => p.id === activeId) ?? null, [items, activeId]);

  const [slug, setSlug] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [titleZh, setTitleZh] = useState("");
  const [contentEn, setContentEn] = useState("");
  const [contentZh, setContentZh] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!active) return;
    setSlug(active.slug);
    setTitleEn(getI18nText(active.title_i18n, "en"));
    setTitleZh(getI18nText(active.title_i18n, "zh"));
    setContentEn(getI18nText(active.content_i18n, "en"));
    setContentZh(getI18nText(active.content_i18n, "zh"));
    setIsActive(active.is_active);
    setSortOrder(active.sort_order);
  }, [active]);

  function resetForm() {
    setActiveId(null);
    setSlug("");
    setTitleEn("");
    setTitleZh("");
    setContentEn("");
    setContentZh("");
    setIsActive(true);
    setSortOrder(0);
  }

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.rest<PageRow[]>("site_pages", "?order=sort_order.asc,created_at.desc");
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pages");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (busy) return;
    setBusy(true);
    try {
      const s = safeSlug(slug);
      if (!s) throw new Error("Slug is required");
      if (!titleEn.trim() && !titleZh.trim()) throw new Error("At least one title is required");

      const payload: Partial<PageRow> & Pick<PageRow, "slug" | "title_i18n" | "content_i18n" | "is_active" | "sort_order"> = {
        slug: s,
        title_i18n: { en: titleEn.trim(), zh: titleZh.trim() },
        content_i18n: { en: contentEn.trim(), zh: contentZh.trim() },
        is_active: isActive,
        sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
      };

      if (activeId) {
        await supabase.rest<PageRow[]>("site_pages", `?id=eq.${encodeURIComponent(activeId)}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(payload),
        });
      } else {
        const { data } = await supabase.rest<PageRow[]>("site_pages", "", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify([payload]),
        });
        if (data[0]?.id) setActiveId(data[0].id);
      }

      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    if (busy) return;
    setBusy(true);
    try {
      await supabase.rest<void>("site_pages", `?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
      if (activeId === id) resetForm();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_520px]">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold text-zinc-900">Pages</div>
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            New page
          </button>
        </div>

        {loading ? <div className="text-sm text-zinc-600">Loading...</div> : null}
        {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <div className="grid grid-cols-[1fr_120px_120px] gap-3 border-b border-zinc-200 px-4 py-3 text-xs font-semibold text-zinc-500">
            <div>Slug</div>
            <div>Status</div>
            <div>Action</div>
          </div>
          <div className="divide-y divide-zinc-200">
            {items.map((p) => (
              <div key={p.id} className="grid grid-cols-[1fr_120px_120px] gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setActiveId(p.id)}
                  className="truncate text-left text-sm font-medium text-zinc-900 hover:underline"
                >
                  {p.slug}
                </button>
                <div className="text-sm text-zinc-700">{p.is_active ? "Active" : "Hidden"}</div>
                <button
                  type="button"
                  onClick={() => void remove(p.id)}
                  className="text-left text-sm font-medium text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="text-base font-semibold text-zinc-900">{activeId ? "Edit page" : "Create page"}</div>
        <form onSubmit={save} className="mt-4 space-y-4">
          <label className="block space-y-1">
            <div className="text-sm font-medium text-zinc-900">Slug</div>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
              placeholder="e.g. about-us, services, contact"
            />
          </label>

          <div className="grid grid-cols-1 gap-3">
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Title (EN)</div>
              <input
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Title (ZH)</div>
              <input
                value={titleZh}
                onChange={(e) => setTitleZh(e.target.value)}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Content (EN)</div>
              <textarea
                value={contentEn}
                onChange={(e) => setContentEn(e.target.value)}
                rows={10}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Content (ZH)</div>
              <textarea
                value={contentZh}
                onChange={(e) => setContentZh(e.target.value)}
                rows={10}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Sort</div>
              <input
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                type="number"
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Active
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Saving..." : "Save"}
          </button>
        </form>
      </div>
    </div>
  );
}

