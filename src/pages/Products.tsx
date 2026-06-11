import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { productCategories, products } from "@/data/products";
import { supabase, supabaseEnabled } from "@/lib/supabaseClient";
import PageBanner from "@/components/PageBanner";

const fallbackSizeOptions = [
  "0.96",
  "1.0",
  "1.3",
  "1.54",
  "1.77",
  "2.0",
  "2.1",
  "2.3",
  "2.4",
  "2.7",
  "2.8",
  "3.0",
  "3.1",
  "3.4",
  "3.5",
  "3.6",
  "3.9",
  "3.95",
  "3.97",
  "3.99",
  "4.0",
  "4.3",
  "5.0",
  "5.65",
  "6.26",
  "6.86",
  "7.0",
  "7.84",
  "8.0",
  "8.4",
  "10.1",
  "10.4",
  "11.6",
  "12.1",
  "13.3",
  "15.0",
  "15.6",
  "18.5",
  "21.5",
] as const;

const fallbackResolutionOptions = [
  "80*160",
  "128*115",
  "128*160",
  "240*240",
  "240*320",
  "240*480",
  "320*240",
  "320*320",
  "320*480",
  "360*640",
  "400*960",
  "400*1280",
  "480*128",
  "480*272",
  "480*360",
  "480*480",
  "480*640",
  "480*800",
  "480*1280",
  "640*240",
  "640*480",
  "720*720",
  "720*1280",
  "800*480",
  "800*600",
  "800*800",
  "800*1280",
  "1024*600",
  "1024*768",
  "1080*1080",
  "1280*800",
  "1920*1080",
  "1920*1200",
] as const;

const fallbackLcdTypeOptions = ["TN", "IPS", "Transflective"] as const;

const fallbackLuminanceOptions = [
  "<300 cd/m²",
  "≥300~<500 cd/m²",
  "≥500~<750 cd/m²",
  "≥750~<1000 cd/m²",
  "≥1000 cd/m²",
] as const;

const fallbackTempOptions = ["< -30~80°C", "≥ -30~80°C"] as const;

type ProductRow = {
  id: string;
  slug: string;
  category: string;
  model: string | null;
  in_stock: boolean;
  name_i18n: Record<string, string>;
  short_description_i18n: Record<string, string>;
  spec_size: string | null;
  spec_resolution: string | null;
  spec_lcd_type: string | null;
  spec_luminance: string | null;
  spec_operating_temp: string | null;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
};

type ProductMediaRow = {
  id: string;
  product_id: string;
  kind: string;
  url: string;
  sort_order: number;
  is_primary: boolean;
};

type ProductAttachmentRow = {
  id: string;
  product_id: string;
  kind: string;
  url: string;
  label_i18n: Record<string, string>;
  file_name: string | null;
};

type ProductWithRelations = ProductRow & {
  product_media?: ProductMediaRow[];
  product_attachments?: ProductAttachmentRow[];
};

type ProductCard = {
  id: string;
  slug?: string;
  name: string;
  category: string;
  model?: string;
  inStock?: boolean;
  shortDescription: string;
  specSize?: string;
  specResolution?: string;
  specLcdType?: string;
  specLuminance?: string;
  specOperatingTemp?: string;
  images: { url: string; alt: string }[];
  videoUrl: string;
  attachments: { label: string; url: string }[];
};

type SpecOptions = {
  size: string[];
  resolution: string[];
  lcdType: string[];
  luminance: string[];
  temp: string[];
};

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function normalizeText(v: string) {
  return v.trim().toLowerCase().replace(/\s+/g, "");
}

function parseFirstNumber(v: string) {
  const m = v.match(/(\d+(\.\d+)?)/);
  if (!m) return Number.NaN;
  return Number.parseFloat(m[1]!);
}

function normalizeResolution(v: string) {
  return normalizeText(v).replace(/[x×*]/g, "*");
}

function resolutionVariants(input: string) {
  const v = input.trim();
  if (!v) return [];
  const vars = new Set<string>();
  const base = v.replace(/\s+/g, "");
  vars.add(base);
  vars.add(base.replace(/\*/g, "×"));
  vars.add(base.replace(/\*/g, "x"));
  vars.add(base.replace(/\*/g, "X"));
  vars.add(base.replace(/×/g, "*"));
  vars.add(base.replace(/×/g, "x"));
  vars.add(base.replace(/×/g, "X"));
  vars.add(base.replace(/x/gi, "*"));
  vars.add(base.replace(/x/gi, "×"));
  return Array.from(vars).filter((s) => s.trim().length > 0);
}

function uniqNonEmpty(values: Array<string | null | undefined>) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const s = (v ?? "").toString().trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function sortByKnownOrder(values: string[], order: readonly string[]) {
  const idx = new Map(order.map((v, i) => [v.toLowerCase(), i] as const));
  return [...values].sort((a, b) => {
    const ai = idx.get(a.toLowerCase());
    const bi = idx.get(b.toLowerCase());
    if (ai != null && bi != null) return ai - bi;
    if (ai != null) return -1;
    if (bi != null) return 1;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  });
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        "rounded-full border px-3 py-1.5 text-sm transition-colors",
        active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
      )}
    >
      {label}
    </button>
  );
}

export default function Products() {
  const [params, setParams] = useSearchParams();
  const rawCategory = (params.get("category") ?? "").trim().toUpperCase();
  const category = rawCategory === "FTP" ? "TFT" : rawCategory;
  const view = (params.get("view") ?? "").toLowerCase();
  const isNewView = view === "new";
  const fSize = (params.get("size") ?? "").trim();
  const fResolution = (params.get("resolution") ?? "").trim();
  const fLcdType = (params.get("lcdType") ?? "").trim();
  const fLuminance = (params.get("luminance") ?? "").trim();
  const fTemp = (params.get("temp") ?? "").trim();

  const [remote, setRemote] = useState<ProductWithRelations[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [specOptions, setSpecOptions] = useState<SpecOptions>(() => {
    return {
      size: [...fallbackSizeOptions],
      resolution: [...fallbackResolutionOptions],
      lcdType: [...fallbackLcdTypeOptions],
      luminance: [...fallbackLuminanceOptions],
      temp: [...fallbackTempOptions],
    };
  });

  const activeCategory = productCategories.find((c) => c.key === category);

  function setOrDelete(k: string, v: string) {
    const next = new URLSearchParams(params);
    const val = v.trim();
    if (val) next.set(k, val);
    else next.delete(k);
    setParams(next);
  }

  useEffect(() => {
    if (!supabaseEnabled) {
      const size = uniqNonEmpty(products.map((p) => p.specSize ?? ""));
      size.sort((a, b) => {
        const an = parseFirstNumber(a);
        const bn = parseFirstNumber(b);
        if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
        if (Number.isFinite(an)) return -1;
        if (Number.isFinite(bn)) return 1;
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
      });

      const resolution = uniqNonEmpty(products.map((p) => p.specResolution ?? ""));
      resolution.sort((a, b) => {
        const [aw, ah] = normalizeResolution(a).split("*").map((n) => Number.parseInt(n, 10));
        const [bw, bh] = normalizeResolution(b).split("*").map((n) => Number.parseInt(n, 10));
        const ap = Number.isFinite(aw) && Number.isFinite(ah) ? aw * ah : Number.NaN;
        const bp = Number.isFinite(bw) && Number.isFinite(bh) ? bw * bh : Number.NaN;
        if (Number.isFinite(ap) && Number.isFinite(bp)) return ap - bp;
        if (Number.isFinite(ap)) return -1;
        if (Number.isFinite(bp)) return 1;
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
      });

      setSpecOptions({
        size: size.length ? size : [...fallbackSizeOptions],
        resolution: resolution.length ? resolution : [...fallbackResolutionOptions],
        lcdType: sortByKnownOrder(uniqNonEmpty(products.map((p) => p.specLcdType ?? "")), fallbackLcdTypeOptions),
        luminance: sortByKnownOrder(uniqNonEmpty(products.map((p) => p.specLuminance ?? "")), fallbackLuminanceOptions),
        temp: sortByKnownOrder(uniqNonEmpty(products.map((p) => p.specOperatingTemp ?? "")), fallbackTempOptions),
      });
      return;
    }

    void (async () => {
      try {
        const { data } = await supabase.rest<
          {
            spec_size: string | null;
            spec_resolution: string | null;
            spec_lcd_type: string | null;
            spec_luminance: string | null;
            spec_operating_temp: string | null;
          }[]
        >(
          "products",
          "?select=spec_size,spec_resolution,spec_lcd_type,spec_luminance,spec_operating_temp&is_active=eq.true&limit=1000"
        );

        const size = uniqNonEmpty(data.map((r) => r.spec_size));
        size.sort((a, b) => {
          const an = parseFirstNumber(a);
          const bn = parseFirstNumber(b);
          if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
          if (Number.isFinite(an)) return -1;
          if (Number.isFinite(bn)) return 1;
          return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
        });

        const resolution = uniqNonEmpty(data.map((r) => r.spec_resolution));
        resolution.sort((a, b) => {
          const [aw, ah] = normalizeResolution(a).split("*").map((n) => Number.parseInt(n, 10));
          const [bw, bh] = normalizeResolution(b).split("*").map((n) => Number.parseInt(n, 10));
          const ap = Number.isFinite(aw) && Number.isFinite(ah) ? aw * ah : Number.NaN;
          const bp = Number.isFinite(bw) && Number.isFinite(bh) ? bw * bh : Number.NaN;
          if (Number.isFinite(ap) && Number.isFinite(bp)) return ap - bp;
          if (Number.isFinite(ap)) return -1;
          if (Number.isFinite(bp)) return 1;
          return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
        });

        setSpecOptions({
          size: size.length ? size : [...fallbackSizeOptions],
          resolution: resolution.length ? resolution : [...fallbackResolutionOptions],
          lcdType: sortByKnownOrder(uniqNonEmpty(data.map((r) => r.spec_lcd_type)), fallbackLcdTypeOptions),
          luminance: sortByKnownOrder(uniqNonEmpty(data.map((r) => r.spec_luminance)), fallbackLuminanceOptions),
          temp: sortByKnownOrder(uniqNonEmpty(data.map((r) => r.spec_operating_temp)), fallbackTempOptions),
        });
      } catch {
        setSpecOptions({
          size: [...fallbackSizeOptions],
          resolution: [...fallbackResolutionOptions],
          lcdType: [...fallbackLcdTypeOptions],
          luminance: [...fallbackLuminanceOptions],
          temp: [...fallbackTempOptions],
        });
      }
    })();
  }, []);

  useEffect(() => {
    if (!supabaseEnabled) return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const sp = new URLSearchParams();
        sp.set("select", "*,product_media(*),product_attachments(*)");
        sp.set("is_active", "eq.true");
        if (!isNewView && activeCategory) {
          if (activeCategory.key === "TFT") sp.set("category", "in.(TFT,FTP)");
          else sp.set("category", `eq.${activeCategory.key}`);
        }
        if (fSize) sp.set("spec_size", `ilike.*${fSize}*`);
        if (fLcdType) sp.set("spec_lcd_type", `ilike.*${fLcdType}*`);
        if (fLuminance) sp.set("spec_luminance", `ilike.*${fLuminance}*`);
        if (fTemp) sp.set("spec_operating_temp", `ilike.*${fTemp}*`);

        if (fResolution) {
          const vars = resolutionVariants(fResolution);
          if (vars.length <= 1) sp.set("spec_resolution", `ilike.*${fResolution}*`);
          else sp.set("or", `(${vars.map((v) => `spec_resolution.ilike.*${v}*`).join(",")})`);
        }

        sp.set("order", isNewView ? "created_at.desc" : "sort_order.asc,created_at.desc");
        if (isNewView) sp.set("limit", "12");
        const query = `?${sp.toString()}`;

        const { data } = await supabase.rest<ProductWithRelations[]>("products", query);
        setRemote(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load products");
        setRemote([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [activeCategory, fLcdType, fLuminance, fResolution, fSize, fTemp, isNewView]);

  const localFiltered = useMemo(() => {
    const base = activeCategory
      ? activeCategory.key === "TFT"
        ? products.filter((p) => p.category === "TFT")
        : products.filter((p) => p.category === activeCategory.key)
      : products;
    const sized = fSize ? base.filter((p) => normalizeText(p.specSize ?? "").includes(normalizeText(fSize))) : base;
    const resolved = fResolution
      ? sized.filter((p) => normalizeResolution(p.specResolution ?? "").includes(normalizeResolution(fResolution)))
      : sized;
    const typed = fLcdType ? resolved.filter((p) => normalizeText(p.specLcdType ?? "").includes(normalizeText(fLcdType))) : resolved;
    const lumed = fLuminance ? typed.filter((p) => normalizeText(p.specLuminance ?? "").includes(normalizeText(fLuminance))) : typed;
    const temped = fTemp ? lumed.filter((p) => normalizeText(p.specOperatingTemp ?? "").includes(normalizeText(fTemp))) : lumed;
    return isNewView ? temped.slice(0, 12) : temped;
  }, [activeCategory, fLcdType, fLuminance, fResolution, fSize, fTemp, isNewView]);

  const items: ProductCard[] = remote
    ? remote.map((p) => {
        const media = (p.product_media ?? []).filter((m) => m.kind === "image");
        media.sort((a, b) => (a.is_primary === b.is_primary ? a.sort_order - b.sort_order : a.is_primary ? -1 : 1));
        const first = media[0];
        const pdfs = (p.product_attachments ?? []).filter((a) => a.kind === "pdf");

        return {
          id: p.id,
          slug: p.slug,
          name: p.name_i18n?.en || p.name_i18n?.zh || p.slug,
          category: p.category,
          model: p.model ?? p.slug,
          inStock: p.in_stock,
          shortDescription: p.short_description_i18n?.en || p.short_description_i18n?.zh || "",
          specSize: p.spec_size ?? "",
          specResolution: p.spec_resolution ?? "",
          specLcdType: p.spec_lcd_type ?? "",
          specLuminance: p.spec_luminance ?? "",
          specOperatingTemp: p.spec_operating_temp ?? "",
          images: first ? [{ url: first.url, alt: p.slug }] : [],
          videoUrl: "",
          attachments: pdfs.map((a) => ({
            label: a.label_i18n?.en || a.label_i18n?.zh || a.file_name || "PDF",
            url: a.url,
          })),
        };
      })
    : localFiltered.map((p) => ({
        ...p,
        slug: p.id,
        model: p.model ?? p.id,
        inStock: p.inStock ?? true,
        videoUrl: p.videoUrl ?? "",
        attachments: p.attachments ?? [],
      }));

  return (
    <div>
      <PageBanner
        title={isNewView ? "New Products" : "Product"}
        subtitle="Products are loaded from Supabase when configured. If Supabase env vars are missing, this page falls back to a local demo dataset."
        pageKey="products"
      />
      <div className="mx-auto max-w-6xl space-y-10 px-6 py-16">

        {loading ? <div className="text-sm text-zinc-600">Loading products...</div> : null}
        {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <div className="flex flex-wrap gap-2">
          <Link
            to="/products"
            className={classNames(
              "rounded-full border px-4 py-2 text-sm transition-colors",
              !activeCategory ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-zinc-200 text-zinc-700"
            )}
          >
            All
          </Link>
          {productCategories.map((c) => (
            <Link
              key={c.key}
              to={`/products?category=${encodeURIComponent(c.key)}`}
              className={classNames(
                "rounded-full border px-4 py-2 text-sm transition-colors",
                activeCategory?.key === c.key
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
              )}
            >
              {c.label}
            </Link>
          ))}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[140px_1fr]">
              <div className="pt-1 text-sm font-semibold text-zinc-900">Size</div>
              <div className="flex flex-wrap gap-2">
                <Chip label="All" active={!fSize} onClick={() => setOrDelete("size", "")} />
                {specOptions.size.map((v) => (
                  <Chip key={v} label={v} active={fSize === v} onClick={() => setOrDelete("size", v)} />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[140px_1fr]">
              <div className="pt-1 text-sm font-semibold text-zinc-900">Resolution</div>
              <div className="flex flex-wrap gap-2">
                <Chip label="All" active={!fResolution} onClick={() => setOrDelete("resolution", "")} />
                {specOptions.resolution.map((v) => (
                  <Chip key={v} label={v} active={fResolution === v} onClick={() => setOrDelete("resolution", v)} />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[140px_1fr]">
              <div className="pt-1 text-sm font-semibold text-zinc-900">LCD Type</div>
              <div className="flex flex-wrap gap-2">
                <Chip label="All" active={!fLcdType} onClick={() => setOrDelete("lcdType", "")} />
                {specOptions.lcdType.map((v) => (
                  <Chip key={v} label={v} active={fLcdType === v} onClick={() => setOrDelete("lcdType", v)} />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[140px_1fr]">
              <div className="pt-1 text-sm font-semibold text-zinc-900">Luminance</div>
              <div className="flex flex-wrap gap-2">
                <Chip label="All" active={!fLuminance} onClick={() => setOrDelete("luminance", "")} />
                {specOptions.luminance.map((v) => (
                  <Chip key={v} label={v} active={fLuminance === v} onClick={() => setOrDelete("luminance", v)} />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[140px_1fr]">
              <div className="pt-1 text-sm font-semibold text-zinc-900">Operating Temp.</div>
              <div className="flex flex-wrap gap-2">
                <Chip label="All" active={!fTemp} onClick={() => setOrDelete("temp", "")} />
                {specOptions.temp.map((v) => (
                  <Chip key={v} label={v} active={fTemp === v} onClick={() => setOrDelete("temp", v)} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
              <div className="aspect-[4/3] bg-zinc-50">
                <Link to={`/products/${encodeURIComponent(p.slug || p.id)}`} className="block h-full w-full">
                  {p.images[0] ? (
                    <img
                      src={p.images[0].url}
                      alt={p.images[0].alt}
                      className="h-full w-full object-contain p-8"
                      loading="lazy"
                    />
                  ) : null}
                </Link>
              </div>
              <div className="space-y-3 p-5">
                <div className="text-xs font-semibold text-emerald-700">{p.category}</div>
                <div className="flex items-start justify-between gap-3">
                  <Link
                    to={`/products/${encodeURIComponent(p.slug || p.id)}`}
                    className="text-base font-semibold text-zinc-900 hover:underline"
                  >
                    {p.name}
                  </Link>
                  <span
                    className={
                      p.inStock
                        ? "inline-flex items-center rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-800"
                        : "inline-flex items-center rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-semibold text-yellow-900"
                    }
                  >
                    {p.inStock ? "In stock" : "Out of stock"}
                  </span>
                </div>
                <div className="min-h-[5.5rem] space-y-2">
                  <div className="min-h-[2rem] text-sm text-zinc-600">{p.shortDescription || ""}</div>
                  <div className="min-h-[1.5rem]">
                    {p.videoUrl ? (
                      <a
                        href={p.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex text-sm text-zinc-700 underline underline-offset-4 hover:text-zinc-900"
                      >
                        Product video
                      </a>
                    ) : null}
                    {p.attachments.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {p.attachments.map((a) => (
                          <a
                            key={a.url}
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex text-sm text-zinc-700 underline underline-offset-4 hover:text-zinc-900"
                          >
                            {a.label}
                          </a>
                        ))}
                      </div>
                    ) : !p.videoUrl ? (
                      <div className="h-6" />
                    ) : null}
                  </div>
                </div>

                <Link
                  to={
                    remote
                      ? `/inquiry?product=${encodeURIComponent(p.slug || "")}`
                      : `/inquiry?name=${encodeURIComponent(p.name)}&image=${encodeURIComponent(p.images[0]?.url ?? "")}`
                  }
                  className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  Inquiry
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
