import { FormEvent, useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

type AboutSectionKey = "brand_story" | "factory";

type AboutSectionRow = {
  key: AboutSectionKey;
  title_i18n: Record<string, string>;
  content_i18n: Record<string, string>;
  media: { videoUrl?: string; imageUrls?: string[] };
  is_active: boolean;
  updated_at: string;
};

type MilestoneRow = {
  id: string;
  event_date: string | null;
  title_i18n: Record<string, string>;
  content_i18n: Record<string, string>;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function getI18nText(obj: Record<string, string> | null | undefined, key: string) {
  return (obj?.[key] ?? "").toString();
}

function normalizeMedia(media: AboutSectionRow["media"] | null | undefined) {
  return {
    videoUrl: (media?.videoUrl ?? "").toString(),
    imageUrls: Array.isArray(media?.imageUrls) ? media?.imageUrls.filter((u) => typeof u === "string") : [],
  };
}

export default function AboutAdmin() {
  const [sections, setSections] = useState<AboutSectionRow[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const brand = useMemo(() => sections.find((s) => s.key === "brand_story") ?? null, [sections]);
  const factory = useMemo(() => sections.find((s) => s.key === "factory") ?? null, [sections]);

  const [brandTitleEn, setBrandTitleEn] = useState("");
  const [brandTitleZh, setBrandTitleZh] = useState("");
  const [brandContentEn, setBrandContentEn] = useState("");
  const [brandContentZh, setBrandContentZh] = useState("");
  const [brandActive, setBrandActive] = useState(true);

  const [factoryTitleEn, setFactoryTitleEn] = useState("");
  const [factoryTitleZh, setFactoryTitleZh] = useState("");
  const [factoryContentEn, setFactoryContentEn] = useState("");
  const [factoryContentZh, setFactoryContentZh] = useState("");
  const [factoryVideoUrl, setFactoryVideoUrl] = useState("");
  const [factoryImages, setFactoryImages] = useState<string[]>([]);
  const [factoryActive, setFactoryActive] = useState(true);

  const [msActiveId, setMsActiveId] = useState<string | null>(null);
  const activeMs = useMemo(() => milestones.find((m) => m.id === msActiveId) ?? null, [milestones, msActiveId]);

  const [msDate, setMsDate] = useState("");
  const [msTitleEn, setMsTitleEn] = useState("");
  const [msTitleZh, setMsTitleZh] = useState("");
  const [msContentEn, setMsContentEn] = useState("");
  const [msContentZh, setMsContentZh] = useState("");
  const [msSort, setMsSort] = useState(0);
  const [msIsActive, setMsIsActive] = useState(true);

  useEffect(() => {
    if (!brand) return;
    setBrandTitleEn(getI18nText(brand.title_i18n, "en"));
    setBrandTitleZh(getI18nText(brand.title_i18n, "zh"));
    setBrandContentEn(getI18nText(brand.content_i18n, "en"));
    setBrandContentZh(getI18nText(brand.content_i18n, "zh"));
    setBrandActive(brand.is_active);
  }, [brand]);

  useEffect(() => {
    if (!factory) return;
    const media = normalizeMedia(factory.media);
    setFactoryTitleEn(getI18nText(factory.title_i18n, "en"));
    setFactoryTitleZh(getI18nText(factory.title_i18n, "zh"));
    setFactoryContentEn(getI18nText(factory.content_i18n, "en"));
    setFactoryContentZh(getI18nText(factory.content_i18n, "zh"));
    setFactoryVideoUrl(media.videoUrl);
    setFactoryImages(media.imageUrls);
    setFactoryActive(factory.is_active);
  }, [factory]);

  useEffect(() => {
    if (!activeMs) return;
    setMsDate(activeMs.event_date ?? "");
    setMsTitleEn(getI18nText(activeMs.title_i18n, "en"));
    setMsTitleZh(getI18nText(activeMs.title_i18n, "zh"));
    setMsContentEn(getI18nText(activeMs.content_i18n, "en"));
    setMsContentZh(getI18nText(activeMs.content_i18n, "zh"));
    setMsSort(activeMs.sort_order);
    setMsIsActive(activeMs.is_active);
  }, [activeMs]);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const [s, m] = await Promise.all([
        supabase.rest<AboutSectionRow[]>("about_sections", "?order=key.asc"),
        supabase.rest<MilestoneRow[]>("about_milestones", "?order=sort_order.asc,event_date.desc,created_at.desc"),
      ]);
      setSections(s.data);
      setMilestones(m.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load about content");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function uploadToSiteMedia(prefix: string, file: File) {
    const path = `${prefix}/${Date.now()}-${file.name}`;
    const { publicUrl } = await supabase.storage.uploadPublic("site-media", path, file);
    return publicUrl;
  }

  async function saveBrand(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (busy) return;
    setBusy(true);
    try {
      await supabase.rest<AboutSectionRow[]>("about_sections", "?key=eq.brand_story", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({
          title_i18n: { en: brandTitleEn.trim(), zh: brandTitleZh.trim() },
          content_i18n: { en: brandContentEn.trim(), zh: brandContentZh.trim() },
          is_active: brandActive,
          media: {},
        }),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveFactory(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (busy) return;
    setBusy(true);
    try {
      await supabase.rest<AboutSectionRow[]>("about_sections", "?key=eq.factory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({
          title_i18n: { en: factoryTitleEn.trim(), zh: factoryTitleZh.trim() },
          content_i18n: { en: factoryContentEn.trim(), zh: factoryContentZh.trim() },
          is_active: factoryActive,
          media: { videoUrl: factoryVideoUrl.trim(), imageUrls: factoryImages },
        }),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  function resetMilestoneForm() {
    setMsActiveId(null);
    setMsDate("");
    setMsTitleEn("");
    setMsTitleZh("");
    setMsContentEn("");
    setMsContentZh("");
    setMsSort(0);
    setMsIsActive(true);
  }

  async function saveMilestone(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (busy) return;
    setBusy(true);
    try {
      if (!msTitleEn.trim() && !msTitleZh.trim()) throw new Error("At least one milestone title is required");

      const payload = {
        event_date: msDate.trim() ? msDate.trim() : null,
        title_i18n: { en: msTitleEn.trim(), zh: msTitleZh.trim() },
        content_i18n: { en: msContentEn.trim(), zh: msContentZh.trim() },
        sort_order: Number.isFinite(msSort) ? msSort : 0,
        is_active: msIsActive,
      };

      if (msActiveId) {
        await supabase.rest<MilestoneRow[]>("about_milestones", `?id=eq.${encodeURIComponent(msActiveId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify(payload),
        });
      } else {
        const { data } = await supabase.rest<MilestoneRow[]>("about_milestones", "", {
          method: "POST",
          headers: { "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify([payload]),
        });
        if (data[0]?.id) setMsActiveId(data[0].id);
      }

      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeMilestone(id: string) {
    setError(null);
    if (busy) return;
    setBusy(true);
    try {
      await supabase.rest<void>("about_milestones", `?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
      if (msActiveId === id) resetMilestoneForm();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-10">
      {loading ? <div className="text-sm text-zinc-600">Loading...</div> : null}
      {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="text-base font-semibold text-zinc-900">Brand Story</div>
          <form onSubmit={saveBrand} className="mt-4 space-y-4">
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Title (EN)</div>
              <input
                value={brandTitleEn}
                onChange={(e) => setBrandTitleEn(e.target.value)}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Title (ZH)</div>
              <input
                value={brandTitleZh}
                onChange={(e) => setBrandTitleZh(e.target.value)}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Content (EN)</div>
              <textarea
                value={brandContentEn}
                onChange={(e) => setBrandContentEn(e.target.value)}
                rows={8}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Content (ZH)</div>
              <textarea
                value={brandContentZh}
                onChange={(e) => setBrandContentZh(e.target.value)}
                rows={8}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" checked={brandActive} onChange={(e) => setBrandActive(e.target.checked)} />
              Active
            </label>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? "Saving..." : "Save"}
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="text-base font-semibold text-zinc-900">Factory</div>
          <form onSubmit={saveFactory} className="mt-4 space-y-4">
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Title (EN)</div>
              <input
                value={factoryTitleEn}
                onChange={(e) => setFactoryTitleEn(e.target.value)}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Title (ZH)</div>
              <input
                value={factoryTitleZh}
                onChange={(e) => setFactoryTitleZh(e.target.value)}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Content (EN)</div>
              <textarea
                value={factoryContentEn}
                onChange={(e) => setFactoryContentEn(e.target.value)}
                rows={6}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Content (ZH)</div>
              <textarea
                value={factoryContentZh}
                onChange={(e) => setFactoryContentZh(e.target.value)}
                rows={6}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>

            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Video URL (optional)</div>
              <input
                value={factoryVideoUrl}
                onChange={(e) => setFactoryVideoUrl(e.target.value)}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                placeholder="https://..."
              />
            </label>

            <div className="space-y-2">
              <div className="text-sm font-medium text-zinc-900">Factory images</div>
              <input
                type="file"
                accept="image/*"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  void (async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      const url = await uploadToSiteMedia("about/factory", f);
                      setFactoryImages((prev) => [...prev, url]);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Upload failed");
                    } finally {
                      setBusy(false);
                    }
                  })();
                  e.currentTarget.value = "";
                }}
                className="block w-full text-sm"
              />
              <div className="space-y-2">
                {factoryImages.map((url) => (
                  <div key={url} className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 p-3">
                    <a href={url} target="_blank" rel="noreferrer" className="truncate text-sm text-zinc-800 hover:underline">
                      {url}
                    </a>
                    <button
                      type="button"
                      onClick={() => setFactoryImages((prev) => prev.filter((u) => u !== url))}
                      className="text-sm font-medium text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" checked={factoryActive} onChange={(e) => setFactoryActive(e.target.checked)} />
              Active
            </label>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? "Saving..." : "Save"}
            </button>
          </form>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-base font-semibold text-zinc-900">Milestones</div>
          <button
            type="button"
            onClick={resetMilestoneForm}
            className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            New milestone
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_520px]">
          <div className="overflow-hidden rounded-xl border border-zinc-200">
            <div className="grid grid-cols-[160px_1fr_120px] gap-3 border-b border-zinc-200 bg-white px-4 py-3 text-xs font-semibold text-zinc-500">
              <div>Date</div>
              <div>Title</div>
              <div>Action</div>
            </div>
            <div className="divide-y divide-zinc-200 bg-white">
              {milestones.map((m) => (
                <div key={m.id} className="grid grid-cols-[160px_1fr_120px] gap-3 px-4 py-3">
                  <div className="text-sm text-zinc-700">{m.event_date ?? ""}</div>
                  <button
                    type="button"
                    onClick={() => setMsActiveId(m.id)}
                    className="truncate text-left text-sm font-medium text-zinc-900 hover:underline"
                  >
                    {getI18nText(m.title_i18n, "en") || getI18nText(m.title_i18n, "zh")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeMilestone(m.id)}
                    className="text-left text-sm font-medium text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <div className="text-base font-semibold text-zinc-900">{msActiveId ? "Edit" : "Create"}</div>
            <form onSubmit={saveMilestone} className="mt-4 space-y-4">
              <label className="block space-y-1">
                <div className="text-sm font-medium text-zinc-900">Event date (optional)</div>
                <input
                  type="date"
                  value={msDate}
                  onChange={(e) => setMsDate(e.target.value)}
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                />
              </label>
              <label className="block space-y-1">
                <div className="text-sm font-medium text-zinc-900">Title (EN)</div>
                <input
                  value={msTitleEn}
                  onChange={(e) => setMsTitleEn(e.target.value)}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                />
              </label>
              <label className="block space-y-1">
                <div className="text-sm font-medium text-zinc-900">Title (ZH)</div>
                <input
                  value={msTitleZh}
                  onChange={(e) => setMsTitleZh(e.target.value)}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                />
              </label>
              <label className="block space-y-1">
                <div className="text-sm font-medium text-zinc-900">Content (EN)</div>
                <textarea
                  value={msContentEn}
                  onChange={(e) => setMsContentEn(e.target.value)}
                  rows={5}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                />
              </label>
              <label className="block space-y-1">
                <div className="text-sm font-medium text-zinc-900">Content (ZH)</div>
                <textarea
                  value={msContentZh}
                  onChange={(e) => setMsContentZh(e.target.value)}
                  rows={5}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <div className="text-sm font-medium text-zinc-900">Sort</div>
                  <input
                    type="number"
                    value={msSort}
                    onChange={(e) => setMsSort(Number(e.target.value))}
                    className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                  />
                </label>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
                    <input type="checkbox" checked={msIsActive} onChange={(e) => setMsIsActive(e.target.checked)} />
                    Active
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="inline-flex w-full items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? "Saving..." : "Save"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

