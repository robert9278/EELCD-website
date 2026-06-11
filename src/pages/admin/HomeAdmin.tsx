import { FormEvent, useEffect, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

type HomeSettingsRow = {
  key: string;
  hero_headline_i18n: Record<string, string>;
  hero_subhead_i18n: Record<string, string>;
  factory_video_url: string | null;
  factory_video_poster_url: string | null;
  factory_video_caption_i18n: Record<string, string>;
  is_active: boolean;
};

function getI18nText(obj: Record<string, string> | null | undefined, key: string) {
  return (obj?.[key] ?? "").toString();
}

export default function HomeAdmin() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [headlineEn, setHeadlineEn] = useState("");
  const [headlineZh, setHeadlineZh] = useState("");
  const [subheadEn, setSubheadEn] = useState("");
  const [subheadZh, setSubheadZh] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [posterUrl, setPosterUrl] = useState("");
  const [captionEn, setCaptionEn] = useState("");
  const [captionZh, setCaptionZh] = useState("");
  const [isActive, setIsActive] = useState(true);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.rest<HomeSettingsRow[]>(
        "home_settings",
        "?select=key,hero_headline_i18n,hero_subhead_i18n,factory_video_url,factory_video_poster_url,factory_video_caption_i18n,is_active&key=eq.default&limit=1"
      );
      const row = data[0];
      if (row) {
        setHeadlineEn(getI18nText(row.hero_headline_i18n, "en"));
        setHeadlineZh(getI18nText(row.hero_headline_i18n, "zh"));
        setSubheadEn(getI18nText(row.hero_subhead_i18n, "en"));
        setSubheadZh(getI18nText(row.hero_subhead_i18n, "zh"));
        setVideoUrl(row.factory_video_url ?? "");
        setPosterUrl(row.factory_video_poster_url ?? "");
        setCaptionEn(getI18nText(row.factory_video_caption_i18n, "en"));
        setCaptionZh(getI18nText(row.factory_video_caption_i18n, "zh"));
        setIsActive(row.is_active);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load home settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function upload(kind: "video" | "poster", file: File) {
    setBusy(true);
    setError(null);
    try {
      const prefix = kind === "video" ? "videos" : "images";
      const path = `${prefix}/${Date.now()}-${file.name}`;
      const uploaded = await supabase.storage.uploadPublic("site-media", path, file);
      if (kind === "video") setVideoUrl(uploaded.publicUrl);
      else setPosterUrl(uploaded.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await supabase.rest<HomeSettingsRow[]>("home_settings", "?key=eq.default", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({
          hero_headline_i18n: { en: headlineEn.trim(), zh: headlineZh.trim() },
          hero_subhead_i18n: { en: subheadEn.trim(), zh: subheadZh.trim() },
          factory_video_url: videoUrl.trim() || null,
          factory_video_poster_url: posterUrl.trim() || null,
          factory_video_caption_i18n: { en: captionEn.trim(), zh: captionZh.trim() },
          is_active: isActive,
        }),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6">
      <div className="text-base font-semibold text-zinc-900">Home</div>
      <div className="mt-1 text-sm text-zinc-600">Edit homepage headline and factory video.</div>

      {loading ? <div className="mt-4 text-sm text-zinc-600">Loading...</div> : null}
      {error ? <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <form onSubmit={save} className="mt-5 space-y-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <label className="block space-y-1">
            <div className="text-sm font-medium text-zinc-900">Headline (EN)</div>
            <input
              value={headlineEn}
              onChange={(e) => setHeadlineEn(e.target.value)}
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
            />
          </label>
          <label className="block space-y-1">
            <div className="text-sm font-medium text-zinc-900">Headline (ZH)</div>
            <input
              value={headlineZh}
              onChange={(e) => setHeadlineZh(e.target.value)}
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
            />
          </label>
          <label className="block space-y-1">
            <div className="text-sm font-medium text-zinc-900">Subhead (EN)</div>
            <textarea
              value={subheadEn}
              onChange={(e) => setSubheadEn(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
            />
          </label>
          <label className="block space-y-1">
            <div className="text-sm font-medium text-zinc-900">Subhead (ZH)</div>
            <textarea
              value={subheadZh}
              onChange={(e) => setSubheadZh(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
            />
          </label>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="text-sm font-semibold text-zinc-900">Factory Video</div>

          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-500">Video URL</div>
              <input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50">
                Upload video
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.currentTarget.files?.[0];
                    if (!f) return;
                    void upload("video", f);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-500">Poster URL (optional)</div>
              <input
                value={posterUrl}
                onChange={(e) => setPosterUrl(e.target.value)}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50">
                Upload poster
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.currentTarget.files?.[0];
                    if (!f) return;
                    void upload("poster", f);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Caption (EN)</div>
              <input
                value={captionEn}
                onChange={(e) => setCaptionEn(e.target.value)}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Caption (ZH)</div>
              <input
                value={captionZh}
                onChange={(e) => setCaptionZh(e.target.value)}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
          </div>

          <div className="mt-4">
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
  );
}

