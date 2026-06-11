import { FormEvent, useEffect, useMemo, useState } from "react";
import { Copy, FileText, Image as ImageIcon, Loader2, Trash2, Upload, Video as VideoIcon } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";

type MediaKind = "document" | "image" | "video";

type MediaAssetRow = {
  id: string;
  bucket: string;
  object_path: string;
  public_url: string;
  file_name: string | null;
  mime_type: string | null;
  kind: MediaKind;
  title: string | null;
  description: string | null;
  tags: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type StorageObject = {
  name: string;
  id: string;
  created_at: string;
  metadata: any;
};

function detectKind(file: File): MediaKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "document";
}

function bucketFor(kind: MediaKind, target: "site" | "product") {
  if (kind === "video") return "site-media";
  if (kind === "image") return target === "product" ? "product-media" : "site-media";
  return target === "product" ? "product-files" : "site-files";
}

function prefixForKind(kind: MediaKind) {
  if (kind === "image") return "images";
  if (kind === "video") return "videos";
  return "docs";
}

function normalizeTags(input: string) {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function kindLabel(kind: MediaKind | "all") {
  if (kind === "document") return "文档";
  if (kind === "image") return "图片";
  if (kind === "video") return "视频";
  return "全部";
}

function KindIcon({ kind }: { kind: MediaKind }) {
  if (kind === "image") return <ImageIcon className="h-5 w-5" />;
  if (kind === "video") return <VideoIcon className="h-5 w-5" />;
  return <FileText className="h-5 w-5" />;
}

function isMissingMediaAssetsTable(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("media_assets") && msg.toLowerCase().includes("schema cache");
}

function publicUrlFor(bucket: string, objectPath: string) {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const encodedPath = objectPath
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  return `${baseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedPath}`;
}

export default function MediaAdmin() {
  const [items, setItems] = useState<MediaAssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"db" | "storage">("db");
  const [uploadTarget, setUploadTarget] = useState<"site" | "product">("site");

  const [filterKind, setFilterKind] = useState<MediaKind | "all">("all");
  const [q, setQ] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = useMemo(() => items.find((x) => x.id === activeId) ?? null, [items, activeId]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!active) return;
    setTitle(active.title ?? "");
    setDescription(active.description ?? "");
    setTags((active.tags ?? []).join(", "));
    setIsActive(active.is_active);
  }, [active]);

  async function loadFromStorage(kind: MediaKind | "all") {
    setLoading(true);
    setError(null);
    try {
      const wanted: MediaKind[] = kind === "all" ? ["document", "image", "video"] : [kind];
      const results: MediaAssetRow[] = [];

      for (const k of wanted) {
        const bucket = bucketFor(k, "site");
        const prefix = prefixForKind(k);
        const { data } = await supabase.storage.list(bucket, prefix);
        for (const obj of (data || []) as StorageObject[]) {
          if (!obj?.name) continue;
          const objectPath = `${prefix}/${obj.name}`;
          results.push({
            id: `${bucket}:${objectPath}`,
            bucket,
            object_path: objectPath,
            public_url: publicUrlFor(bucket, objectPath),
            file_name: obj.name,
            mime_type: (obj.metadata as { mimetype?: string })?.mimetype ?? null,
            kind: k,
            title: obj.name,
            description: null,
            tags: [],
            is_active: true,
            created_at: obj.created_at,
            updated_at: obj.created_at,
          });
        }
      }

      results.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
      setItems(results);
      if (results.length && !results.some((x) => x.id === activeId)) setActiveId(results[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load storage files");
    } finally {
      setLoading(false);
    }
  }

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const base =
        "?select=id,bucket,object_path,public_url,file_name,mime_type,kind,title,description,tags,is_active,created_at,updated_at&order=created_at.desc";
      const query = filterKind === "all" ? base : `${base}&kind=eq.${encodeURIComponent(filterKind)}`;
      const { data } = await supabase.rest<MediaAssetRow[]>("media_assets", query);
      setMode("db");
      setItems(data);
      if (data.length && !data.some((x) => x.id === activeId)) setActiveId(data[0].id);
    } catch (err) {
      if (isMissingMediaAssetsTable(err)) {
        setMode("storage");
        setError("数据库表 media_assets 尚未创建（Supabase schema cache 未包含该表）。已切换为仅存储桶模式。请在 Supabase 执行 0010_media_assets.sql 后刷新。");
        await loadFromStorage(filterKind);
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load media assets");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [filterKind]);

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((x) => {
      const hay =
        `${x.title ?? ""} ${x.file_name ?? ""} ${x.object_path ?? ""} ${(x.tags ?? []).join(" ")}`
          .toLowerCase()
          .trim();
      return hay.includes(keyword);
    });
  }, [items, q]);

  async function handleUpload(file: File) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const kind = detectKind(file);
      const bucket = bucketFor(kind, uploadTarget);
      const path = `${prefixForKind(kind)}/${Date.now()}-${file.name}`;
      const uploaded = await supabase.storage.uploadPublic(bucket, path, file);

      if (mode === "storage") {
        await loadFromStorage(filterKind);
        return;
      }

      const payload: Partial<MediaAssetRow> &
        Pick<MediaAssetRow, "bucket" | "object_path" | "public_url" | "kind" | "is_active" | "tags"> = {
        bucket,
        object_path: uploaded.path,
        public_url: uploaded.publicUrl,
        file_name: file.name,
        mime_type: file.type || null,
        kind,
        title: file.name,
        description: null,
        tags: [],
        is_active: true,
      };

      let data: MediaAssetRow[] = [];
      try {
        const res = await supabase.rest<MediaAssetRow[]>("media_assets", "", {
          method: "POST",
          headers: { "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify([payload]),
        });
        data = res.data;
      } catch (e) {
        if (isMissingMediaAssetsTable(e)) {
          setMode("storage");
          setError("已上传到存储桶，但数据库表 media_assets 不存在，无法写入元数据。请在 Supabase 执行 0010_media_assets.sql 后刷新。");
          await loadFromStorage(filterKind);
          return;
        }
        throw e;
      }

      await reload();
      if (data[0]?.id) setActiveId(data[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveMeta(e: FormEvent) {
    e.preventDefault();
    if (!active) return;
    if (mode === "storage") return;
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await supabase.rest<MediaAssetRow[]>("media_assets", `?id=eq.${encodeURIComponent(active.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({
          title: title.trim() || null,
          description: description.trim() || null,
          tags: normalizeTags(tags),
          is_active: isActive,
        }),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function replaceFile(file: File) {
    if (!active) return;
    if (mode === "storage") {
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        const nextKind = detectKind(file);
        const nextBucket = active.bucket;
        const nextPath = `${prefixForKind(nextKind)}/${Date.now()}-${file.name}`;
        const uploaded = await supabase.storage.uploadPublic(nextBucket, nextPath, file);
        await supabase.storage.remove(active.bucket, [active.object_path]);
        setActiveId(`${nextBucket}:${uploaded.path}`);
        await loadFromStorage(filterKind);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Replace failed");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const nextKind = detectKind(file);
      const nextBucket = active.bucket;
      const nextPath = `${prefixForKind(nextKind)}/${Date.now()}-${file.name}`;
      const uploaded = await supabase.storage.uploadPublic(nextBucket, nextPath, file);

      await supabase.rest<MediaAssetRow[]>("media_assets", `?id=eq.${encodeURIComponent(active.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({
          bucket: nextBucket,
          object_path: uploaded.path,
          public_url: uploaded.publicUrl,
          file_name: file.name,
          mime_type: file.type || null,
          kind: nextKind,
        }),
      });

      await supabase.storage.remove(active.bucket, [active.object_path]);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Replace failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeActive() {
    if (!active) return;
    if (
      !confirm(
        mode === "db"
          ? "确定要删除这个媒体文件吗？这会同时删除存储桶文件与数据库记录。"
          : "确定要删除这个文件吗？这会从存储桶中删除该文件。"
      )
    )
      return;
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await supabase.storage.remove(active.bucket, [active.object_path]);
      if (mode === "db") {
        await supabase.rest<void>("media_assets", `?id=eq.${encodeURIComponent(active.id)}`, { method: "DELETE" });
      }
      setActiveId(null);
      if (mode === "db") {
        await reload();
      } else {
        await loadFromStorage(filterKind);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_520px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-lg font-semibold text-zinc-900">Media Library</div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={uploadTarget}
              onChange={(e) => setUploadTarget(e.target.value as "site" | "product")}
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 outline-none focus:ring-2 focus:ring-emerald-400/60"
            >
              <option value="site">Upload to site media</option>
              <option value="product">Upload to product media</option>
            </select>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              上传文件
              <input
                type="file"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0];
                  if (!f) return;
                  void handleUpload(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["all", "document", "image", "video"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilterKind(k)}
              className={
                filterKind === k
                  ? "rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800"
                  : "rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
              }
            >
              {kindLabel(k)}
            </button>
          ))}
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索：标题 / 文件名 / 标签"
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
        />

        {loading ? <div className="text-sm text-zinc-600">Loading...</div> : null}
        {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {mode === "storage" ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            当前为仅存储桶模式：可上传/删除/替换与复制 URL，但“标题/描述/标签”等编辑需要创建 media_assets 表。
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <div className="grid grid-cols-[1fr_120px] gap-3 border-b border-zinc-200 px-4 py-3 text-xs font-semibold text-zinc-500">
            <div>文件</div>
            <div>类型</div>
          </div>
          <div className="divide-y divide-zinc-200">
            {filtered.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setActiveId(x.id)}
                className={
                  x.id === activeId
                    ? "grid w-full grid-cols-[1fr_120px] gap-3 bg-emerald-50/60 px-4 py-3 text-left"
                    : "grid w-full grid-cols-[1fr_120px] gap-3 px-4 py-3 text-left hover:bg-zinc-50"
                }
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-zinc-900">{x.title || x.file_name || x.object_path}</div>
                  <div className="truncate text-xs text-zinc-500">{x.file_name || x.object_path}</div>
                </div>
                <div className="flex items-center gap-2 text-sm text-zinc-700">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
                    <KindIcon kind={x.kind} />
                  </span>
                  <span>{kindLabel(x.kind)}</span>
                </div>
              </button>
            ))}
            {filtered.length === 0 ? <div className="px-4 py-10 text-center text-sm text-zinc-500">暂无数据</div> : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="text-base font-semibold text-zinc-900">编辑</div>
        {!active ? (
          <div className="mt-3 text-sm text-zinc-600">从左侧选择一个文件进行编辑。</div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              {active.kind === "image" ? (
                <img src={active.public_url} className="max-h-56 w-full rounded-lg border border-zinc-200 object-contain" />
              ) : null}
              {active.kind === "video" ? (
                <video src={active.public_url} controls className="max-h-56 w-full rounded-lg border border-zinc-200" />
              ) : null}
              {active.kind === "document" ? (
                <a
                  href={active.public_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 underline underline-offset-4"
                >
                  打开文件
                </a>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="text-xs text-zinc-500">URL</div>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={active.public_url}
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none"
                />
                <button
                  type="button"
                  onClick={() => copy(active.public_url)}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                >
                  <Copy className="h-4 w-4" />
                  复制
                </button>
              </div>
            </div>

            <form onSubmit={saveMeta} className="space-y-4">
              <label className="block space-y-1">
                <div className="text-sm font-medium text-zinc-900">标题</div>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={mode === "storage"}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                />
              </label>

              <label className="block space-y-1">
                <div className="text-sm font-medium text-zinc-900">描述</div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  disabled={mode === "storage"}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                />
              </label>

              <label className="block space-y-1">
                <div className="text-sm font-medium text-zinc-900">标签（逗号分隔）</div>
                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  disabled={mode === "storage"}
                  placeholder="example: pdf, catalog, oled"
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/60"
                />
              </label>

              <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={isActive}
                  disabled={mode === "storage"}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                Active
              </label>

              <button
                type="submit"
                disabled={busy || mode === "storage"}
                className="inline-flex w-full items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? "Saving..." : "Save"}
              </button>
            </form>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50">
                替换文件
                <input
                  type="file"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.currentTarget.files?.[0];
                    if (!f) return;
                    void replaceFile(f);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() => void removeActive()}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                删除
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
