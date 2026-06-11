import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import PageBanner from "@/components/PageBanner";
import { supabase, supabaseEnabled } from "@/lib/supabaseClient";
import { addToCart, loadCart } from "@/lib/shopCart";

type ProductRow = {
  id: string;
  slug: string;
  category: string;
  name_i18n: Record<string, string>;
  short_description_i18n: Record<string, string>;
  shop_is_live: boolean;
  shop_price_cents: number | null;
  shop_currency: string;
  shop_stock_qty: number | null;
  is_active: boolean;
  created_at: string;
};

type ProductMediaRow = {
  id: string;
  product_id: string;
  kind: string;
  url: string;
  sort_order: number;
  is_primary: boolean;
};

type ProductWithRelations = ProductRow & { product_media?: ProductMediaRow[] };

export default function Shop() {
  const [items, setItems] = useState<ProductWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(() => loadCart().reduce((s, i) => s + (i.quantity || 0), 0));

  useEffect(() => {
    if (!supabaseEnabled) return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await supabase.rest<ProductWithRelations[]>(
          "products",
          "?select=id,slug,category,name_i18n,short_description_i18n,shop_is_live,shop_price_cents,shop_currency,shop_stock_qty,is_active,created_at,product_media(*)&is_active=eq.true&shop_is_live=eq.true&order=created_at.desc"
        );
        setItems(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load shop products");
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cards = useMemo(() => {
    return items.map((p) => {
      const media = (p.product_media ?? []).filter((m) => m.kind === "image");
      media.sort((a, b) => (a.is_primary === b.is_primary ? a.sort_order - b.sort_order : a.is_primary ? -1 : 1));
      const image = media[0]?.url ?? "";
      const name = p.name_i18n?.en || p.name_i18n?.zh || p.slug;
      const desc = p.short_description_i18n?.en || p.short_description_i18n?.zh || "";
      const stockQty = p.shop_stock_qty;
      const hasStock = typeof stockQty === "number" ? stockQty > 0 : true;
      return { ...p, image, name, desc, hasStock };
    });
  }, [items]);

  return (
    <div>
      <PageBanner title="Shop" subtitle="Browse products, add to cart, and place orders." pageKey="shop" />
      <div className="mx-auto max-w-6xl space-y-8 px-6 py-16">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-zinc-600">{supabaseEnabled ? "" : "Supabase not configured."}</div>
          <Link
            to="/shop/cart"
            className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            Cart ({cartCount})
          </Link>
        </div>

        {loading ? <div className="text-sm text-zinc-600">Loading...</div> : null}
        {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
              <Link to={`/products/${p.slug}`} className="block">
                <div className="aspect-[4/3] bg-zinc-50">
                  {p.image ? <img src={p.image} alt="" className="h-full w-full object-contain p-8" loading="lazy" /> : null}
                </div>
              </Link>
              <div className="space-y-3 p-5">
                <div className="text-xs font-semibold text-emerald-700">{p.category}</div>
                <Link to={`/products/${p.slug}`} className="block">
                  <div className="text-base font-semibold text-zinc-900 hover:underline">{p.name}</div>
                </Link>
                <Link to={`/products/${p.slug}`} className="block">
                  <div className="text-sm text-zinc-600">{p.desc}</div>
                </Link>
                <div className="flex items-center justify-between gap-3">
                  {typeof p.shop_stock_qty === "number" ? (
                    <div className="text-xs text-zinc-600">Stock: {p.shop_stock_qty}</div>
                  ) : (
                    <div className="text-xs text-zinc-600">Stock: —</div>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!p.hasStock}
                  onClick={() => {
                    addToCart(p.id, 1);
                    setCartCount(loadCart().reduce((s, i) => s + (i.quantity || 0), 0));
                  }}
                  className="inline-flex w-full items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {p.hasStock ? "Add to cart" : "Out of stock"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
