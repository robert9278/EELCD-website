import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { supabase, supabaseEnabled } from "@/lib/supabaseClient";
import PageBanner from "@/components/PageBanner";

type NewsRow = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  summary_i18n: Record<string, string>;
  cover_image_url: string | null;
  published_at: string | null;
};

function getI18nText(obj: Record<string, string> | null | undefined, key: string) {
  return (obj?.[key] ?? "").toString();
}

export default function News() {
  const [items, setItems] = useState<NewsRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseEnabled) return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await supabase.rest<NewsRow[]>(
          "news_posts",
          "?select=id,slug,title_i18n,summary_i18n,cover_image_url,published_at&order=published_at.desc,created_at.desc"
        );
        setItems(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load news");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <PageBanner title="News" subtitle="Exhibition updates and industry highlights." pageKey="news" />
      <div className="mx-auto max-w-6xl space-y-10 px-6 py-16">

        {!supabaseEnabled ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
            Supabase is not configured. News list will show after setting environment variables.
          </div>
        ) : null}

        {loading ? <div className="text-sm text-zinc-600">Loading...</div> : null}
        {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {items.map((n) => (
            <Link
              key={n.id}
              to={`/news/${encodeURIComponent(n.slug)}`}
              className="group overflow-hidden rounded-xl border border-zinc-200 bg-white transition-colors hover:bg-zinc-50"
            >
              {n.cover_image_url ? (
                <img src={n.cover_image_url} alt="" className="h-48 w-full object-cover" loading="lazy" />
              ) : (
                <div className="h-48 w-full bg-zinc-100" />
              )}
              <div className="space-y-2 p-6">
                <div className="text-xs font-semibold text-zinc-500">
                  {n.published_at ? new Date(n.published_at).toLocaleDateString() : ""}
                </div>
                <div className="text-lg font-semibold text-zinc-900 group-hover:underline">
                  {getI18nText(n.title_i18n, "en") || getI18nText(n.title_i18n, "zh") || n.slug}
                </div>
                <div className="text-sm text-zinc-600">
                  {getI18nText(n.summary_i18n, "en") || getI18nText(n.summary_i18n, "zh")}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
