import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Mail, MessageCircle, Video, X } from "lucide-react";

import { useSiteContact } from "@/lib/contact";

const STORAGE_KEY = "ee_floating_contact_hidden";
const STORAGE_POS_Y = "ee_floating_contact_pos_y";

function normalizePhoneForWhatsApp(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

export default function FloatingContact() {
  const contact = useSiteContact();
  const [hidden, setHidden] = useState(() => localStorage.getItem(STORAGE_KEY) === "1");
  const phoneText = (contact?.phone ?? "").trim();
  const emailText = (contact?.email ?? "").trim();
  const teamsText = (contact?.teams ?? "").trim();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startY: number; startTop: number } | null>(null);
  const [topPx, setTopPx] = useState<number | null>(null);

  const waLink = useMemo(() => {
    const p = (contact?.phone ?? "").trim();
    if (!p) return "";
    const digits = normalizePhoneForWhatsApp(p);
    if (!digits) return "";
    return `https://wa.me/${digits}`;
  }, [contact?.phone]);

  const mailto = useMemo(() => {
    const e = (contact?.email ?? "").trim();
    if (!e) return "";
    return `mailto:${e}`;
  }, [contact?.email]);

  const teamsLink = useMemo(() => {
    const v = (contact?.teams ?? "").trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    if (v.includes("@")) return `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(v)}`;
    return `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(v)}`;
  }, [contact?.teams]);

  function hide() {
    setHidden(true);
    localStorage.setItem(STORAGE_KEY, "1");
  }

  function show() {
    setHidden(false);
    localStorage.removeItem(STORAGE_KEY);
  }

  useEffect(() => {
    if (hidden) return;
    const saved = Number.parseFloat(localStorage.getItem(STORAGE_POS_Y) || "");
    if (Number.isFinite(saved)) {
      setTopPx(saved);
      return;
    }
    const el = panelRef.current;
    const h = el?.getBoundingClientRect().height ?? 220;
    setTopPx(Math.max(24, window.innerHeight - h - 80));
  }, [hidden]);

  useEffect(() => {
    if (hidden) return;
    if (topPx == null) return;
    function clampAndSave() {
      const el = panelRef.current;
      const h = el?.getBoundingClientRect().height ?? 220;
      const next = Math.min(Math.max(24, topPx), Math.max(24, window.innerHeight - h - 24));
      if (next !== topPx) setTopPx(next);
      localStorage.setItem(STORAGE_POS_Y, String(next));
    }
    clampAndSave();
    function onResize() {
      clampAndSave();
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [hidden, topPx]);

  if (hidden) {
    return (
      <button
        type="button"
        onClick={show}
        className="fixed bottom-24 right-4 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50"
        aria-label="Open contact"
      >
        <MessageCircle className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      className="fixed right-4 z-40 w-28 overflow-hidden rounded-xl border border-white/30 bg-white/75 shadow-lg backdrop-blur"
      style={topPx == null ? undefined : { top: `${topPx}px` }}
    >
      <div
        className="flex cursor-move items-center justify-between border-b border-white/30 px-2 py-2"
        onPointerDown={(e) => {
          const el = panelRef.current;
          if (!el) return;
          el.setPointerCapture(e.pointerId);
          dragRef.current = { startY: e.clientY, startTop: topPx ?? el.getBoundingClientRect().top };
        }}
        onPointerMove={(e) => {
          if (!dragRef.current) return;
          const el = panelRef.current;
          if (!el) return;
          const h = el.getBoundingClientRect().height;
          const raw = dragRef.current.startTop + (e.clientY - dragRef.current.startY);
          const next = Math.min(Math.max(24, raw), Math.max(24, window.innerHeight - h - 24));
          setTopPx(next);
        }}
        onPointerUp={() => {
          dragRef.current = null;
          if (topPx != null) localStorage.setItem(STORAGE_POS_Y, String(topPx));
        }}
        onPointerCancel={() => {
          dragRef.current = null;
          if (topPx != null) localStorage.setItem(STORAGE_POS_Y, String(topPx));
        }}
      >
        <div className="text-xs font-semibold text-zinc-900">Contact</div>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            hide();
          }}
          className="rounded-md p-1 text-zinc-500 hover:bg-white/70"
          aria-label="Hide"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2 p-2">
        <a
          href={waLink || undefined}
          target={waLink ? "_blank" : undefined}
          rel={waLink ? "noreferrer" : undefined}
          aria-disabled={!waLink}
          title={phoneText || "Phone not set"}
          className={
            waLink
              ? "group relative flex items-center justify-center gap-2 rounded-lg border border-white/40 bg-white/60 px-2 py-2 text-xs font-semibold text-zinc-800 hover:bg-white/80"
              : "group relative flex items-center justify-center gap-2 rounded-lg border border-white/30 bg-white/50 px-2 py-2 text-xs font-semibold text-zinc-400"
          }
        >
          <MessageCircle className="h-4 w-4" />
          WA
          <span className="pointer-events-none absolute right-full top-1/2 mr-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 shadow-sm group-hover:block">
            {phoneText || "Phone not set"}
          </span>
        </a>

        <a
          href={mailto || undefined}
          aria-disabled={!mailto}
          title={emailText || "Email not set"}
          className={
            mailto
              ? "group relative flex items-center justify-center gap-2 rounded-lg border border-white/40 bg-white/60 px-2 py-2 text-xs font-semibold text-zinc-800 hover:bg-white/80"
              : "group relative flex items-center justify-center gap-2 rounded-lg border border-white/30 bg-white/50 px-2 py-2 text-xs font-semibold text-zinc-400"
          }
        >
          <Mail className="h-4 w-4" />
          Mail
          <span className="pointer-events-none absolute right-full top-1/2 mr-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 shadow-sm group-hover:block">
            {emailText || "Email not set"}
          </span>
        </a>

        <a
          href={teamsLink || undefined}
          target={teamsLink ? "_blank" : undefined}
          rel={teamsLink ? "noreferrer" : undefined}
          aria-disabled={!teamsLink}
          title={teamsText || "Teams not set"}
          className={
            teamsLink
              ? "group relative flex items-center justify-center gap-2 rounded-lg border border-white/40 bg-white/60 px-2 py-2 text-xs font-semibold text-zinc-800 hover:bg-white/80"
              : "group relative flex items-center justify-center gap-2 rounded-lg border border-white/30 bg-white/50 px-2 py-2 text-xs font-semibold text-zinc-400"
          }
        >
          <Video className="h-4 w-4" />
          Teams
          <span className="pointer-events-none absolute right-full top-1/2 mr-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 shadow-sm group-hover:block">
            {teamsText || "Teams not set"}
          </span>
        </a>

        <Link
          to="/inquiry"
          className="flex items-center justify-center rounded-lg bg-emerald-600/90 px-2 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
        >
          Quote
        </Link>
      </div>
    </div>
  );
}
