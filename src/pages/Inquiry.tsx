import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { supabase, supabaseEnabled } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/i18n";
import { products } from "@/data/products";
import PageBanner from "@/components/PageBanner";

type QuoteInquiryInsert = {
  full_name: string;
  email: string;
  phone_whatsapp: string;
  country: string;
  company: string | null;
  quantity: string | null;
  requirements: string | null;
};

type ProductPick = {
  slug: string;
  name_i18n: Record<string, string>;
  product_media?: { kind: string; url: string; sort_order: number; is_primary: boolean }[];
};

export default function Inquiry() {
  const { t, pickI18nText } = useI18n();
  const [params] = useSearchParams();
  const productSlug = (params.get("product") ?? "").trim();
  const nameParam = (params.get("name") ?? "").trim();
  const imageParam = (params.get("image") ?? "").trim();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneWhatsapp, setPhoneWhatsapp] = useState("");
  const [country, setCountry] = useState("");
  const [quantity, setQuantity] = useState("");
  const [company, setCompany] = useState("");
  const [requirements, setRequirements] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [productName, setProductName] = useState<string | null>(null);
  const [productImage, setProductImage] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return (
      fullName.trim().length > 0 &&
      email.trim().length > 0 &&
      phoneWhatsapp.trim().length > 0 &&
      country.trim().length > 0
    );
  }, [country, email, fullName, phoneWhatsapp]);

  useEffect(() => {
    if (!productSlug && !nameParam && !imageParam) {
      setProductName(null);
      setProductImage(null);
      return;
    }

    if (productSlug && supabaseEnabled) {
      void (async () => {
        try {
          const { data } = await supabase.rest<ProductPick[]>(
            "products",
            `?select=slug,name_i18n,product_media(kind,url,sort_order,is_primary)&slug=eq.${encodeURIComponent(productSlug)}&limit=1`
          );
          const row = data[0];
          if (!row) {
            setProductName(nameParam || null);
            setProductImage(imageParam || null);
            return;
          }
          const name = pickI18nText(row.name_i18n) || row.slug;
          const media = (row.product_media ?? []).filter((m) => m.kind === "image");
          media.sort((a, b) => (a.is_primary === b.is_primary ? a.sort_order - b.sort_order : a.is_primary ? -1 : 1));
          setProductName(name);
          setProductImage(media[0]?.url ?? null);
        } catch {
          setProductName(nameParam || null);
          setProductImage(imageParam || null);
        }
      })();
      return;
    }

    const local = products.find((p) => p.id === productSlug);
    if (local) {
      setProductName(local.name);
      setProductImage(local.images[0]?.url ?? null);
      return;
    }

    setProductName(nameParam || null);
    setProductImage(imageParam || null);
  }, [imageParam, nameParam, pickI18nText, productSlug]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;

    setError(null);
    setSubmitted(false);

    if (!supabaseEnabled) {
      setError(t("inquiry_supabase_missing"));
      return;
    }
    if (!canSubmit) {
      setError(t("inquiry_fill_required"));
      return;
    }

    setBusy(true);
    try {
      const payload: QuoteInquiryInsert = {
        full_name: fullName.trim(),
        email: email.trim(),
        phone_whatsapp: phoneWhatsapp.trim(),
        country: country.trim(),
        company: company.trim() ? company.trim() : null,
        quantity: quantity.trim() ? quantity.trim() : null,
        requirements: requirements.trim() ? requirements.trim() : null,
      };

      await supabase.rest<void>("quote_inquiries", "", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([payload]),
      });

      setSubmitted(true);
      setFullName("");
      setEmail("");
      setPhoneWhatsapp("");
      setCountry("");
      setQuantity("");
      setCompany("");
      setRequirements("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("inquiry_submit_failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageBanner title={t("inquiry_h1")} subtitle={t("inquiry_success")} />
      <div className="mx-auto max-w-6xl space-y-10 px-6 py-16">

        {productName || productImage ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="flex items-center gap-4">
              {productImage ? (
                <div className="h-16 w-16 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
                  <img src={productImage} alt="" className="h-full w-full object-contain p-2" />
                </div>
              ) : null}
              <div className="min-w-0">
                <div className="text-sm font-semibold text-zinc-900">{productName}</div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-zinc-200 bg-white p-8">
          <div className="text-base font-semibold text-zinc-900">{t("inquiry_form")}</div>

          <form onSubmit={submit} className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">{t("inquiry_full_name")} *</div>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>

            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">{t("inquiry_email")} *</div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                type="email"
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>

            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">{t("inquiry_phone_whatsapp")} *</div>
              <input
                value={phoneWhatsapp}
                onChange={(e) => setPhoneWhatsapp(e.target.value)}
                required
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>

            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">{t("inquiry_country")} *</div>
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                required
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>

            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">{t("inquiry_company")}</div>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>

            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">{t("inquiry_quantity")}</div>
              <input
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>

            <label className="block space-y-1 md:col-span-2">
              <div className="text-sm font-medium text-zinc-900">{t("inquiry_requirements")}</div>
              <textarea
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                rows={5}
                placeholder={t("inquiry_requirements_placeholder")}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>

            {error ? <div className="md:col-span-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
            {submitted ? (
              <div className="md:col-span-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {t("inquiry_success")}
              </div>
            ) : null}

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={busy || !canSubmit}
                className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? t("inquiry_sending") : t("inquiry_send")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
