import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import PageBanner from "@/components/PageBanner";
import { supabase, supabaseEnabled } from "@/lib/supabaseClient";

export default function ShopPay() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const orderId = (params.get("order_id") ?? "").trim();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseEnabled) return;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        nav(`/shop/account?next=/shop/pay?order_id=${encodeURIComponent(orderId)}`);
      }
    })();
  }, [nav, orderId]);

  async function payWithStripe() {
    if (!supabaseEnabled) return;
    if (!orderId) return;
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await supabase.functions.invoke<{ url: string }>("create-stripe-checkout", { order_id: orderId });
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stripe checkout failed");
      setBusy(false);
    }
  }

  async function payWithPayPal() {
    if (!supabaseEnabled) return;
    if (!orderId) return;
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await supabase.functions.invoke<{ url: string }>("create-paypal-order", { order_id: orderId });
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "PayPal checkout failed");
      setBusy(false);
    }
  }

  return (
    <div>
      <PageBanner title="Payment" subtitle="Choose payment method." backTo={{ label: "Back to Cart", href: "/shop/cart" }} pageKey="shop" />
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-16">
        {!orderId ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700">
            Missing order id. <Link to="/shop/cart">Back to cart</Link>
          </div>
        ) : null}

        {!supabaseEnabled ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">Supabase is not configured.</div>
        ) : null}

        {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={busy || !orderId}
            onClick={payWithStripe}
            className="rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            Pay with Stripe
          </button>
          <button
            type="button"
            disabled={busy || !orderId}
            onClick={payWithPayPal}
            className="rounded-md bg-[#0070ba] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#003087] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Pay with PayPal
          </button>
        </div>

        <div className="text-xs text-zinc-500">Payment confirms the order and finalizes stock deduction.</div>
      </div>
    </div>
  );
}
