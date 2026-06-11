import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import ProductsAdmin from "@/pages/admin/ProductsAdmin";
import BannersAdmin from "@/pages/admin/BannersAdmin";
import NewsAdmin from "@/pages/admin/NewsAdmin";
import PagesAdmin from "@/pages/admin/PagesAdmin";
import HomeAdmin from "@/pages/admin/HomeAdmin";
import BrandAdmin from "@/pages/admin/BrandAdmin";
import AboutAdmin from "@/pages/admin/AboutAdmin";
import CaseStudiesAdmin from "@/pages/admin/CaseStudiesAdmin";
import ServicesAdmin from "@/pages/admin/ServicesAdmin";
import MediaAdmin from "@/pages/admin/MediaAdmin";
import ContactAdmin from "@/pages/admin/ContactAdmin";
import { bootstrapFirstAdmin, setAdminSessionTtlSeconds, supabase, supabaseEnabled, type SupabaseSession } from "@/lib/supabaseClient";

export default function Admin() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [ttlMinutes, setTtlMinutes] = useState<number>(() => {
    const raw = localStorage.getItem("ee_admin_session_ttl_minutes");
    const v = raw ? Number.parseInt(raw, 10) : 60;
    return Number.isFinite(v) && v > 0 ? v : 60;
  });

  const tab = params.get("tab") || "products";

  function setTab(next: string) {
    setParams((prev) => {
      prev.set("tab", next);
      return prev;
    });
  }

  if (!supabaseEnabled) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="text-sm font-semibold text-zinc-900">Supabase is not configured</div>
          <div className="mt-2 text-sm text-zinc-600">
            Please set <span className="font-semibold">VITE_SUPABASE_URL</span> and
            <span className="font-semibold"> VITE_SUPABASE_ANON_KEY</span>.
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((s) => {
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    void (async () => {
      setChecking(true);
      setError(null);
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          navigate("/admin/login", { replace: true });
          return;
        }
        setSession(data.session);
        const r = await supabase.rpc<boolean>("is_admin");
        setIsAdmin(Boolean(r.data));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to check session");
      } finally {
        setChecking(false);
      }
    })();
  }, [navigate]);

  useEffect(() => {
    const mins = Math.max(1, Math.floor(ttlMinutes));
    localStorage.setItem("ee_admin_session_ttl_minutes", String(mins));
    setAdminSessionTtlSeconds(mins * 60);
  }, [ttlMinutes]);

  if (checking) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="text-sm text-zinc-600">Loading admin...</div>
      </div>
    );
  }

  if (!session) return null;

  async function tryBootstrap() {
    if (bootstrapping) return;
    setBootstrapping(true);
    setError(null);
    try {
      await bootstrapFirstAdmin(session.user.id);
      const r = await supabase.rpc<boolean>("is_admin");
      setIsAdmin(Boolean(r.data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bootstrap failed");
    } finally {
      setBootstrapping(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Admin</h1>
            <div className="text-sm text-zinc-600">Signed in as {session.user.email || session.user.id}</div>
          </div>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800">
              <span className="text-zinc-600">Auto sign-out</span>
              <select
                value={ttlMinutes}
                onChange={(e) => setTtlMinutes(Number(e.target.value))}
                className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm font-semibold text-zinc-800"
              >
                <option value={15}>15m</option>
                <option value={30}>30m</option>
                <option value={60}>1h</option>
                <option value={120}>2h</option>
                <option value={240}>4h</option>
              </select>
            </label>
            <Link
              to="/products"
              className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
            >
              View site
            </Link>
            <button
              type="button"
              onClick={() => void supabase.auth.signOut().then(() => navigate("/", { replace: true }))}
              className="inline-flex items-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Sign out
            </button>
          </div>
        </div>

        {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        {!isAdmin ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
            <div className="text-sm font-semibold text-amber-900">Admin permission required</div>
            <div className="mt-2 text-sm text-amber-800">
              This user is not in the admin list yet. If this is the first time setting up, log in again on
              <span className="font-semibold"> /admin/login</span> to bootstrap the first admin.
            </div>
            <div className="mt-4">
              <button
                type="button"
                disabled={bootstrapping}
                onClick={() => void tryBootstrap()}
                className="inline-flex items-center rounded-md bg-amber-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {bootstrapping ? "Initializing..." : "Initialize as first admin"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTab("home")}
                className={
                  tab === "home"
                    ? "rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800"
                    : "rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                }
              >
                Home
              </button>
              <button
                type="button"
                onClick={() => setTab("brand")}
                className={
                  tab === "brand"
                    ? "rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800"
                    : "rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                }
              >
                Brand
              </button>
              <button
                type="button"
                onClick={() => setTab("products")}
                className={
                  tab === "products"
                    ? "rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800"
                    : "rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                }
              >
                Products
              </button>
              <button
                type="button"
                onClick={() => setTab("about")}
                className={
                  tab === "about"
                    ? "rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800"
                    : "rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                }
              >
                About
              </button>
              <button
                type="button"
                onClick={() => setTab("case-studies")}
                className={
                  tab === "case-studies"
                    ? "rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800"
                    : "rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                }
              >
                Case Studies
              </button>
              <button
                type="button"
                onClick={() => setTab("services")}
                className={
                  tab === "services"
                    ? "rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800"
                    : "rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                }
              >
                Services
              </button>
              <button
                type="button"
                onClick={() => setTab("banners")}
                className={
                  tab === "banners"
                    ? "rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800"
                    : "rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                }
              >
                Banners
              </button>
              <button
                type="button"
                onClick={() => setTab("news")}
                className={
                  tab === "news"
                    ? "rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800"
                    : "rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                }
              >
                News
              </button>
              <button
                type="button"
                onClick={() => setTab("media")}
                className={
                  tab === "media"
                    ? "rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800"
                    : "rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                }
              >
                Media
              </button>
              <button
                type="button"
                onClick={() => setTab("pages")}
                className={
                  tab === "pages"
                    ? "rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800"
                    : "rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                }
              >
                Pages
              </button>
              <button
                type="button"
                onClick={() => setTab("contact")}
                className={
                  tab === "contact"
                    ? "rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800"
                    : "rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                }
              >
                Contact
              </button>
            </div>

            {tab === "home" ? <HomeAdmin /> : null}
            {tab === "brand" ? <BrandAdmin /> : null}
            {tab === "banners" ? <BannersAdmin /> : null}
            {tab === "news" ? <NewsAdmin /> : null}
            {tab === "media" ? <MediaAdmin /> : null}
            {tab === "pages" ? <PagesAdmin /> : null}
            {tab === "about" ? <AboutAdmin /> : null}
            {tab === "case-studies" ? <CaseStudiesAdmin /> : null}
            {tab === "services" ? <ServicesAdmin /> : null}
            {tab === "products" ? <ProductsAdmin /> : null}
            {tab === "contact" ? <ContactAdmin /> : null}
          </div>
        )}
      </div>
    </div>
  );
}

