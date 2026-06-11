import { FormEvent, useEffect, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

type ContactRow = {
  key: string;
  email: string | null;
  phone: string | null;
  teams: string | null;
  address: string | null;
  google_maps_url: string | null;
  facebook: string | null;
  linkedin: string | null;
  tiktok: string | null;
  is_active: boolean;
};

export default function ContactAdmin() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [teams, setTeams] = useState("");
  const [address, setAddress] = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [facebook, setFacebook] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [isActive, setIsActive] = useState(true);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.rest<ContactRow[]>(
        "site_contacts",
        "?select=key,email,phone,teams,address,google_maps_url,facebook,linkedin,tiktok,is_active&key=eq.default&limit=1"
      );
      const row = data[0];
      if (row) {
        setEmail(row.email ?? "");
        setPhone(row.phone ?? "");
        setTeams(row.teams ?? "");
        setAddress(row.address ?? "");
        setGoogleMapsUrl(row.google_maps_url ?? "");
        setFacebook(row.facebook ?? "");
        setLinkedin(row.linkedin ?? "");
        setTiktok(row.tiktok ?? "");
        setIsActive(row.is_active);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contact settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await supabase.rest<ContactRow[]>("site_contacts", "?key=eq.default", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          email: email.trim() || null,
          phone: phone.trim() || null,
          teams: teams.trim() || null,
          address: address.trim() || null,
          google_maps_url: googleMapsUrl.trim() || null,
          facebook: facebook.trim() || null,
          linkedin: linkedin.trim() || null,
          tiktok: tiktok.trim() || null,
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
    <div className="rounded-xl border border-zinc-200 bg-white p-6">
      <div className="text-base font-semibold text-zinc-900">Contact Channels</div>
      <div className="mt-1 text-sm text-zinc-600">Edit email/phone and social links shown on Contact Us page.</div>

      {loading ? <div className="mt-4 text-sm text-zinc-600">Loading...</div> : null}
      {error ? <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <form onSubmit={save} className="mt-4 space-y-4">
        <label className="block space-y-1">
          <div className="text-sm font-medium text-zinc-900">Email</div>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
          />
        </label>

        <label className="block space-y-1">
          <div className="text-sm font-medium text-zinc-900">Phone</div>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
          />
        </label>

        <label className="block space-y-1">
          <div className="text-sm font-medium text-zinc-900">Teams (link or email)</div>
          <input
            value={teams}
            onChange={(e) => setTeams(e.target.value)}
            placeholder="https://teams.microsoft.com/l/chat/... or user@company.com"
            className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
          />
        </label>

        <label className="block space-y-1">
          <div className="text-sm font-medium text-zinc-900">Company address</div>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="深圳市宝安区美合意谷人和楼201室"
            className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
          />
        </label>

        <label className="block space-y-1">
          <div className="text-sm font-medium text-zinc-900">Google Maps link (optional)</div>
          <input
            value={googleMapsUrl}
            onChange={(e) => setGoogleMapsUrl(e.target.value)}
            placeholder="https://www.google.com/maps?q=..."
            className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
          />
        </label>

        <label className="block space-y-1">
          <div className="text-sm font-medium text-zinc-900">Facebook</div>
          <input
            value={facebook}
            onChange={(e) => setFacebook(e.target.value)}
            placeholder="https://facebook.com/..."
            className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
          />
        </label>

        <label className="block space-y-1">
          <div className="text-sm font-medium text-zinc-900">LinkedIn</div>
          <input
            value={linkedin}
            onChange={(e) => setLinkedin(e.target.value)}
            placeholder="https://linkedin.com/company/..."
            className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
          />
        </label>

        <label className="block space-y-1">
          <div className="text-sm font-medium text-zinc-900">TikTok</div>
          <input
            value={tiktok}
            onChange={(e) => setTiktok(e.target.value)}
            placeholder="https://tiktok.com/@..."
            className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
          />
        </label>

        <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
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
  );
}
