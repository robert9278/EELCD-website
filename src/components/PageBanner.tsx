import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { supabase, supabaseEnabled } from "@/lib/supabaseClient";

type Props = {
  title: string;
  subtitle?: string;
  backTo?: { label: string; href: string };
  pageKey?: "about" | "products" | "news" | "case-studies" | "services" | "contact" | "shop";
};

export default function PageBanner({ title, subtitle, backTo, pageKey }: Props) {
  const fallbackUrl = useMemo(() => {
    if (!pageKey) return "";
    const map: Record<string, string> = {
      about: "/banners/about.svg",
      products: "/banners/products.svg",
      news: "/banners/news.svg",
      "case-studies": "/banners/case-studies.svg",
      services: "/banners/services.svg",
      contact: "/banners/contact.svg",
      shop: "/banners/shop.svg",
    };
    return map[pageKey] ?? "";
  }, [pageKey]);

  const [imageUrl, setImageUrl] = useState<string>(fallbackUrl);

  useEffect(() => {
    setImageUrl(fallbackUrl);
  }, [fallbackUrl]);

  useEffect(() => {
    if (!pageKey) return;
    if (!supabaseEnabled) return;
    void (async () => {
      try {
        const { data } = await supabase.rest<{ image_url: string }[]>(
          "site_banners",
          `?select=image_url&placement=eq.page&page_key=eq.${encodeURIComponent(pageKey)}&is_active=eq.true&limit=1`
        );
        const url = data?.[0]?.image_url?.toString() ?? "";
        if (url.trim()) setImageUrl(url.trim());
      } catch {
        setImageUrl(fallbackUrl);
      }
    })();
  }, [pageKey, fallbackUrl]);

  const showText = !pageKey;

  return (
    <div className="mx-auto max-w-6xl px-6 pt-10">
      <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-r from-zinc-900 via-slate-900 to-zinc-900">
        <div className="relative h-[180px] sm:h-[200px]">
          {imageUrl ? <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/70 via-zinc-950/40 to-zinc-950/70" />
          {showText ? (
            <div className="relative h-full px-6 py-10">
              {backTo ? (
                <Link to={backTo.href} className="text-sm font-semibold text-cyan-200/90 hover:text-cyan-100">
                  {backTo.label}
                </Link>
              ) : null}
              <div className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{title}</div>
              {subtitle ? <div className="mt-2 max-w-3xl text-sm text-zinc-200/80">{subtitle}</div> : null}
            </div>
          ) : (
            <div className="sr-only">{title}</div>
          )}
        </div>
      </div>
    </div>
  );
}
