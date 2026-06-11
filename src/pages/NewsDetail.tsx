import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { supabase, supabaseEnabled } from "@/lib/supabaseClient";
import PageBanner from "@/components/PageBanner";

type NewsRow = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  content_i18n: Record<string, string>;
  cover_image_url: string | null;
  published_at: string | null;
};

function getI18nText(obj: Record<string, string> | null | undefined, key: string) {
  return (obj?.[key] ?? "").toString();
}

export default function NewsDetail() {
  const { slug } = useParams();
  const [item, setItem] = useState<NewsRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseEnabled) return;
    if (!slug) return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await supabase.rest<NewsRow[]>(
          "news_posts",
          `?select=id,slug,title_i18n,content_i18n,cover_image_url,published_at&slug=eq.${encodeURIComponent(slug)}&limit=1`
        );
        setItem(data[0] ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load news");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  return (
    <div>
      <PageBanner title="News" backTo={{ label: "Back to News", href: "/news" }} />
      <div className="mx-auto max-w-4xl space-y-8 px-6 py-16">

        {!supabaseEnabled ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
            Supabase is not configured.
          </div>
        ) : null}

        {loading ? <div className="text-sm text-zinc-600">Loading...</div> : null}
        {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        {item ? (
          <article className="space-y-6">
            {item.cover_image_url ? (
              <img src={item.cover_image_url} alt="" className="h-64 w-full rounded-2xl object-cover" />
            ) : null}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-500">
                {item.published_at ? new Date(item.published_at).toLocaleDateString() : ""}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
                {getI18nText(item.title_i18n, "en") || getI18nText(item.title_i18n, "zh") || item.slug}
              </h1>
            </div>
            <div className="prose max-w-none prose-zinc">
              {(getI18nText(item.content_i18n, "en") || getI18nText(item.content_i18n, "zh"))
                .split("\n")
                .filter((p) => p.trim().length > 0)
                .map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
            </div>
          </article>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">Not found.</div>
        )}
      </div>
    </div>
  );
}
