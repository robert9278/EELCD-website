import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import PageBanner from "@/components/PageBanner";
import { supabase, supabaseEnabled } from "@/lib/supabaseClient";
import { clearCart, loadCart, updateCartItem } from "@/lib/shopCart";

type ProductRow = {
  id: string;
  slug: string;
  name_i18n: Record<string, string>;
  shop_price_cents: number | null;
  shop_currency: string;
  shop_stock_qty: number | null;
  is_active: boolean;
  shop_is_live: boolean;
};

function formatMoney(currency: string, cents: number) {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export default function ShopCart() {
  const nav = useNavigate();
  const [cart, setCart] = useState(() => loadCart());
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseEnabled) return;
    const ids = cart.map((c) => c.product_id).filter(Boolean);
    if (ids.length === 0) {
      setProducts([]);
      return;
    }
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await supabase.rest<ProductRow[]>(
          "products",
          `?select=id,slug,name_i18n,shop_price_cents,shop_currency,shop_stock_qty,is_active,shop_is_live&id=in.(${ids
            .map(encodeURIComponent)
            .join(",")})`
        );
        setProducts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load cart products");
        setProducts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [cart]);

  const lines = useMemo(() => {
    const pMap = new Map(products.map((p) => [p.id, p] as const));
    return cart
      .map((c) => {
        const p = pMap.get(c.product_id);
        if (!p) return null;
        const name = p.name_i18n?.en || p.name_i18n?.zh || p.slug;
        const price = p.shop_price_cents ?? 0;
        const qty = c.quantity || 0;
        const line = price * qty;
        return { product: p, name, qty, price, line };
      })
      .filter(Boolean) as Array<{ product: ProductRow; name: string; qty: number; price: number; line: number }>;
  }, [cart, products]);

  const subtotal = lines.reduce((s, l) => s + l.line, 0);
  const currency = lines[0]?.product.shop_currency || "USD";

  return (
    <div>
      <PageBanner title="Cart" subtitle="Review items before checkout." backTo={{ label: "Back to Shop", href: "/shop" }} pageKey="shop" />
      <div className="mx-auto max-w-4xl space-y-6 px-6 py-16">
        {loading ? <div className="text-sm text-zinc-600">Loading...</div> : null}
        {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        {lines.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700">Cart is empty.</div>
        ) : (
          <div className="space-y-4">
            <div className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white">
              {lines.map((l) => (
                <div key={l.product.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-zinc-900">{l.name}</div>
                    <div className="mt-1 text-xs text-zinc-600">{l.price > 0 ? formatMoney(l.product.shop_currency, l.price) : "Price TBA"}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={0}
                      value={l.qty}
                      onChange={(e) => {
                        const next = updateCartItem(l.product.id, Number(e.target.value));
                        setCart(next);
                      }}
                      className="w-24 rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                    />
                    <div className="w-28 text-right text-sm font-semibold text-zinc-900">
                      {l.line > 0 ? formatMoney(l.product.shop_currency, l.line) : "—"}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-zinc-700">
                Subtotal: <span className="font-semibold text-zinc-900">{formatMoney(currency, subtotal)}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    clearCart();
                    setCart([]);
                  }}
                  className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => nav("/shop/checkout")}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Checkout
                </button>
              </div>
            </div>
          </div>
        )}

        {!supabaseEnabled ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
            Supabase is not configured. Cart checkout requires Supabase.
          </div>
        ) : null}

        <div className="text-xs text-zinc-500">
          For now, payment is recorded as pending and can be confirmed by admin later.
        </div>
      </div>
    </div>
  );
}
