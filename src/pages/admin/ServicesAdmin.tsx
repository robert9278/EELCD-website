import { FormEvent, useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

type ServicesSectionRow = {
  key: string;
  title_i18n: Record<string, string>;
  content_i18n: Record<string, string>;
  is_active: boolean;
  updated_at: string;
};

type DownloadRow = {
  id: string;
  title_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  file_url: string;
  file_name: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type FeedbackRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string;
  message: string;
  product_model: string | null;
  company: string | null;
  status: string;
  created_at: string;
};

function getI18nText(obj: Record<string, string> | null | undefined, key: string) {
  return (obj?.[key] ?? "").toString();
}

export default function ServicesAdmin() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [warranty, setWarranty] = useState<ServicesSectionRow | null>(null);
  const [downloads, setDownloads] = useState<DownloadRow[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);

  const [tab, setTab] = useState<"warranty" | "downloads" | "feedback">("warranty");

  const [warTitleEn, setWarTitleEn] = useState("");
  const [warTitleZh, setWarTitleZh] = useState("");
  const [warContentEn, setWarContentEn] = useState("");
  const [warContentZh, setWarContentZh] = useState("");
  const [warActive, setWarActive] = useState(true);

  const [dlActiveId, setDlActiveId] = useState<string | null>(null);
  const activeDl = useMemo(() => downloads.find((d) => d.id === dlActiveId) ?? null, [downloads, dlActiveId]);
  const [dlTitleEn, setDlTitleEn] = useState("");
  const [dlTitleZh, setDlTitleZh] = useState("");
  const [dlDescEn, setDlDescEn] = useState("");
  const [dlDescZh, setDlDescZh] = useState("");
  const [dlFileUrl, setDlFileUrl] = useState("");
  const [dlFileName, setDlFileName] = useState("");
  const [dlSort, setDlSort] = useState(0);
  const [dlIsActive, setDlIsActive] = useState(true);

  useEffect(() => {
    if (!warranty) return;
    setWarTitleEn(getI18nText(warranty.title_i18n, "en"));
    setWarTitleZh(getI18nText(warranty.title_i18n, "zh"));
    setWarContentEn(getI18nText(warranty.content_i18n, "en"));
    setWarContentZh(getI18nText(warranty.content_i18n, "zh"));
    setWarActive(warranty.is_active);
  }, [warranty]);

  useEffect(() => {
    if (!activeDl) return;
    setDlTitleEn(getI18nText(activeDl.title_i18n, "en"));
    setDlTitleZh(getI18nText(activeDl.title_i18n, "zh"));
    setDlDescEn(getI18nText(activeDl.description_i18n, "en"));
    setDlDescZh(getI18nText(activeDl.description_i18n, "zh"));
    setDlFileUrl(activeDl.file_url);
    setDlFileName(activeDl.file_name ?? "");
    setDlSort(activeDl.sort_order);
    setDlIsActive(activeDl.is_active);
  }, [activeDl]);

  function resetDownloadForm() {
    setDlActiveId(null);
    setDlTitleEn("");
    setDlTitleZh("");
    setDlDescEn("");
    setDlDescZh("");
    setDlFileUrl("");
    setDlFileName("");
    setDlSort(0);
    setDlIsActive(true);
  }

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const [w, d, f] = await Promise.all([
        supabase.rest<ServicesSectionRow[]>(
          "services_sections",
          "?select=key,title_i18n,content_i18n,is_active,updated_at&key=eq.warranty&limit=1"
        ),
        supabase.rest<DownloadRow[]>("services_downloads", "?order=sort_order.asc,created_at.desc"),
        supabase.rest<FeedbackRow[]>("feedback_submissions", "?order=created_at.desc&limit=100"),
      ]);
      setWarranty(w.data[0] ?? null);
      setDownloads(d.data);
      setFeedback(f.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load services content");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function uploadSiteFile(file: File) {
    const path = `downloads/${Date.now()}-${file.name}`;
    const { publicUrl } = await supabase.storage.uploadPublic("site-files", path, file);
    return publicUrl;
  }

  async function saveWarranty(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (busy) return;
    setBusy(true);
    try {
      await supabase.rest<ServicesSectionRow[]>("services_sections", "?key=eq.warranty", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({
          title_i18n: { en: warTitleEn.trim(), zh: warTitleZh.trim() },
          content_i18n: { en: warContentEn.trim(), zh: warContentZh.trim() },
          is_active: warActive,
        }),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveDownload(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (busy) return;
    setBusy(true);
    try {
      if (!dlFileUrl.trim()) throw new Error("File URL is required");
      const payload: Partial<DownloadRow> & Pick<DownloadRow, "title_i18n" | "description_i18n" | "file_url" | "sort_order" | "is_active"> = {
        title_i18n: { en: dlTitleEn.trim(), zh: dlTitleZh.trim() },
        description_i18n: { en: dlDescEn.trim(), zh: dlDescZh.trim() },
        file_url: dlFileUrl.trim(),
        file_name: dlFileName.trim() ? dlFileName.trim() : null,
        sort_order: Number.isFinite(dlSort) ? dlSort : 0,
        is_active: dlIsActive,
      };

      if (dlActiveId) {
        await supabase.rest<DownloadRow[]>("services_downloads", `?id=eq.${encodeURIComponent(dlActiveId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify(payload),
        });
      } else {
        const { data } = await supabase.rest<DownloadRow[]>("services_downloads", "", {
          method: "POST",
          headers: { "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify([payload]),
        });
        if (data[0]?.id) setDlActiveId(data[0].id);
      }

      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeDownload(id: string) {
    setError(null);
    if (busy) return;
    setBusy(true);
    try {
      await supabase.rest<void>("services_downloads", `?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
      if (dlActiveId === id) resetDownloadForm();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function updateFeedbackStatus(id: string, status: string) {
    setError(null);
    if (busy) return;
    setBusy(true);
    try {
      await supabase.rest<FeedbackRow[]>("feedback_submissions", `?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ status }),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("warranty")}
          className={
            tab === "warranty"
              ? "rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800"
              : "rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          }
        >
          Warranty
        </button>
        <button
          type="button"
          onClick={() => setTab("downloads")}
          className={
            tab === "downloads"
              ? "rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800"
              : "rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          }
        >
          Downloads
        </button>
        <button
          type="button"
          onClick={() => setTab("feedback")}
          className={
            tab === "feedback"
              ? "rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800"
              : "rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          }
        >
          Feedback
        </button>
      </div>

      {loading ? <div className="text-sm text-zinc-600">Loading...</div> : null}
      {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      {tab === "warranty" ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="text-base font-semibold text-zinc-900">Warranty policy</div>
          <form onSubmit={saveWarranty} className="mt-4 space-y-4">
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Title (EN)</div>
              <input
                value={warTitleEn}
                onChange={(e) => setWarTitleEn(e.target.value)}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Title (ZH)</div>
              <input
                value={warTitleZh}
                onChange={(e) => setWarTitleZh(e.target.value)}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Content (EN)</div>
              <textarea
                value={warContentEn}
                onChange={(e) => setWarContentEn(e.target.value)}
                rows={10}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Content (ZH)</div>
              <textarea
                value={warContentZh}
                onChange={(e) => setWarContentZh(e.target.value)}
                rows={10}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" checked={warActive} onChange={(e) => setWarActive(e.target.checked)} />
              Active
            </label>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? "Saving..." : "Save"}
            </button>
          </form>
        </div>
      ) : null}

      {tab === "downloads" ? (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_520px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold text-zinc-900">Downloads</div>
              <button
                type="button"
                onClick={resetDownloadForm}
                className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                New download
              </button>
            </div>
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
              <div className="grid grid-cols-[1fr_120px_120px] gap-3 border-b border-zinc-200 px-4 py-3 text-xs font-semibold text-zinc-500">
                <div>Title</div>
                <div>Status</div>
                <div>Action</div>
              </div>
              <div className="divide-y divide-zinc-200">
                {downloads.map((d) => (
                  <div key={d.id} className="grid grid-cols-[1fr_120px_120px] gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setDlActiveId(d.id)}
                      className="truncate text-left text-sm font-medium text-zinc-900 hover:underline"
                    >
                      {getI18nText(d.title_i18n, "en") || getI18nText(d.title_i18n, "zh") || d.file_name || d.file_url}
                    </button>
                    <div className="text-sm text-zinc-700">{d.is_active ? "Active" : "Hidden"}</div>
                    <button
                      type="button"
                      onClick={() => void removeDownload(d.id)}
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
            <div className="text-base font-semibold text-zinc-900">{dlActiveId ? "Edit" : "Create"}</div>
            <form onSubmit={saveDownload} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <label className="block space-y-1">
                  <div className="text-sm font-medium text-zinc-900">Title (EN)</div>
                  <input
                    value={dlTitleEn}
                    onChange={(e) => setDlTitleEn(e.target.value)}
                    className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                  />
                </label>
                <label className="block space-y-1">
                  <div className="text-sm font-medium text-zinc-900">Title (ZH)</div>
                  <input
                    value={dlTitleZh}
                    onChange={(e) => setDlTitleZh(e.target.value)}
                    className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                  />
                </label>
                <label className="block space-y-1">
                  <div className="text-sm font-medium text-zinc-900">Description (EN)</div>
                  <input
                    value={dlDescEn}
                    onChange={(e) => setDlDescEn(e.target.value)}
                    className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                  />
                </label>
                <label className="block space-y-1">
                  <div className="text-sm font-medium text-zinc-900">Description (ZH)</div>
                  <input
                    value={dlDescZh}
                    onChange={(e) => setDlDescZh(e.target.value)}
                    className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                  />
                </label>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-zinc-900">File (PDF / ZIP / etc.)</div>
                <input
                  type="file"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    void (async () => {
                      setBusy(true);
                      setError(null);
                      try {
                        const url = await uploadSiteFile(f);
                        setDlFileUrl(url);
                        setDlFileName(f.name);
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
                  value={dlFileUrl}
                  onChange={(e) => setDlFileUrl(e.target.value)}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                  placeholder="Or paste file URL"
                />
                <input
                  value={dlFileName}
                  onChange={(e) => setDlFileName(e.target.value)}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                  placeholder="File name (optional)"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <div className="text-sm font-medium text-zinc-900">Sort</div>
                  <input
                    type="number"
                    value={dlSort}
                    onChange={(e) => setDlSort(Number(e.target.value))}
                    className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                  />
                </label>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
                    <input type="checkbox" checked={dlIsActive} onChange={(e) => setDlIsActive(e.target.checked)} />
                    Active
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="inline-flex w-full items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? "Saving..." : "Save"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {tab === "feedback" ? (
        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 px-6 py-4">
            <div className="text-base font-semibold text-zinc-900">Feedback submissions (latest 100)</div>
          </div>
          <div className="divide-y divide-zinc-200">
            {feedback.map((f) => (
              <div key={f.id} className="grid grid-cols-1 gap-4 px-6 py-4 lg:grid-cols-[1fr_120px]">
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-zinc-900">
                    {f.name} · {f.phone || "No phone"} · {f.email}
                  </div>
                  <div className="text-xs text-zinc-500">{new Date(f.created_at).toLocaleString()}</div>
                  {f.company ? <div className="text-sm text-zinc-700">Company: {f.company}</div> : null}
                  {f.product_model ? <div className="text-sm text-zinc-700">Product model: {f.product_model}</div> : null}
                  <div className="whitespace-pre-wrap text-sm text-zinc-800">{f.message}</div>
                </div>
                <div className="flex items-start gap-2 lg:justify-end">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void updateFeedbackStatus(f.id, f.status === "resolved" ? "new" : "resolved")}
                    className={
                      f.status === "resolved"
                        ? "rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                        : "rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    }
                  >
                    {f.status === "resolved" ? "Reopen" : "Resolve"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

