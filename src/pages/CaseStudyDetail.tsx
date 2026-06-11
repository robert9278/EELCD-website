import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { supabase, supabaseEnabled } from "@/lib/supabaseClient";
import PageBanner from "@/components/PageBanner";

type CaseStudyRow = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
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
};

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

function splitParagraphs(text: string) {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function CaseStudyDetail() {
  const { slug } = useParams();
  const [item, setItem] = useState<CaseStudyRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseEnabled) return;
    if (!slug) return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await supabase.rest<CaseStudyRow[]>(
          "case_studies",
          `?select=id,slug,title_i18n,content_i18n,meta,media,published_at&slug=eq.${encodeURIComponent(slug)}&limit=1`
        );
        setItem(data[0] ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load case study");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const media = useMemo(() => normalizeMedia(item?.media), [item]);
  const meta = useMemo(() => normalizeMeta(item?.meta), [item]);
  const title = getI18nText(item?.title_i18n, "en") || getI18nText(item?.title_i18n, "zh") || item?.slug || "";
  const content = getI18nText(item?.content_i18n, "en") || getI18nText(item?.content_i18n, "zh") || "";
  const cover = media.coverImageUrl.trim();
  const images = media.imageUrls;
  const videoUrl = media.videoUrl.trim();
  const videoFileUrl = media.videoFileUrl.trim();

  return (
    <div>
      <PageBanner title="Industry Case Studies" backTo={{ label: "Back to Case Studies", href: "/case-studies" }} />
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
            {cover ? <img src={cover} alt="" className="h-64 w-full rounded-2xl object-cover" /> : null}

            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-500">
                {item.published_at ? new Date(item.published_at).toLocaleDateString() : ""}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">{title}</h1>
            </div>

            {meta.industry || meta.application || meta.market || meta.country || meta.region || meta.customer || meta.productModels.length > 0 || meta.quantity || meta.leadTime || meta.incoterms || meta.shippingMethod || meta.certifications.length > 0 || meta.highlights.length > 0 || meta.tags.length > 0 ? (
              <section className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="text-base font-semibold text-zinc-900">Project Snapshot</div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {meta.industry ? (
                    <div>
                      <div className="text-xs font-semibold text-zinc-500">Industry</div>
                      <div className="mt-1 text-sm text-zinc-800">{meta.industry}</div>
                    </div>
                  ) : null}
                  {meta.application ? (
                    <div>
                      <div className="text-xs font-semibold text-zinc-500">Application</div>
                      <div className="mt-1 text-sm text-zinc-800">{meta.application}</div>
                    </div>
                  ) : null}
                  {meta.market ? (
                    <div>
                      <div className="text-xs font-semibold text-zinc-500">Market</div>
                      <div className="mt-1 text-sm text-zinc-800">{meta.market}</div>
                    </div>
                  ) : null}
                  {meta.country || meta.region ? (
                    <div>
                      <div className="text-xs font-semibold text-zinc-500">Region</div>
                      <div className="mt-1 text-sm text-zinc-800">
                        {[meta.region, meta.country].filter(Boolean).join(" / ")}
                      </div>
                    </div>
                  ) : null}
                  {meta.customer ? (
                    <div>
                      <div className="text-xs font-semibold text-zinc-500">Customer</div>
                      <div className="mt-1 text-sm text-zinc-800">{meta.customer}</div>
                    </div>
                  ) : null}
                  {meta.quantity ? (
                    <div>
                      <div className="text-xs font-semibold text-zinc-500">Quantity</div>
                      <div className="mt-1 text-sm text-zinc-800">{meta.quantity}</div>
                    </div>
                  ) : null}
                  {meta.leadTime ? (
                    <div>
                      <div className="text-xs font-semibold text-zinc-500">Lead time</div>
                      <div className="mt-1 text-sm text-zinc-800">{meta.leadTime}</div>
                    </div>
                  ) : null}
                  {meta.incoterms ? (
                    <div>
                      <div className="text-xs font-semibold text-zinc-500">Incoterms</div>
                      <div className="mt-1 text-sm text-zinc-800">{meta.incoterms}</div>
                    </div>
                  ) : null}
                  {meta.shippingMethod ? (
                    <div>
                      <div className="text-xs font-semibold text-zinc-500">Shipping</div>
                      <div className="mt-1 text-sm text-zinc-800">{meta.shippingMethod}</div>
                    </div>
                  ) : null}
                </div>

                {meta.productModels.length > 0 ? (
                  <div className="mt-5">
                    <div className="text-xs font-semibold text-zinc-500">Product models</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {meta.productModels.map((t) => (
                        <span key={t} className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {meta.certifications.length > 0 ? (
                  <div className="mt-5">
                    <div className="text-xs font-semibold text-zinc-500">Certifications</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {meta.certifications.map((t) => (
                        <span key={t} className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {meta.highlights.length > 0 ? (
                  <div className="mt-5">
                    <div className="text-xs font-semibold text-zinc-500">Highlights</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
                      {meta.highlights.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {meta.tags.length > 0 ? (
                  <div className="mt-5">
                    <div className="text-xs font-semibold text-zinc-500">Tags</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {meta.tags.map((t) => (
                        <span key={t} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            {videoFileUrl ? (
              <video controls className="w-full rounded-2xl border border-zinc-200 bg-black">
                <source src={videoFileUrl} />
              </video>
            ) : null}

            {videoUrl ? (
              <a
                href={videoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex text-sm font-semibold text-emerald-700 underline underline-offset-4"
              >
                Watch video
              </a>
            ) : null}

            <div className="prose max-w-none prose-zinc">
              {splitParagraphs(content).map((p, idx) => (
                <p key={idx}>{p}</p>
              ))}
            </div>

            {images.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {images.map((url) => (
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
          </article>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">Not found.</div>
        )}
      </div>
    </div>
  );
}

