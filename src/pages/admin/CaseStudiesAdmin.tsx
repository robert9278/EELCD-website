import { FormEvent, useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

type CaseStudyRow = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  summary_i18n: Record<string, string>;
  content_i18n: Record<string, string>;
  meta: {
    industry?: string;
    application?: string;
    market?: string;
    country?: string;
    region?: string;
    customer?: string;
    productModels?: string[];
    quantity?: string;
    leadTime?: string;
    incoterms?: string;
    shippingMethod?: string;
    certifications?: string[];
    highlights?: string[];
    tags?: string[];
  };
  media: {
    coverImageUrl?: string;
    imageUrls?: string[];
    videoUrl?: string;
    videoFileUrl?: string;
  };
  published_at: string | null;
  is_published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function safeSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getI18nText(obj: Record<string, string> | null | undefined, key: string) {
  return (obj?.[key] ?? "").toString();
}

function normalizeMedia(media: CaseStudyRow["media"] | null | undefined) {
  return {
    coverImageUrl: (media?.coverImageUrl ?? "").toString(),
    imageUrls: Array.isArray(media?.imageUrls) ? media?.imageUrls.filter((u) => typeof u === "string") : [],
    videoUrl: (media?.videoUrl ?? "").toString(),
    videoFileUrl: (media?.videoFileUrl ?? "").toString(),
  };
}

function normalizeMeta(meta: CaseStudyRow["meta"] | null | undefined) {
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
  return {
    industry: (meta?.industry ?? "").toString(),
    application: (meta?.application ?? "").toString(),
    market: (meta?.market ?? "").toString(),
    country: (meta?.country ?? "").toString(),
    region: (meta?.region ?? "").toString(),
    customer: (meta?.customer ?? "").toString(),
    productModels: arr(meta?.productModels),
    quantity: (meta?.quantity ?? "").toString(),
    leadTime: (meta?.leadTime ?? "").toString(),
    incoterms: (meta?.incoterms ?? "").toString(),
    shippingMethod: (meta?.shippingMethod ?? "").toString(),
    certifications: arr(meta?.certifications),
    highlights: arr(meta?.highlights),
    tags: arr(meta?.tags),
  };
}

function parseList(input: string) {
  return input
    .split(/[\n,]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function toDatetimeLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalInput(value: string) {
  if (!value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function CaseStudiesAdmin() {
  const [items, setItems] = useState<CaseStudyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [activeId, setActiveId] = useState<string | null>(null);
  const active = useMemo(() => items.find((c) => c.id === activeId) ?? null, [items, activeId]);
  const activeMedia = useMemo(() => normalizeMedia(active?.media), [active]);
  const activeMeta = useMemo(() => normalizeMeta(active?.meta), [active]);

  const [slug, setSlug] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [titleZh, setTitleZh] = useState("");
  const [summaryEn, setSummaryEn] = useState("");
  const [summaryZh, setSummaryZh] = useState("");
  const [contentEn, setContentEn] = useState("");
  const [contentZh, setContentZh] = useState("");

  const [industry, setIndustry] = useState("");
  const [application, setApplication] = useState("");
  const [market, setMarket] = useState("");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [customer, setCustomer] = useState("");
  const [productModelsText, setProductModelsText] = useState("");
  const [quantity, setQuantity] = useState("");
  const [leadTime, setLeadTime] = useState("");
  const [incoterms, setIncoterms] = useState("");
  const [shippingMethod, setShippingMethod] = useState("");
  const [certificationsText, setCertificationsText] = useState("");
  const [highlightsText, setHighlightsText] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFileUrl, setVideoFileUrl] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [sortOrder, setSortOrder] = useState(0);

  useEffect(() => {
    if (!active) return;
    const m = normalizeMedia(active.media);
    const meta = normalizeMeta(active.meta);
    setSlug(active.slug);
    setTitleEn(getI18nText(active.title_i18n, "en"));
    setTitleZh(getI18nText(active.title_i18n, "zh"));
    setSummaryEn(getI18nText(active.summary_i18n, "en"));
    setSummaryZh(getI18nText(active.summary_i18n, "zh"));
    setContentEn(getI18nText(active.content_i18n, "en"));
    setContentZh(getI18nText(active.content_i18n, "zh"));

    setIndustry(meta.industry);
    setApplication(meta.application);
    setMarket(meta.market);
    setCountry(meta.country);
    setRegion(meta.region);
    setCustomer(meta.customer);
    setProductModelsText(meta.productModels.join("\n"));
    setQuantity(meta.quantity);
    setLeadTime(meta.leadTime);
    setIncoterms(meta.incoterms);
    setShippingMethod(meta.shippingMethod);
    setCertificationsText(meta.certifications.join("\n"));
    setHighlightsText(meta.highlights.join("\n"));
    setTagsText(meta.tags.join(", "));

    setCoverImageUrl(m.coverImageUrl);
    setImageUrls(m.imageUrls);
    setVideoUrl(m.videoUrl);
    setVideoFileUrl(m.videoFileUrl);
    setPublishedAt(toDatetimeLocalInput(active.published_at));
    setIsPublished(active.is_published);
    setSortOrder(active.sort_order);
  }, [active]);

  function resetForm() {
    setActiveId(null);
    setSlug("");
    setTitleEn("");
    setTitleZh("");
    setSummaryEn("");
    setSummaryZh("");
    setContentEn("");
    setContentZh("");

    setIndustry("");
    setApplication("");
    setMarket("");
    setCountry("");
    setRegion("");
    setCustomer("");
    setProductModelsText("");
    setQuantity("");
    setLeadTime("");
    setIncoterms("");
    setShippingMethod("");
    setCertificationsText("");
    setHighlightsText("");
    setTagsText("");

    setCoverImageUrl("");
    setImageUrls([]);
    setVideoUrl("");
    setVideoFileUrl("");
    setPublishedAt("");
    setIsPublished(false);
    setSortOrder(0);
  }

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.rest<CaseStudyRow[]>("case_studies", "?order=sort_order.asc,created_at.desc");
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load case studies");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function uploadToSiteMedia(prefix: string, file: File) {
    const path = `${prefix}/${Date.now()}-${file.name}`;
    const { publicUrl } = await supabase.storage.uploadPublic("site-media", path, file);
    return publicUrl;
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (busy) return;
    setBusy(true);

    try {
      const s = safeSlug(slug);
      if (!s) throw new Error("Slug is required");
      if (!titleEn.trim() && !titleZh.trim()) throw new Error("At least one title is required");

      const payload: Partial<CaseStudyRow> & Pick<CaseStudyRow, "slug" | "title_i18n" | "summary_i18n" | "content_i18n" | "is_published" | "sort_order"> = {
        slug: s,
        title_i18n: { en: titleEn.trim(), zh: titleZh.trim() },
        summary_i18n: { en: summaryEn.trim(), zh: summaryZh.trim() },
        content_i18n: { en: contentEn.trim(), zh: contentZh.trim() },
        meta: {
          industry: industry.trim(),
          application: application.trim(),
          market: market.trim(),
          country: country.trim(),
          region: region.trim(),
          customer: customer.trim(),
          productModels: parseList(productModelsText),
          quantity: quantity.trim(),
          leadTime: leadTime.trim(),
          incoterms: incoterms.trim(),
          shippingMethod: shippingMethod.trim(),
          certifications: parseList(certificationsText),
          highlights: parseList(highlightsText),
          tags: parseList(tagsText),
        },
        media: {
          coverImageUrl: coverImageUrl.trim(),
          imageUrls,
          videoUrl: videoUrl.trim(),
          videoFileUrl: videoFileUrl.trim(),
        },
        published_at: fromDatetimeLocalInput(publishedAt),
        is_published: isPublished,
        sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
      };

      if (activeId) {
        await supabase.rest<CaseStudyRow[]>("case_studies", `?id=eq.${encodeURIComponent(activeId)}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(payload),
        });
      } else {
        const { data } = await supabase.rest<CaseStudyRow[]>("case_studies", "", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify([payload]),
        });
        if (data[0]?.id) setActiveId(data[0].id);
      }

      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    if (busy) return;
    setBusy(true);
    try {
      await supabase.rest<void>("case_studies", `?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
      if (activeId === id) resetForm();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_560px]">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold text-zinc-900">Case Studies</div>
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            New case
          </button>
        </div>

        {loading ? <div className="text-sm text-zinc-600">Loading...</div> : null}
        {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <div className="grid grid-cols-[1fr_140px_120px] gap-3 border-b border-zinc-200 px-4 py-3 text-xs font-semibold text-zinc-500">
            <div>Title</div>
            <div>Published</div>
            <div>Action</div>
          </div>
          <div className="divide-y divide-zinc-200">
            {items.map((c) => (
              <div key={c.id} className="grid grid-cols-[1fr_140px_120px] gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className="truncate text-left text-sm font-medium text-zinc-900 hover:underline"
                >
                  {getI18nText(c.title_i18n, "en") || getI18nText(c.title_i18n, "zh") || c.slug}
                </button>
                <div className="text-sm text-zinc-700">{c.is_published ? "Yes" : "No"}</div>
                <button
                  type="button"
                  onClick={() => void remove(c.id)}
                  className="text-left text-sm font-medium text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="text-base font-semibold text-zinc-900">{activeId ? "Edit" : "Create"}</div>
        <form onSubmit={save} className="mt-4 space-y-4">
          <label className="block space-y-1">
            <div className="text-sm font-medium text-zinc-900">Slug</div>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              placeholder="e.g. automotive-hmi-project"
            />
          </label>

          <div className="grid grid-cols-1 gap-3">
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Title (EN)</div>
              <input
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Title (ZH)</div>
              <input
                value={titleZh}
                onChange={(e) => setTitleZh(e.target.value)}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Summary (EN)</div>
              <input
                value={summaryEn}
                onChange={(e) => setSummaryEn(e.target.value)}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Summary (ZH)</div>
              <input
                value={summaryZh}
                onChange={(e) => setSummaryZh(e.target.value)}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Content (EN)</div>
              <textarea
                value={contentEn}
                onChange={(e) => setContentEn(e.target.value)}
                rows={7}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Content (ZH)</div>
              <textarea
                value={contentZh}
                onChange={(e) => setContentZh(e.target.value)}
                rows={7}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
          </div>

          <div className="space-y-3 rounded-xl border border-zinc-200 p-4">
            <div className="text-sm font-semibold text-zinc-900">Project snapshot (structured fields)</div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <div className="text-sm font-medium text-zinc-900">Industry</div>
                <input
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                  placeholder="e.g. Automotive / Medical / Industrial"
                />
              </label>
              <label className="block space-y-1">
                <div className="text-sm font-medium text-zinc-900">Application</div>
                <input
                  value={application}
                  onChange={(e) => setApplication(e.target.value)}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                  placeholder="e.g. HMI / handheld / signage"
                />
              </label>
              <label className="block space-y-1">
                <div className="text-sm font-medium text-zinc-900">Market</div>
                <input
                  value={market}
                  onChange={(e) => setMarket(e.target.value)}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                  placeholder="e.g. EU / US / Africa / SEA"
                />
              </label>
              <label className="block space-y-1">
                <div className="text-sm font-medium text-zinc-900">Country</div>
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                  placeholder="e.g. Germany"
                />
              </label>
              <label className="block space-y-1">
                <div className="text-sm font-medium text-zinc-900">Region</div>
                <input
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                  placeholder="e.g. Europe"
                />
              </label>
              <label className="block space-y-1">
                <div className="text-sm font-medium text-zinc-900">Customer (optional)</div>
                <input
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                  placeholder="Optional customer name"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <div className="text-sm font-medium text-zinc-900">Product models (one per line)</div>
                <textarea
                  value={productModelsText}
                  onChange={(e) => setProductModelsText(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                  placeholder="e.g. OLED-1.3\nPCAP-7inch"
                />
              </label>
              <div className="space-y-3">
                <label className="block space-y-1">
                  <div className="text-sm font-medium text-zinc-900">Quantity</div>
                  <input
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                    placeholder="e.g. 5k pcs / month"
                  />
                </label>
                <label className="block space-y-1">
                  <div className="text-sm font-medium text-zinc-900">Lead time</div>
                  <input
                    value={leadTime}
                    onChange={(e) => setLeadTime(e.target.value)}
                    className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                    placeholder="e.g. Sample 7 days, MP 4 weeks"
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <div className="text-sm font-medium text-zinc-900">Incoterms</div>
                <input
                  value={incoterms}
                  onChange={(e) => setIncoterms(e.target.value)}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                  placeholder="e.g. EXW / FOB / CIF"
                />
              </label>
              <label className="block space-y-1">
                <div className="text-sm font-medium text-zinc-900">Shipping method</div>
                <input
                  value={shippingMethod}
                  onChange={(e) => setShippingMethod(e.target.value)}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                  placeholder="e.g. Air / Sea / Express"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <label className="block space-y-1">
                <div className="text-sm font-medium text-zinc-900">Certifications (one per line)</div>
                <textarea
                  value={certificationsText}
                  onChange={(e) => setCertificationsText(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                  placeholder="e.g. ISO9001\nRoHS"
                />
              </label>
              <label className="block space-y-1">
                <div className="text-sm font-medium text-zinc-900">Highlights (one per line)</div>
                <textarea
                  value={highlightsText}
                  onChange={(e) => setHighlightsText(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                  placeholder="e.g. Fast DFM\nStable mass production"
                />
              </label>
              <label className="block space-y-1">
                <div className="text-sm font-medium text-zinc-900">Tags (comma or newline separated)</div>
                <input
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                  placeholder="e.g. OLED, PCAP, HMI"
                />
              </label>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-zinc-200 p-4">
            <div className="text-sm font-semibold text-zinc-900">Optional media</div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-zinc-900">Cover image (optional)</div>
              {coverImageUrl ? (
                <img src={coverImageUrl} alt="" className="h-28 w-full rounded-lg border border-zinc-200 object-cover" />
              ) : (
                <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-500">
                  No cover
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  void (async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      const url = await uploadToSiteMedia("case-studies/cover", f);
                      setCoverImageUrl(url);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Upload failed");
                    } finally {
                      setBusy(false);
                    }
                  })();
                  e.currentTarget.value = "";
                }}
                className="block w-full text-sm"
              />
              <input
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                placeholder="Or paste image URL"
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-zinc-900">Gallery images (optional)</div>
              <input
                type="file"
                accept="image/*"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  void (async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      const url = await uploadToSiteMedia("case-studies/images", f);
                      setImageUrls((prev) => [...prev, url]);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Upload failed");
                    } finally {
                      setBusy(false);
                    }
                  })();
                  e.currentTarget.value = "";
                }}
                className="block w-full text-sm"
              />
              <div className="space-y-2">
                {imageUrls.map((url) => (
                  <div key={url} className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 p-3">
                    <a href={url} target="_blank" rel="noreferrer" className="truncate text-sm text-zinc-800 hover:underline">
                      {url}
                    </a>
                    <button
                      type="button"
                      onClick={() => setImageUrls((prev) => prev.filter((u) => u !== url))}
                      className="text-sm font-medium text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-zinc-900">Video URL (optional)</div>
              <input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                placeholder="https://youtube.com/..."
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-zinc-900">Video file (optional)</div>
              {videoFileUrl ? (
                <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 p-3">
                  <a href={videoFileUrl} target="_blank" rel="noreferrer" className="truncate text-sm text-zinc-800 hover:underline">
                    {videoFileUrl}
                  </a>
                  <button
                    type="button"
                    onClick={() => setVideoFileUrl("")}
                    className="text-sm font-medium text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="text-sm text-zinc-600">No video file</div>
              )}
              <input
                type="file"
                accept="video/*"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  void (async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      const url = await uploadToSiteMedia("case-studies/video", f);
                      setVideoFileUrl(url);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Upload failed");
                    } finally {
                      setBusy(false);
                    }
                  })();
                  e.currentTarget.value = "";
                }}
                className="block w-full text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Published at</div>
              <input
                type="datetime-local"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
                <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
                Published
              </label>
            </div>
          </div>

          <label className="block space-y-1">
            <div className="text-sm font-medium text-zinc-900">Sort order</div>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Saving..." : "Save"}
          </button>
        </form>

        {activeId ? (
          <div className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
            Preview media: cover={Boolean(activeMedia.coverImageUrl)} images={activeMedia.imageUrls.length} videoUrl=
            {Boolean(activeMedia.videoUrl)} videoFile={Boolean(activeMedia.videoFileUrl)}
          </div>
        ) : null}

        {activeId ? (
          <div className="mt-2 rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
            Preview snapshot: industry={Boolean(activeMeta.industry)} models={activeMeta.productModels.length} tags=
            {activeMeta.tags.length}
          </div>
        ) : null}
      </div>
    </div>
  );
}

