import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import PageBanner from "@/components/PageBanner";
import { supabase, supabaseEnabled } from "@/lib/supabaseClient";

export default function ShopAccount() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = (params.get("next") ?? "/shop").trim() || "/shop";

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => email.trim() && password.trim(), [email, password]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabaseEnabled) return;
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        await supabase.auth.signInWithPassword({ email: email.trim(), password: password.trim() });
      } else {
        await supabase.auth.signUp({ email: email.trim(), password: password.trim() });
      }
      nav(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageBanner title="Account" subtitle="Login / Sign up to place orders." backTo={{ label: "Back to Shop", href: "/shop" }} pageKey="shop" />
      <div className="mx-auto max-w-md space-y-5 px-6 py-16">
        {!supabaseEnabled ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">Supabase is not configured.</div>
        ) : null}
        {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={
              mode === "login"
                ? "flex-1 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                : "flex-1 rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
            }
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={
              mode === "signup"
                ? "flex-1 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                : "flex-1 rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
            }
          >
            Sign up
          </button>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-zinc-200 bg-white p-8">
          <div className="space-y-4">
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Email</div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Password</div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <button
              type="submit"
              disabled={busy || !canSubmit}
              className="inline-flex w-full items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
            </button>
          </div>
        </form>

        <div className="text-xs text-zinc-500">
          By signing up you may receive a confirmation email depending on Supabase Auth settings.
        </div>

        <div className="text-sm">
          <Link to="/shop/orders" className="font-semibold text-emerald-700 hover:underline">
            View my orders
          </Link>
        </div>
      </div>
    </div>
  );
}
