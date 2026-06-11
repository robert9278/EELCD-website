import { useEffect, useMemo, useState } from "react";

import { supabase, supabaseEnabled } from "@/lib/supabaseClient";
import PageBanner from "@/components/PageBanner";

type AboutSectionKey = "brand_story" | "factory";

type AboutSectionRow = {
  key: AboutSectionKey;
  title_i18n: Record<string, string>;
  content_i18n: Record<string, string>;
  media: { videoUrl?: string; imageUrls?: string[] };
};

type MilestoneRow = {
  id: string;
  event_date: string | null;
  title_i18n: Record<string, string>;
  content_i18n: Record<string, string>;
  sort_order: number;
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

function splitParagraphs(text: string) {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function About() {
  const [sections, setSections] = useState<AboutSectionRow[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const brand = useMemo(() => sections.find((s) => s.key === "brand_story") ?? null, [sections]);
  const factory = useMemo(() => sections.find((s) => s.key === "factory") ?? null, [sections]);
  const factoryMedia = useMemo(() => normalizeMedia(factory?.media), [factory]);

  useEffect(() => {
    if (!supabaseEnabled) return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [s, m] = await Promise.all([
          supabase.rest<AboutSectionRow[]>("about_sections", "?select=key,title_i18n,content_i18n,media&order=key.asc"),
          supabase.rest<MilestoneRow[]>(
            "about_milestones",
            "?select=id,event_date,title_i18n,content_i18n,sort_order&order=sort_order.asc,event_date.desc,created_at.desc"
          ),
        ]);
        setSections(s.data);
        setMilestones(m.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load about content");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <PageBanner title="About Us" subtitle="Brand story, factory introduction, and company milestones." pageKey="about" />
      <div className="mx-auto max-w-6xl space-y-12 px-6 py-16">

        {!supabaseEnabled ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
            Supabase is not configured. Configure environment variables to load About content from admin.
          </div>
        ) : null}

        {loading ? <div className="text-sm text-zinc-600">Loading...</div> : null}
        {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <section className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
          <div className="rounded-2xl border border-zinc-200 bg-white p-8">
            <div className="text-lg font-semibold text-zinc-900">
              {getI18nText(brand?.title_i18n, "en") || getI18nText(brand?.title_i18n, "zh") || "Brand Story"}
            </div>
            <div className="mt-4 space-y-4 text-sm leading-7 text-zinc-700">
              {splitParagraphs(getI18nText(brand?.content_i18n, "en") || getI18nText(brand?.content_i18n, "zh")).map(
                (p, idx) => (
                  <p key={idx}>{p}</p>
                )
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-8">
            <div className="text-lg font-semibold text-zinc-900">
              {getI18nText(factory?.title_i18n, "en") || getI18nText(factory?.title_i18n, "zh") || "Factory"}
            </div>
            <div className="mt-4 space-y-4 text-sm leading-7 text-zinc-700">
              {splitParagraphs(getI18nText(factory?.content_i18n, "en") || getI18nText(factory?.content_i18n, "zh")).map(
                (p, idx) => (
                  <p key={idx}>{p}</p>
                )
              )}
            </div>

            {factoryMedia.videoUrl ? (
              <a
                href={factoryMedia.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex text-sm font-semibold text-emerald-700 underline underline-offset-4"
              >
                Factory video
              </a>
            ) : null}

            {factoryMedia.imageUrls.length > 0 ? (
              <div className="mt-6 grid grid-cols-2 gap-3">
                {factoryMedia.imageUrls.slice(0, 4).map((url) => (
                  <img
                    key={url}
                    src={url}
                    alt=""
                    className="aspect-[4/3] w-full rounded-xl border border-zinc-200 object-cover"
                    loading="lazy"
                  />
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-8">
          <div className="text-lg font-semibold text-zinc-900">Milestones</div>

          {milestones.length === 0 ? (
            <div className="mt-4 text-sm text-zinc-600">No milestones yet. Add them in Admin → About.</div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4">
              {milestones.map((m) => (
                <div key={m.id} className="rounded-xl border border-zinc-200 p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-base font-semibold text-zinc-900">
                      {getI18nText(m.title_i18n, "en") || getI18nText(m.title_i18n, "zh")}
                    </div>
                    <div className="text-xs font-semibold text-zinc-500">{m.event_date ?? ""}</div>
                  </div>
                  <div className="mt-3 space-y-2 text-sm leading-7 text-zinc-700">
                    {splitParagraphs(getI18nText(m.content_i18n, "en") || getI18nText(m.content_i18n, "zh")).map(
                      (p, idx) => (
                        <p key={idx}>{p}</p>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

