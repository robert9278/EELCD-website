import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

export type MediaPickerKind = "image" | "document" | "video" | "all";

export type MediaAsset = {
  id: string;
  bucket: string;
  object_path: string;
  public_url: string;
  file_name: string | null;
  mime_type: string | null;
  kind: "image" | "document" | "video";
  title: string | null;
  description: string | null;
  tags: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function isMissingMediaAssetsTable(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("media_assets") && msg.toLowerCase().includes("schema cache");
}

export default function MediaPicker({
  open,
  onClose,
  kind,
  multi,
  allowBuckets,
  title,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  kind: MediaPickerKind;
  multi: boolean;
  allowBuckets?: string[];
  title?: string;
  onConfirm: (selected: MediaAsset[]) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set());
    setQ("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const base =
          "?select=id,bucket,object_path,public_url,file_name,mime_type,kind,title,description,tags,is_active,created_at,updated_at&order=created_at.desc";
        const query = kind === "all" ? base : `${base}&kind=eq.${encodeURIComponent(kind)}`;
        const { data } = await supabase.rest<MediaAsset[]>("media_assets", query);
        const filtered =
          allowBuckets && allowBuckets.length > 0 ? data.filter((x) => allowBuckets.includes(x.bucket)) : data;
        setItems(filtered);
      } catch (e) {
        if (isMissingMediaAssetsTable(e)) {
          setItems([]);
          setError("media_assets 表未创建，媒体库不可用。请先在 Supabase 执行 0010_media_assets.sql 并刷新。");
        } else {
          setItems([]);
          setError(e instanceof Error ? e.message : "Failed to load media library");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [open, kind, allowBuckets]);

  const shown = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((x) => {
      const hay = `${x.title ?? ""} ${x.file_name ?? ""} ${x.object_path ?? ""} ${(x.tags ?? []).join(" ")}`.toLowerCase();
      return hay.includes(keyword);
    });
  }, [items, q]);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (multi) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      } else {
        next.clear();
        next.add(id);
      }
      return next;
    });
  }

  const selected = useMemo(() => {
    if (selectedIds.size === 0) return [];
    const set = selectedIds;
    return items.filter((x) => set.has(x.id));
  }, [items, selectedIds]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <div className="text-sm font-semibold text-zinc-900">{title || "Media library"}</div>
          <div className="flex items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search..."
              className="w-56 rounded-md border border-zinc-200 px-3 py-1.5 text-sm outline-none focus:border-emerald-400"
            />
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Close
            </button>
            <button
              type="button"
              disabled={selected.length === 0}
              onClick={() => onConfirm(selected)}
              className={
                selected.length === 0
                  ? "rounded-md bg-emerald-600/50 px-3 py-1.5 text-sm font-semibold text-white"
                  : "rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
              }
            >
              Select
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-auto p-4">
          {error ? <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          {loading ? <div className="text-sm text-zinc-600">Loading...</div> : null}

          {!loading && shown.length === 0 ? <div className="text-sm text-zinc-600">No items</div> : null}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {shown
              .filter((x) => x.kind === "image")
              .map((x) => {
                const active = selectedIds.has(x.id);
                return (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => toggle(x.id)}
                    className={
                      active
                        ? "overflow-hidden rounded-xl border border-emerald-400 bg-white"
                        : "overflow-hidden rounded-xl border border-zinc-200 bg-white hover:border-zinc-300"
                    }
                  >
                    <div className="aspect-square bg-zinc-50">
                      <img src={x.public_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </div>
                    <div className="truncate px-2 py-1 text-left text-xs text-zinc-600">{x.file_name || x.title || x.object_path}</div>
                  </button>
                );
              })}
          </div>

          <div className="mt-6 space-y-2">
            {shown
              .filter((x) => x.kind !== "image")
              .map((x) => {
                const active = selectedIds.has(x.id);
                return (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => toggle(x.id)}
                    className={
                      active
                        ? "flex w-full items-center justify-between rounded-md border border-emerald-400 bg-white px-3 py-2 text-left"
                        : "flex w-full items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 text-left hover:border-zinc-300"
                    }
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-zinc-900">{x.file_name || x.title || x.object_path}</div>
                      <div className="truncate text-xs text-zinc-500">{x.bucket}</div>
                    </div>
                    <div className="text-xs font-semibold text-zinc-600">{x.kind}</div>
                  </button>
                );
              })}
          </div>
        </div>

        <div className="border-t border-zinc-200 px-4 py-3 text-xs text-zinc-500">
          {multi ? "Multi-select enabled" : "Single select"}
          {selected.length > 0 ? ` · Selected: ${selected.length}` : ""}
        </div>
      </div>
    </div>
  );
}

