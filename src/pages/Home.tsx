import { Link } from "react-router-dom";

import { useEffect, useState } from "react";

import { products } from "@/data/products";
import { supabase, supabaseEnabled } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/i18n";

type BannerRow = {
  id: string;
  title_i18n: Record<string, string>;
  image_url: string;
  link_url: string | null;
  is_primary?: boolean;
};

type PageSnippetRow = {
  slug: string;
  title_i18n: Record<string, string>;
  content_i18n: Record<string, string>;
};

type HomeSettingsRow = {
  key: string;
  hero_headline_i18n: Record<string, string>;
  hero_subhead_i18n: Record<string, string>;
  factory_video_url: string | null;
  factory_video_poster_url: string | null;
  factory_video_caption_i18n: Record<string, string>;
};

type HomeProduct = {
  slug: string;
  name: string;
  imageUrl: string;
};

function getI18nText(obj: Record<string, string> | null | undefined, key: string) {
  return (obj?.[key] ?? "").toString();
}

export default function Home() {
  const { pickI18nText } = useI18n();
  const [banners, setBanners] = useState<BannerRow[]>([]);
  const [bannerLoaded, setBannerLoaded] = useState(!supabaseEnabled);
  const [sloganBlock, setSloganBlock] = useState<PageSnippetRow | null>(null);
  const [deliveryBlock, setDeliveryBlock] = useState<PageSnippetRow | null>(null);
  const [homeSettings, setHomeSettings] = useState<HomeSettingsRow | null>(null);
  const [newProducts, setNewProducts] = useState<HomeProduct[]>([]);

  useEffect(() => {
    if (!supabaseEnabled) {
      setBannerLoaded(true);
      const local = (products ?? [])
        .slice(0, 4)
        .map((p) => ({ slug: p.id, name: p.name, imageUrl: p.images[0]?.url ?? "" }))
        .filter((p) => p.imageUrl.trim().length > 0);
      setNewProducts(local);
      return;
    }
    void (async () => {
      try {
        try {
          const { data } = await supabase.rest<BannerRow[]>(
            "site_banners",
            "?select=id,title_i18n,image_url,link_url,is_primary&placement=eq.home&is_active=eq.true&order=is_primary.desc,sort_order.asc,created_at.desc"
          );
          setBanners(data);
        } catch {
          const { data } = await supabase.rest<BannerRow[]>(
            "site_banners",
            "?select=id,title_i18n,image_url,link_url&order=sort_order.asc,created_at.desc"
          );
          setBanners(data);
        }
      } catch {
        setBanners([]);
      } finally {
        setBannerLoaded(true);
      }

      try {
        const { data } = await supabase.rest<PageSnippetRow[]>(
          "site_pages",
          "?select=slug,title_i18n,content_i18n&slug=in.(home-slogan,home-delivery-process)&is_active=eq.true"
        );
        const slogan = data.find((d) => d.slug === "home-slogan") ?? null;
        const delivery = data.find((d) => d.slug === "home-delivery-process") ?? null;
        setSloganBlock(slogan);
        setDeliveryBlock(delivery);
      } catch {
        setSloganBlock(null);
        setDeliveryBlock(null);
      }

      try {
        const { data } = await supabase.rest<HomeSettingsRow[]>(
          "home_settings",
          "?select=key,hero_headline_i18n,hero_subhead_i18n,factory_video_url,factory_video_poster_url,factory_video_caption_i18n&key=eq.default&limit=1"
        );
        setHomeSettings(data[0] ?? null);
      } catch {
        setHomeSettings(null);
      }

      try {
        const { data } = await supabase.rest<
          {
            slug: string;
            name_i18n: Record<string, string>;
            product_media?: { kind: string; url: string; sort_order: number; is_primary: boolean }[];
          }[]
        >(
          "products",
          "?select=slug,name_i18n,product_media(kind,url,sort_order,is_primary)&is_active=eq.true&order=created_at.desc&limit=8"
        );

        const items = (data || [])
          .map((p) => {
            const media = (p.product_media ?? []).filter((m) => m.kind === "image");
            media.sort((a, b) => (a.is_primary === b.is_primary ? a.sort_order - b.sort_order : a.is_primary ? -1 : 1));
            return {
              slug: p.slug,
              name: pickI18nText(p.name_i18n) || p.slug,
              imageUrl: media[0]?.url ?? "",
            } satisfies HomeProduct;
          })
          .filter((p) => p.imageUrl.trim().length > 0)
          .slice(0, 4);

        setNewProducts(items);
      } catch {
        setNewProducts([]);
      }
    })();
  }, [pickI18nText]);

  const heroBanner = banners[0] ?? null;
  const heroImageUrl = heroBanner?.image_url?.toString().trim() || "";

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="space-y-14">
        {supabaseEnabled && bannerLoaded && heroImageUrl ? (
          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
            <div className="relative aspect-[21/9]">
              {heroBanner?.link_url ? (
                <a href={heroBanner.link_url} className="absolute inset-0">
                  <img src={heroImageUrl} alt="" className="h-full w-full object-cover" />
                  <span className="sr-only">Open banner link</span>
                </a>
              ) : (
                <img src={heroImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              )}
            </div>
          </section>
        ) : null}

        <section className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
          <div className="space-y-5">
            <div className="text-sm font-medium text-zinc-500">Tech Hardware Supplier</div>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              <span className="ee-hero-gradient">
                {pickI18nText(homeSettings?.hero_headline_i18n) ||
                  "Custom TFT-LCD, OLED, PCAP, EPD & Mechanical Parts"}
              </span>
            </h1>
            <p className="max-w-xl text-base text-zinc-600">
              {pickI18nText(homeSettings?.hero_subhead_i18n) ||
                "We provide batch customization and stable delivery for customers across Europe, America, Africa, and Southeast Asia."}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/inquiry"
                className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
              >
                Inquiry
              </Link>
              <Link
                to="/products"
                className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-50"
              >
                View Products
              </Link>
            </div>
          </div>

          <div className="w-full max-w-md justify-self-start lg:justify-self-end">
            <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
              <div className="pointer-events-none absolute -left-24 -top-24 h-56 w-56 rounded-full bg-cyan-400/20 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-24 -right-24 h-56 w-56 rounded-full bg-violet-500/20 blur-2xl" />
              <div className="aspect-[16/10] bg-gradient-to-br from-white/60 via-zinc-50 to-white/60">
                {homeSettings?.factory_video_url ? (
                  <video
                    src={homeSettings.factory_video_url}
                    poster={homeSettings.factory_video_poster_url || undefined}
                    controls
                    playsInline
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="border-t border-zinc-200 p-4 text-sm text-zinc-600">
                {pickI18nText(homeSettings?.factory_video_caption_i18n) || "Factory introduction video"}
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <div className="text-sm font-semibold text-zinc-900">
              {getI18nText(sloganBlock?.title_i18n, "en") || getI18nText(sloganBlock?.title_i18n, "zh") || "SLOGAN"}
            </div>
            <div className="mt-2 text-sm text-zinc-600">
              {getI18nText(sloganBlock?.content_i18n, "en") ||
                getI18nText(sloganBlock?.content_i18n, "zh") ||
                "Quality first, stable supply, fast customization."}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <div className="text-sm font-semibold text-zinc-900">
              {getI18nText(deliveryBlock?.title_i18n, "en") ||
                getI18nText(deliveryBlock?.title_i18n, "zh") ||
                "Delivery Process"}
            </div>
            <div className="mt-2 text-sm text-zinc-600">
              {getI18nText(deliveryBlock?.content_i18n, "en") ||
                getI18nText(deliveryBlock?.content_i18n, "zh") ||
                "Requirement → DFM → Sample → Mass production → Shipping"}
            </div>
          </div>
          <Link to="/news" className="rounded-xl border border-zinc-200 bg-white p-6 transition-colors hover:bg-zinc-50">
            <div className="text-sm font-semibold text-zinc-900">News</div>
            <div className="mt-2 text-sm text-zinc-600">Click to view latest company news and industry updates.</div>
          </Link>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="text-lg font-semibold text-zinc-900">New products & updates</div>
              <div className="text-sm text-zinc-600">Showcase new products and latest news here.</div>
            </div>
            <div className="flex gap-3">
              <Link
                to="/products?view=new"
                className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                New Products
              </Link>
              <Link
                to="/case-studies"
                className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                Case Studies
              </Link>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, idx) => {
              const p = newProducts[idx];
              if (!p) {
                return (
                  <div
                    key={idx}
                    className="aspect-[4/3] overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50"
                  />
                );
              }

              return (
                <Link
                  key={p.slug}
                  to={`/products/${encodeURIComponent(p.slug)}`}
                  className="group overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-gradient-to-br from-zinc-50 via-white to-emerald-50/40">
                    <img
                      src={p.imageUrl}
                      alt=""
                      className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                  </div>
                  <div className="border-t border-emerald-100 bg-gradient-to-r from-white via-emerald-50/70 to-cyan-50/70 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span className="h-px flex-1 bg-gradient-to-r from-emerald-300 via-cyan-200 to-transparent" />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs font-medium uppercase tracking-[0.28em] text-zinc-400">Featured</span>
                      <span className="rounded-full border border-emerald-100 bg-white/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                        View
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
