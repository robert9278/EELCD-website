import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import PageBanner from "@/components/PageBanner";
import { useI18n } from "@/lib/i18n";
import { supabase, supabaseEnabled } from "@/lib/supabaseClient";

type SitePageRow = {
  slug: string;
  title_i18n: Record<string, string>;
  content_i18n: Record<string, string>;
  is_active: boolean;
};

export default function PageContent() {
  const { slug } = useParams();
  const { pickI18nText } = useI18n();
  const [row, setRow] = useState<SitePageRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseEnabled) return;
    if (!slug) return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await supabase.rest<SitePageRow[]>(
          "site_pages",
          `?select=slug,title_i18n,content_i18n,is_active&slug=eq.${encodeURIComponent(slug)}&limit=1`
        );
        setRow(data[0] ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load page");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const title = pickI18nText(row?.title_i18n) || slug || "Page";
  const content = pickI18nText(row?.content_i18n) || "";

  return (
    <div>
      <PageBanner title={title} />
      <div className="mx-auto max-w-4xl px-6 py-16">
        {!supabaseEnabled ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
            Supabase is not configured.
          </div>
        ) : null}

        {loading ? <div className="text-sm text-zinc-600">Loading...</div> : null}
        {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        {row && !row.is_active ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">This page is hidden.</div>
        ) : null}

        {content ? (
          <div className="prose max-w-none prose-zinc">
            {content
              .split("\n")
              .filter((p) => p.trim().length > 0)
              .map((p, idx) => (
                <p key={idx}>{p}</p>
              ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

