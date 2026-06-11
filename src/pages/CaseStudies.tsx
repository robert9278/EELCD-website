import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { supabase, supabaseEnabled } from "@/lib/supabaseClient";
import PageBanner from "@/components/PageBanner";

type CaseStudyRow = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  summary_i18n: Record<string, string>;
  media: { coverImageUrl?: string };
  published_at: string | null;
};

function getI18nText(obj: Record<string, string> | null | undefined, key: string) {
  return (obj?.[key] ?? "").toString();
}

function getCover(media: CaseStudyRow["media"] | null | undefined) {
  const url = (media?.coverImageUrl ?? "").toString();
  return url.trim();
}

export default function CaseStudies() {
  const [items, setItems] = useState<CaseStudyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseEnabled) return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await supabase.rest<CaseStudyRow[]>(
          "case_studies",
          "?select=id,slug,title_i18n,summary_i18n,media,published_at&order=sort_order.asc,created_at.desc"
        );
        setItems(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load case studies");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <PageBanner title="Industry Case Studies" subtitle="Delivery stories, strategies, and real-world applications." pageKey="case-studies" />
      <div className="mx-auto max-w-6xl space-y-10 px-6 py-16">

        {!supabaseEnabled ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
            Supabase is not configured. Case studies will show after setting environment variables.
          </div>
        ) : null}

        {loading ? <div className="text-sm text-zinc-600">Loading...</div> : null}
        {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <Link
              key={c.id}
              to={`/case-studies/${encodeURIComponent(c.slug)}`}
              className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-colors hover:bg-zinc-50"
            >
              {getCover(c.media) ? (
                <img src={getCover(c.media)} alt="" className="h-44 w-full object-cover" loading="lazy" />
              ) : (
                <div className="h-44 w-full bg-zinc-100" />
              )}
              <div className="space-y-2 p-6">
                <div className="text-xs font-semibold text-zinc-500">
                  {c.published_at ? new Date(c.published_at).toLocaleDateString() : ""}
                </div>
                <div className="text-lg font-semibold text-zinc-900 group-hover:underline">
                  {getI18nText(c.title_i18n, "en") || getI18nText(c.title_i18n, "zh") || c.slug}
                </div>
                <div className="text-sm text-zinc-600">
                  {getI18nText(c.summary_i18n, "en") || getI18nText(c.summary_i18n, "zh")}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

