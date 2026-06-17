import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import PageBanner from "@/components/PageBanner";
import { supabase, supabaseEnabled } from "@/lib/supabaseClient";
import { productCategories, products as localProducts } from "@/data/products";

type ProductRow = {
  id: string;
  slug: string;
  category: string;
  model: string | null;
  in_stock: boolean;
  shop_stock_qty: number | null;
  name_i18n: Record<string, string>;
  short_description_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  spec_size: string | null;
  spec_resolution: string | null;
  spec_lcd_type: string | null;
  spec_luminance: string | null;
  spec_operating_temp: string | null;
  spec_table: Array<{ item?: string; contents?: string; unit?: string }> | null;
  is_active: boolean;
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

function getI18nText(obj: Record<string, string> | null | undefined, key: string) {
  return (obj?.[key] ?? "").toString();
}

function normalizeCategoryKey(input: string) {
  const raw = (input ?? "").trim().toUpperCase();
  if (raw === "FTP") return "TFT";
  return raw;
}

type TabKey = "details" | "specs" | "downloads";

export default function ProductDetail() {
  const { slug } = useParams();
  const [item, setItem] = useState<ProductWithRelations | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("details");
  const [activeMediaId, setActiveMediaId] = useState<string>("");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerScale, setViewerScale] = useState(1);
  const [viewerOffset, setViewerOffset] = useState({ x: 0, y: 0 });
  const [viewerDragging, setViewerDragging] = useState(false);
  const viewerDragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    if (!slug) return;
    if (!supabaseEnabled) {
      const local = localProducts.find((p) => p.id === slug) ?? null;
      if (!local) {
        setItem(null);
        return;
      }
      setItem({
        id: local.id,
        slug: local.id,
        category: local.category,
        model: local.model ?? null,
        in_stock: Boolean(local.inStock),
        shop_stock_qty: null,
        name_i18n: { en: local.name, zh: "" },
        short_description_i18n: { en: local.shortDescription, zh: "" },
        description_i18n: { en: "", zh: "" },
        spec_size: local.specSize ?? null,
        spec_resolution: local.specResolution ?? null,
        spec_lcd_type: local.specLcdType ?? null,
        spec_luminance: local.specLuminance ?? null,
        spec_operating_temp: local.specOperatingTemp ?? null,
        spec_table: null,
        is_active: true,
        product_media: (local.images ?? []).map((img, idx) => ({
          id: `${local.id}:${idx}`,
          product_id: local.id,
          kind: "image",
          url: img.url,
          sort_order: idx,
          is_primary: idx === 0,
        })),
        product_attachments: (local.attachments ?? []).map((a, idx) => ({
          id: `${local.id}:att:${idx}`,
          product_id: local.id,
          kind: "pdf",
          url: a.url,
          label_i18n: { en: a.label, zh: "" },
          file_name: null,
        })),
      });
      return;
    }

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await supabase.rest<ProductWithRelations[]>(
          "products",
          `?select=*,product_media(*),product_attachments(*)&is_active=eq.true&slug=eq.${encodeURIComponent(slug)}&limit=1`
        );
        setItem(data[0] ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load product");
        setItem(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const media = useMemo(() => {
    const list = (item?.product_media ?? []).filter(
      (m) => (m.kind === "image" || m.kind === "video") && (m.url ?? "").trim().length > 0
    );
    list.sort((a, b) => (a.is_primary === b.is_primary ? a.sort_order - b.sort_order : a.is_primary ? -1 : 1));
    return list;
  }, [item]);

  const activeMedia = useMemo(() => {
    if (media.length === 0) return null;
    return media.find((m) => m.id === activeMediaId) ?? media[0] ?? null;
  }, [media, activeMediaId]);

  useEffect(() => {
    if (media.length === 0) {
      setActiveMediaId("");
      return;
    }
    if (!activeMediaId || !media.some((m) => m.id === activeMediaId)) setActiveMediaId(media[0].id);
  }, [media, activeMediaId]);

  useEffect(() => {
    setViewerScale(1);
    setViewerOffset({ x: 0, y: 0 });
    setViewerDragging(false);
    viewerDragStart.current = null;
  }, [activeMedia?.id, viewerOpen]);

  useEffect(() => {
    if (viewerOpen && activeMedia?.kind !== "image") setViewerOpen(false);
  }, [viewerOpen, activeMedia?.kind]);

  const pdfs = useMemo(() => {
    const list = (item?.product_attachments ?? []).filter((a) => a.kind === "pdf" && (a.url ?? "").trim().length > 0);
    return list;
  }, [item]);

  const title = item ? getI18nText(item.name_i18n, "en") || getI18nText(item.name_i18n, "zh") || item.slug : "";
  const short = item ? getI18nText(item.short_description_i18n, "en") || getI18nText(item.short_description_i18n, "zh") : "";
  const desc = item ? getI18nText(item.description_i18n, "en") || getI18nText(item.description_i18n, "zh") : "";
  const catKey = item ? normalizeCategoryKey(item.category) : "";
  const catLabel = productCategories.find((c) => c.key === catKey)?.label ?? catKey;

  const specRows = useMemo(() => {
    const table = (item?.spec_table ?? null) as Array<{ item?: string; contents?: string; unit?: string }> | null;
    const baseRows: Array<{ label: string; value: string }> = [
      { label: "LCD Type", value: (item?.spec_lcd_type ?? "").toString().trim() },
      { label: "Operating temperature", value: (item?.spec_operating_temp ?? "").toString().trim() },
      { label: "Module size", value: (item?.spec_size ?? "").toString().trim() },
      { label: "Number of Dots", value: (item?.spec_resolution ?? "").toString().trim() },
      { label: "Lcm luminance", value: (item?.spec_luminance ?? "").toString().trim() },
    ];

    const normalized = (table ?? [])
      .map((r) => ({
        label: (r.item ?? "").toString().trim(),
        value: `${(r.contents ?? "").toString().trim()}${(r.unit ?? "").toString().trim() ? ` ${(r.unit ?? "").toString().trim()}` : ""}`.trim(),
      }))
      .filter((r) => r.label.length > 0);

    const baseKey = new Set(baseRows.map((r) => r.label.toLowerCase()));
    const customRows = normalized.filter((r) => !baseKey.has(r.label.toLowerCase()));

    return [...baseRows, ...customRows];
  }, [item]);

  function clampScale(v: number) {
    return Math.max(1, Math.min(6, v));
  }

  function onViewerWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY;
    const next = clampScale(viewerScale + (delta > 0 ? -0.12 : 0.12));
    setViewerScale(next);
    if (next === 1) setViewerOffset({ x: 0, y: 0 });
  }

  function onViewerPointerDown(e: React.PointerEvent) {
    if (viewerScale <= 1) return;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    setViewerDragging(true);
    viewerDragStart.current = { x: e.clientX, y: e.clientY, ox: viewerOffset.x, oy: viewerOffset.y };
  }

  function onViewerPointerMove(e: React.PointerEvent) {
    if (!viewerDragging || viewerScale <= 1) return;
    const start = viewerDragStart.current;
    if (!start) return;
    setViewerOffset({ x: start.ox + (e.clientX - start.x), y: start.oy + (e.clientY - start.y) });
  }

  function onViewerPointerUp(e: React.PointerEvent) {
    if (!viewerDragging) return;
    setViewerDragging(false);
    viewerDragStart.current = null;
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {
    }
  }

  return (
    <div>
      <PageBanner title="Product" pageKey="products" backTo={{ label: "Back to Products", href: "/products" }} />
      <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
          <Link to="/" className="hover:text-zinc-900">
            Home
          </Link>
          <span>/</span>
          <Link to="/products" className="hover:text-zinc-900">
            {catLabel ? `${catLabel}` : "Products"}
          </Link>
          <span>/</span>
          <Link to="/products" className="hover:text-zinc-900">
            All products
          </Link>
        </div>

        {!supabaseEnabled ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">Supabase is not configured.</div>
        ) : null}

        {loading ? <div className="text-sm text-zinc-600">Loading...</div> : null}
        {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        {item ? (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[420px_1fr]">
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                <div className="absolute right-4 top-4 z-10">
                  <span
                    className={
                      item.in_stock
                        ? "inline-flex items-center rounded-md bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white"
                        : "inline-flex items-center rounded-md bg-zinc-700 px-3 py-1.5 text-xs font-semibold text-white"
                    }
                  >
                    {item.in_stock ? "In stock" : "Out of stock"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => (activeMedia?.kind === "image" ? setViewerOpen(true) : null)}
                  className="block w-full text-left"
                >
                  <div className="flex aspect-[4/3] items-center justify-center bg-white">
                    {activeMedia?.url ? (
                      activeMedia.kind === "video" ? (
                        <video
                          src={activeMedia.url}
                          controls
                          playsInline
                          preload="metadata"
                          className="max-h-full max-w-full bg-white"
                        />
                      ) : (
                        <img src={activeMedia.url} alt="" className="h-full w-full object-contain p-8" loading="lazy" />
                      )
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-zinc-500">No media</div>
                    )}
                  </div>
                </button>
              </div>

              {media.length > 1 ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {media.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setActiveMediaId(m.id)}
                      className={
                        m.id === activeMedia?.id
                          ? "h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-emerald-400 bg-white"
                          : "h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-white hover:border-zinc-300"
                      }
                    >
                      {m.kind === "video" ? (
                        <video src={m.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                      ) : (
                        <img src={m.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      )}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <div className="text-sm font-semibold text-zinc-500">{item.model || item.slug}</div>
                <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">{title}</h1>
                {short ? <div className="text-sm text-zinc-600">{short}</div> : null}
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="text-xs font-semibold text-zinc-500">Production State</div>
                  <div className="text-sm text-zinc-800">{item.is_active ? "In Production" : "Not Active"}</div>
                  <div className="text-xs font-semibold text-zinc-500">Stock Quantity</div>
                  <div className="text-sm text-zinc-800">
                    {typeof item.shop_stock_qty === "number" ? `${item.shop_stock_qty} PCS` : "-"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Link
                  to={`/inquiry?product=${encodeURIComponent(item.slug)}`}
                  className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  Inquiry Now
                </Link>
                {pdfs[0]?.url ? (
                  <a
                    href={pdfs[0].url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-md border border-emerald-600 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
                  >
                    Datasheet Available
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-400"
                  >
                    Datasheet Available
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">Not found.</div>
        )}

        {item ? (
          <div className="rounded-2xl border border-zinc-200 bg-white">
            <div className="flex flex-wrap gap-2 border-b border-zinc-200 px-4 py-3">
              {(
                [
                  { key: "details", label: "Product Details" },
                  { key: "specs", label: "Specifications" },
                  { key: "downloads", label: "Downloads" },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={
                    tab === t.key
                      ? "rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800"
                      : "rounded-full px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {tab === "details" ? (
                <div className="space-y-4">
                  <div className="text-lg font-semibold text-zinc-900">Product Details</div>
                  {desc ? (
                    <div className="prose max-w-none prose-zinc">
                      {desc
                        .split("\n")
                        .filter((p) => p.trim().length > 0)
                        .map((p, idx) => (
                          <p key={idx}>{p}</p>
                        ))}
                    </div>
                  ) : (
                    <div className="text-sm text-zinc-600">No details yet.</div>
                  )}
                </div>
              ) : null}

              {tab === "specs" ? (
                <div className="space-y-4">
                  <div className="text-lg font-semibold text-zinc-900">Specifications</div>
                  <div className="overflow-hidden rounded-xl border border-zinc-200">
                    <div className="grid grid-cols-2 gap-3 bg-slate-900 px-4 py-3 text-xs font-semibold text-white">
                      <div>Item</div>
                      <div>Contents</div>
                    </div>
                    <div className="divide-y divide-zinc-200">
                      {specRows.map((r) => (
                        <div key={r.label} className="grid grid-cols-2 gap-3 px-4 py-3 text-sm">
                          <div className="font-medium text-zinc-900">{r.label}</div>
                          <div className="text-zinc-700">{r.value || "-"}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {tab === "downloads" ? (
                <div className="space-y-4">
                  <div className="text-lg font-semibold text-zinc-900">Downloads</div>
                  {pdfs.length > 0 ? (
                    <div className="space-y-2">
                      {pdfs.map((a) => (
                        <a
                          key={a.id}
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex text-sm font-semibold text-emerald-700 underline underline-offset-4 hover:text-emerald-800"
                        >
                          {getI18nText(a.label_i18n, "en") || getI18nText(a.label_i18n, "zh") || a.file_name || "Datasheet PDF"}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-zinc-600">No files yet.</div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {viewerOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div className="text-sm font-semibold text-zinc-900">Image Viewer</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewerScale((s) => clampScale(s - 0.25))}
                  className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  -
                </button>
                <div className="min-w-14 text-center text-sm font-semibold text-zinc-700">{Math.round(viewerScale * 100)}%</div>
                <button
                  type="button"
                  onClick={() => setViewerScale((s) => clampScale(s + 0.25))}
                  className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewerScale(1);
                    setViewerOffset({ x: 0, y: 0 });
                  }}
                  className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setViewerOpen(false)}
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zinc-800"
                >
                  Close
                </button>
              </div>
            </div>

            <div
              onWheel={onViewerWheel}
              onPointerDown={onViewerPointerDown}
              onPointerMove={onViewerPointerMove}
              onPointerUp={onViewerPointerUp}
              onPointerCancel={onViewerPointerUp}
              className={viewerScale > 1 ? "relative h-[70vh] touch-none bg-zinc-900/5" : "relative h-[70vh] bg-zinc-900/5"}
            >
              <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                {activeMedia?.kind === "image" && activeMedia.url ? (
                  <img
                    src={activeMedia.url}
                    alt=""
                    draggable={false}
                    className={viewerScale > 1 ? "max-h-none max-w-none select-none" : "max-h-full max-w-full select-none"}
                    style={{
                      transform: `translate(${viewerOffset.x}px, ${viewerOffset.y}px) scale(${viewerScale})`,
                      transformOrigin: "center",
                      cursor: viewerScale > 1 ? (viewerDragging ? "grabbing" : "grab") : "zoom-in",
                    }}
                    onDoubleClick={() => {
                      setViewerScale(1);
                      setViewerOffset({ x: 0, y: 0 });
                    }}
                    onClick={() => {
                      if (viewerScale === 1) setViewerScale(2);
                    }}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
