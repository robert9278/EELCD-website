import { FormEvent, useEffect, useMemo, useState } from "react";

import { supabase, supabaseEnabled } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/i18n";
import PageBanner from "@/components/PageBanner";

type ServicesSectionRow = {
  key: string;
  title_i18n: Record<string, string>;
  content_i18n: Record<string, string>;
  is_active: boolean;
};

type DownloadRow = {
  id: string;
  title_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  file_url: string;
  file_name: string | null;
  sort_order: number;
  is_active: boolean;
};

function splitParagraphs(text: string) {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function Services() {
  const { t, pickI18nText } = useI18n();
  const [warranty, setWarranty] = useState<ServicesSectionRow | null>(null);
  const [downloads, setDownloads] = useState<DownloadRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [productModel, setProductModel] = useState("");
  const [company, setCompany] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = useMemo(() => name.trim() && phone.trim() && email.trim(), [name, phone, email]);

  useEffect(() => {
    if (!supabaseEnabled) return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [w, d] = await Promise.all([
          supabase.rest<ServicesSectionRow[]>("services_sections", "?select=key,title_i18n,content_i18n,is_active&key=eq.warranty&limit=1"),
          supabase.rest<DownloadRow[]>(
            "services_downloads",
            "?select=id,title_i18n,description_i18n,file_url,file_name,sort_order,is_active&order=sort_order.asc,created_at.desc"
          ),
        ]);
        setWarranty(w.data[0] ?? null);
        setDownloads(d.data.filter((x) => x.is_active));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load services content");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function submitFeedback(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitted(false);

    if (!supabaseEnabled) {
      setSubmitError(t("services_supabase_missing"));
      return;
    }
    if (!canSubmit) {
      setSubmitError(t("services_fill_required"));
      return;
    }

    setSubmitting(true);
    try {
      await supabase.rest<void>("feedback_submissions", "", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          {
            name: name.trim(),
            phone: phone.trim(),
            email: email.trim(),
            message: message.trim(),
            product_model: productModel.trim() ? productModel.trim() : null,
            company: company.trim() ? company.trim() : null,
          },
        ]),
      });
      setSubmitted(true);
      setName("");
      setPhone("");
      setEmail("");
      setMessage("");
      setProductModel("");
      setCompany("");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageBanner title={t("services_title")} subtitle={t("services_desc")} pageKey="services" />
      <div className="mx-auto max-w-6xl space-y-10 px-6 py-16">

        {!supabaseEnabled ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
            {t("services_supabase_off")}
          </div>
        ) : null}

        {loading ? <div className="text-sm text-zinc-600">{t("services_loading")}</div> : null}
        {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <section id="download" className="rounded-2xl border border-zinc-200 bg-white p-8">
          <div className="flex items-center justify-between gap-4">
            <div className="text-lg font-semibold text-zinc-900">{t("services_download")}</div>
          </div>
          {downloads.length === 0 ? (
            <div className="mt-4 text-sm text-zinc-600">{t("services_no_downloads")}</div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              {downloads.map((d) => (
                <a
                  key={d.id}
                  href={d.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:bg-zinc-50"
                >
                  <div className="text-base font-semibold text-zinc-900">
                    {pickI18nText(d.title_i18n) || d.file_name || t("services_download")}
                  </div>
                  <div className="mt-2 text-sm text-zinc-600">
                    {pickI18nText(d.description_i18n) || ""}
                  </div>
                  <div className="mt-3 text-sm font-semibold text-emerald-700 underline underline-offset-4">{t("services_open_file")}</div>
                </a>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-8">
          <div className="text-lg font-semibold text-zinc-900">
            {pickI18nText(warranty?.title_i18n) || t("services_warranty_fallback")}
          </div>
          <div className="mt-4 space-y-3 text-sm leading-7 text-zinc-700">
            {splitParagraphs(pickI18nText(warranty?.content_i18n)).map((p, idx) => (
              <p key={idx}>{p}</p>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-8">
          <div className="text-lg font-semibold text-zinc-900">{t("services_feedback")}</div>
          <div className="mt-2 text-sm text-zinc-600">{t("services_required_3")}</div>

          <form onSubmit={submitFeedback} className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">{t("services_name")} *</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">{t("services_phone")} *</div>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                type="tel"
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">{t("services_email")} *</div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                type="email"
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>

            <label className="block space-y-1 md:col-span-2">
              <div className="text-sm font-medium text-zinc-900">{t("services_message_optional")}</div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>

            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">{t("services_product_model_optional")}</div>
              <input
                value={productModel}
                onChange={(e) => setProductModel(e.target.value)}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">{t("services_company_optional")}</div>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>

            {submitError ? <div className="md:col-span-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</div> : null}
            {submitted ? <div className="md:col-span-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{t("services_submitted")}</div> : null}

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={submitting || !canSubmit}
                className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? t("services_submitting") : t("services_submit")}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

