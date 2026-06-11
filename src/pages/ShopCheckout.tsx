import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import PageBanner from "@/components/PageBanner";
import { supabase, supabaseEnabled } from "@/lib/supabaseClient";
import { loadCart } from "@/lib/shopCart";

type ProductRow = {
  id: string;
  slug: string;
  name_i18n: Record<string, string>;
  shop_price_cents: number | null;
  shop_currency: string;
  shop_is_live: boolean;
  is_active: boolean;
};

export default function ShopCheckout() {
  const nav = useNavigate();
  const [cart] = useState(() => loadCart());
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (!supabaseEnabled) return;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        nav("/shop/account?next=/shop/checkout");
      }
    })();
  }, [nav]);

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
          `?select=id,slug,name_i18n,shop_price_cents,shop_currency,shop_is_live,is_active&id=in.(${ids
            .map(encodeURIComponent)
            .join(",")})`
        );
        setProducts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load checkout products");
        setProducts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [cart]);

  const items = useMemo(() => {
    const pMap = new Map(products.map((p) => [p.id, p] as const));
    return cart
      .map((c) => {
        const p = pMap.get(c.product_id);
        if (!p) return null;
        return { product_id: p.id, quantity: c.quantity };
      })
      .filter(Boolean) as Array<{ product_id: string; quantity: number }>;
  }, [cart, products]);

  async function placeOrder(e: FormEvent) {
    e.preventDefault();
    if (!supabaseEnabled) return;
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await supabase.rpc<string>("place_order", {
        items,
        shipping: {
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          country: country.trim(),
          address: address.trim(),
          currency: "USD",
        },
      });
      nav(`/shop/pay?order_id=${encodeURIComponent(data)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageBanner title="Checkout" subtitle="Enter shipping info and continue to payment." backTo={{ label: "Back to Cart", href: "/shop/cart" }} pageKey="shop" />
      <div className="mx-auto max-w-4xl space-y-6 px-6 py-16">
        {!supabaseEnabled ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">Supabase is not configured.</div>
        ) : null}
        {loading ? <div className="text-sm text-zinc-600">Loading...</div> : null}
        {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        {items.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700">
            Cart is empty. <Link to="/shop">Go shopping</Link>
          </div>
        ) : (
          <form onSubmit={placeOrder} className="rounded-2xl border border-zinc-200 bg-white p-8">
            <div className="text-base font-semibold text-zinc-900">Shipping info</div>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block space-y-1">
                <div className="text-sm font-medium text-zinc-900">Full Name</div>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                />
              </label>
              <label className="block space-y-1">
                <div className="text-sm font-medium text-zinc-900">Email</div>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
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
                <div className="text-sm font-medium text-zinc-900">Country</div>
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  required
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                />
              </label>
              <label className="block space-y-1 md:col-span-2">
                <div className="text-sm font-medium text-zinc-900">Address</div>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  required
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Creating..." : "Continue to payment"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
