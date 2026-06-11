import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import PageBanner from "@/components/PageBanner";
import { supabase, supabaseEnabled } from "@/lib/supabaseClient";
import { clearCart } from "@/lib/shopCart";

export default function ShopPaypalReturn() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const orderId = (params.get("order_id") ?? "").trim();
  const paypalOrderId = (params.get("token") ?? params.get("PayerID") ?? "").trim();

  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseEnabled) return;
    if (!orderId || !paypalOrderId) {
      setBusy(false);
      setError("Missing PayPal return params");
      return;
    }
    void (async () => {
      try {
        await supabase.functions.invoke("capture-paypal-order", { order_id: orderId, paypal_order_id: paypalOrderId });
        clearCart();
        nav(`/shop/orders?highlight=${encodeURIComponent(orderId)}&clear_cart=1`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "PayPal capture failed");
        setBusy(false);
      }
    })();
  }, [nav, orderId, paypalOrderId]);

  return (
    <div>
      <PageBanner title="PayPal" subtitle="Finalizing payment..." pageKey="shop" />
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-16">
        {!supabaseEnabled ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">Supabase is not configured.</div>
        ) : null}
        {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {busy ? <div className="text-sm text-zinc-600">Processing...</div> : null}
      </div>
    </div>
  );
}
