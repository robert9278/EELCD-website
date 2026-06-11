import { FormEvent, useEffect, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

type BrandingRow = {
  key: string;
  logo_url: string | null;
  logo_alt: string | null;
  is_active: boolean;
};

export default function BrandAdmin() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [logoUrl, setLogoUrl] = useState("");
  const [logoAlt, setLogoAlt] = useState("");
  const [isActive, setIsActive] = useState(true);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.rest<BrandingRow[]>(
        "site_branding",
        "?select=key,logo_url,logo_alt,is_active&key=eq.default&limit=1"
      );
      const row = data[0];
      if (row) {
        setLogoUrl(row.logo_url ?? "");
        setLogoAlt(row.logo_alt ?? "");
        setIsActive(row.is_active);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load branding settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function uploadLogo(file: File) {
    setBusy(true);
    setError(null);
    try {
      const path = `logos/${Date.now()}-${file.name}`;
      const uploaded = await supabase.storage.uploadPublic("site-media", path, file);
      setLogoUrl(uploaded.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await supabase.rest<BrandingRow[]>("site_branding", "?key=eq.default", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({
          logo_url: logoUrl.trim() || null,
          logo_alt: logoAlt.trim() || null,
          is_active: isActive,
        }),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_420px]">
      <div className="space-y-4">
        <div className="text-lg font-semibold text-zinc-900">Brand</div>

        {loading ? <div className="text-sm text-zinc-600">Loading...</div> : null}
        {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="text-sm font-semibold text-zinc-900">Preview</div>
          <div className="mt-3 flex items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 p-6">
            {logoUrl.trim() ? (
              <img src={logoUrl.trim()} alt={logoAlt || "Logo"} className="h-[3.6rem] w-auto" />
            ) : (
              <div className="text-sm text-zinc-500">No logo</div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="text-base font-semibold text-zinc-900">Logo Settings</div>

        <form onSubmit={save} className="mt-4 space-y-4">
          <label className="block space-y-1">
            <div className="text-sm font-medium text-zinc-900">Logo URL</div>
            <input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="/logo-eagleeye-tech.svg or https://..."
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
            />
          </label>

          <label className="block space-y-1">
            <div className="text-sm font-medium text-zinc-900">Alt text</div>
            <input
              value={logoAlt}
              onChange={(e) => setLogoAlt(e.target.value)}
              placeholder="EAGLEEYE TECH"
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50">
              Upload logo
              <input
                type="file"
                accept="image/*,.svg"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0];
                  if (!f) return;
                  void uploadLogo(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Active
            </label>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Saving..." : "Save"}
          </button>
        </form>
      </div>
    </div>
  );
}
