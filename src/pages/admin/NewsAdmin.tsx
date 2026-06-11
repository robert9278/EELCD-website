import { FormEvent, useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

type NewsRow = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  summary_i18n: Record<string, string>;
  content_i18n: Record<string, string>;
  cover_image_url: string | null;
  published_at: string | null;
  is_published: boolean;
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

function toDatetimeLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalInput(value: string) {
  if (!value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function NewsAdmin() {
  const [items, setItems] = useState<NewsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = useMemo(() => items.find((n) => n.id === activeId) ?? null, [items, activeId]);

  const [slug, setSlug] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [titleZh, setTitleZh] = useState("");
  const [summaryEn, setSummaryEn] = useState("");
  const [summaryZh, setSummaryZh] = useState("");
  const [contentEn, setContentEn] = useState("");
  const [contentZh, setContentZh] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [publishedAt, setPublishedAt] = useState<string>("");
  const [isPublished, setIsPublished] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!active) return;
    setSlug(active.slug);
    setTitleEn(getI18nText(active.title_i18n, "en"));
    setTitleZh(getI18nText(active.title_i18n, "zh"));
    setSummaryEn(getI18nText(active.summary_i18n, "en"));
    setSummaryZh(getI18nText(active.summary_i18n, "zh"));
    setContentEn(getI18nText(active.content_i18n, "en"));
    setContentZh(getI18nText(active.content_i18n, "zh"));
    setCoverImageUrl(active.cover_image_url ?? "");
    setPublishedAt(toDatetimeLocalInput(active.published_at));
    setIsPublished(active.is_published);
  }, [active]);

  function resetForm() {
    setActiveId(null);
    setSlug("");
    setTitleEn("");
    setTitleZh("");
    setSummaryEn("");
    setSummaryZh("");
    setContentEn("");
    setContentZh("");
    setCoverImageUrl("");
    setPublishedAt("");
    setIsPublished(false);
  }

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.rest<NewsRow[]>("news_posts", "?order=created_at.desc");
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load news");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function uploadCover(file: File) {
    setError(null);
    setBusy(true);
    try {
      const path = `news/${Date.now()}-${file.name}`;
      const { publicUrl } = await supabase.storage.uploadPublic("site-media", path, file);
      setCoverImageUrl(publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (busy) return;
    setBusy(true);
    try {
      const s = safeSlug(slug);
      if (!s) throw new Error("Slug is required");
      if (!titleEn.trim() && !titleZh.trim()) throw new Error("At least one title is required");

      const payload: Partial<NewsRow> & Pick<NewsRow, "slug" | "title_i18n" | "summary_i18n" | "content_i18n" | "is_published"> = {
        slug: s,
        title_i18n: { en: titleEn.trim(), zh: titleZh.trim() },
        summary_i18n: { en: summaryEn.trim(), zh: summaryZh.trim() },
        content_i18n: { en: contentEn.trim(), zh: contentZh.trim() },
        cover_image_url: coverImageUrl.trim() ? coverImageUrl.trim() : null,
        published_at: fromDatetimeLocalInput(publishedAt),
        is_published: isPublished,
      };

      if (activeId) {
        await supabase.rest<NewsRow[]>("news_posts", `?id=eq.${encodeURIComponent(activeId)}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(payload),
        });
      } else {
        const { data } = await supabase.rest<NewsRow[]>("news_posts", "", {
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
      await supabase.rest<void>("news_posts", `?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
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
          <div className="text-lg font-semibold text-zinc-900">News</div>
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            New post
          </button>
        </div>

        {loading ? <div className="text-sm text-zinc-600">Loading...</div> : null}
        {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <div className="grid grid-cols-[1fr_150px_120px] gap-3 border-b border-zinc-200 px-4 py-3 text-xs font-semibold text-zinc-500">
            <div>Title</div>
            <div>Published</div>
            <div>Action</div>
          </div>
          <div className="divide-y divide-zinc-200">
            {items.map((n) => (
              <div key={n.id} className="grid grid-cols-[1fr_150px_120px] gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setActiveId(n.id)}
                  className="truncate text-left text-sm font-medium text-zinc-900 hover:underline"
                >
                  {getI18nText(n.title_i18n, "en") || getI18nText(n.title_i18n, "zh") || n.slug}
                </button>
                <div className="text-sm text-zinc-700">{n.is_published ? "Yes" : "No"}</div>
                <button
                  type="button"
                  onClick={() => void remove(n.id)}
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
        <div className="text-base font-semibold text-zinc-900">{activeId ? "Edit post" : "Create post"}</div>
        <form onSubmit={save} className="mt-4 space-y-4">
          <label className="block space-y-1">
            <div className="text-sm font-medium text-zinc-900">Slug</div>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
              placeholder="e.g. canton-fair-2026"
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
              <div className="text-sm font-medium text-zinc-900">Summary (EN)</div>
              <input
                value={summaryEn}
                onChange={(e) => setSummaryEn(e.target.value)}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Summary (ZH)</div>
              <input
                value={summaryZh}
                onChange={(e) => setSummaryZh(e.target.value)}
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
                rows={7}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Content (ZH)</div>
              <textarea
                value={contentZh}
                onChange={(e) => setContentZh(e.target.value)}
                rows={7}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-zinc-900">Cover image (optional)</div>
            {coverImageUrl ? (
              <img
                src={coverImageUrl}
                alt="Cover"
                className="h-32 w-full rounded-lg border border-zinc-200 object-cover"
              />
            ) : (
              <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-500">
                No cover
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadCover(f);
                e.currentTarget.value = "";
              }}
              className="block w-full text-sm"
            />
            <input
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
              placeholder="Or paste an image URL"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Published at</div>
              <input
                type="datetime-local"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
                <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
                Published
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

