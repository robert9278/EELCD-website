import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import PageBanner from "@/components/PageBanner";
import { supabase, supabaseEnabled } from "@/lib/supabaseClient";
import { clearCart } from "@/lib/shopCart";

type OrderRow = {
  id: string;
  status: string;
  currency: string;
  total_cents: number;
  created_at: string;
};

function formatMoney(currency: string, cents: number) {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export default function ShopOrders() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const highlight = (params.get("highlight") ?? "").trim();
  const clearCartFlag = (params.get("clear_cart") ?? "").trim();

  const [items, setItems] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (clearCartFlag === "1") clearCart();
  }, [clearCartFlag]);

  useEffect(() => {
    if (!supabaseEnabled) return;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        nav("/shop/account?next=/shop/orders");
      }
    })();
  }, [nav]);

  useEffect(() => {
    if (!supabaseEnabled) return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await supabase.rest<OrderRow[]>(
          "shop_orders",
          "?select=id,status,currency,total_cents,created_at&order=created_at.desc&limit=50"
        );
        setItems(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load orders");
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <PageBanner title="My Orders" subtitle="Track order status and payment." backTo={{ label: "Back to Shop", href: "/shop" }} pageKey="shop" />
      <div className="mx-auto max-w-4xl space-y-5 px-6 py-16">
        {!supabaseEnabled ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">Supabase is not configured.</div>
        ) : null}
        {loading ? <div className="text-sm text-zinc-600">Loading...</div> : null}
        {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        {items.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700">No orders.</div>
        ) : (
          <div className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white">
            {items.map((o) => (
              <div
                key={o.id}
                className={highlight && highlight === o.id ? "bg-emerald-50/50 p-4" : "p-4"}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-zinc-900">Order #{o.id}</div>
                    <div className="mt-1 text-xs text-zinc-600">{new Date(o.created_at).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">{o.status}</span>
                    <div className="text-sm font-semibold text-zinc-900">{formatMoney(o.currency, o.total_cents)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-sm">
          <Link to="/shop/after-sales" className="font-semibold text-emerald-700 hover:underline">
            Need after-sales support? Submit request
          </Link>
        </div>
      </div>
    </div>
  );
}
