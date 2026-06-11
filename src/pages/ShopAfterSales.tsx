import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import PageBanner from "@/components/PageBanner";
import { supabase, supabaseEnabled } from "@/lib/supabaseClient";

type AfterSalesInsert = {
  user_id: string;
  order_id: string | null;
  subject: string;
  message: string;
};

type OrderRow = { id: string; created_at: string };

export default function ShopAfterSales() {
  const nav = useNavigate();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [orderId, setOrderId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!supabaseEnabled) return;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        nav("/shop/account?next=/shop/after-sales");
        return;
      }
      try {
        const { data: rows } = await supabase.rest<OrderRow[]>("shop_orders", "?select=id,created_at&order=created_at.desc&limit=50");
        setOrders(rows);
      } catch {
        setOrders([]);
      }
    })();
  }, [nav]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabaseEnabled) return;
    if (busy) return;
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        nav("/shop/account?next=/shop/after-sales");
        return;
      }
      const payload: AfterSalesInsert = {
        user_id: session.user.id,
        order_id: orderId.trim() ? orderId.trim() : null,
        subject: subject.trim(),
        message: message.trim(),
      };
      if (!payload.subject) throw new Error("Subject is required");
      if (!payload.message) throw new Error("Message is required");

      await supabase.rest<void>("after_sales_requests", "", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify([payload]),
      });

      setDone(true);
      setOrderId("");
      setSubject("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageBanner title="After-sales" subtitle="Submit support request for your orders." backTo={{ label: "Back to Orders", href: "/shop/orders" }} pageKey="shop" />
      <div className="mx-auto max-w-4xl space-y-6 px-6 py-16">
        {!supabaseEnabled ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">Supabase is not configured.</div>
        ) : null}
        {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {done ? <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Submitted.</div> : null}

        <form onSubmit={submit} className="rounded-2xl border border-zinc-200 bg-white p-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Order (optional)</div>
              <select
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              >
                <option value="">No order</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 md:col-span-2">
              <div className="text-sm font-medium text-zinc-900">Subject</div>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <label className="block space-y-1 md:col-span-2">
              <div className="text-sm font-medium text-zinc-900">Message</div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Submitting..." : "Submit"}
          </button>
        </form>

        <div className="text-sm">
          <Link to="/contact" className="font-semibold text-emerald-700 hover:underline">
            Or contact us directly
          </Link>
        </div>
      </div>
    </div>
  );
}
