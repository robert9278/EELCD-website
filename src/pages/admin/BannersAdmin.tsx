import { FormEvent, useEffect, useMemo, useState } from "react";

import { bootstrapFirstAdmin, supabase } from "@/lib/supabaseClient";

type BannerRow = {
  id: string;
  title_i18n: Record<string, string>;
  image_url: string;
  link_url: string | null;
  is_active: boolean;
  sort_order: number;
  placement: "home" | "page";
  page_key: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

function getI18nText(obj: Record<string, string> | null | undefined, key: string) {
  return (obj?.[key] ?? "").toString();
}

export default function BannersAdmin() {
  const [items, setItems] = useState<BannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schemaMode, setSchemaMode] = useState<"extended" | "legacy">("extended");
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = useMemo(() => items.find((b) => b.id === activeId) ?? null, [items, activeId]);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [adminStatus, setAdminStatus] = useState<"unknown" | "admin" | "not_admin" | "not_signed_in" | "error">("unknown");
  const [storageListStatus, setStorageListStatus] = useState<"unknown" | "ok" | "denied" | "missing_bucket" | "error">(
    "unknown"
  );
  const [diag, setDiag] = useState<string | null>(null);
  const [showStorageWriteFix, setShowStorageWriteFix] = useState(false);
  const [storageWriteFixDetails, setStorageWriteFixDetails] = useState<string | null>(null);

  const storageWriteFixSql =
    "do $$\n" +
    "declare r record;\n" +
    "begin\n" +
    "  for r in\n" +
    "    select p.polname\n" +
    "    from pg_policy p\n" +
    "    join pg_class c on c.oid = p.polrelid\n" +
    "    join pg_namespace n on n.oid = c.relnamespace\n" +
    "    where n.nspname = 'storage'\n" +
    "      and c.relname = 'objects'\n" +
    "      and p.polcmd in ('a','w','d')\n" +
    "      and (\n" +
    "        coalesce(pg_get_expr(p.polqual, p.polrelid), '') ilike '%site-media%'\n" +
    "        or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ilike '%site-media%'\n" +
    "        or coalesce(pg_get_expr(p.polqual, p.polrelid), '') ilike '%site-files%'\n" +
    "        or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ilike '%site-files%'\n" +
    "      )\n" +
    "  loop\n" +
    "    execute format('drop policy if exists %I on storage.objects', r.polname);\n" +
    "  end loop;\n" +
    "end $$;\n" +
    "\n" +
    "drop policy if exists storage_site_media_admin_insert on storage.objects;\n" +
    "create policy storage_site_media_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'site-media' and public.is_admin());\n" +
    "drop policy if exists storage_site_media_admin_update on storage.objects;\n" +
    "create policy storage_site_media_admin_update on storage.objects for update to authenticated using (bucket_id = 'site-media' and public.is_admin()) with check (bucket_id = 'site-media' and public.is_admin());\n" +
    "drop policy if exists storage_site_media_admin_delete on storage.objects;\n" +
    "create policy storage_site_media_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'site-media' and public.is_admin());\n" +
    "\n" +
    "drop policy if exists storage_site_files_admin_insert on storage.objects;\n" +
    "create policy storage_site_files_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'site-files' and public.is_admin());\n" +
    "drop policy if exists storage_site_files_admin_update on storage.objects;\n" +
    "create policy storage_site_files_admin_update on storage.objects for update to authenticated using (bucket_id = 'site-files' and public.is_admin()) with check (bucket_id = 'site-files' and public.is_admin());\n" +
    "drop policy if exists storage_site_files_admin_delete on storage.objects;\n" +
    "create policy storage_site_files_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'site-files' and public.is_admin());\n";

  const pageOptions: { key: BannerRow["page_key"]; label: string }[] = [
    { key: "about", label: "About Us" },
    { key: "products", label: "Product" },
    { key: "news", label: "News" },
    { key: "case-studies", label: "Industry Case Studies" },
    { key: "services", label: "Services & Support" },
    { key: "contact", label: "Contact Us" },
    { key: "shop", label: "Shop" },
  ];

  const [titleEn, setTitleEn] = useState("");
  const [titleZh, setTitleZh] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);
  const [placement, setPlacement] = useState<BannerRow["placement"]>("home");
  const [pageKey, setPageKey] = useState<Exclude<BannerRow["page_key"], null>>("about");
  const [isPrimary, setIsPrimary] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!active) return;
    setTitleEn(getI18nText(active.title_i18n, "en"));
    setTitleZh(getI18nText(active.title_i18n, "zh"));
    setLinkUrl(active.link_url ?? "");
    setImageUrl(active.image_url);
    setIsActive(active.is_active);
    setSortOrder(active.sort_order);
    setPlacement(active.placement || "home");
    setPageKey((active.page_key as Exclude<BannerRow["page_key"], null>) || "about");
    setIsPrimary(Boolean(active.is_primary));
  }, [active]);

  function resetForm() {
    setActiveId(null);
    setTitleEn("");
    setTitleZh("");
    setLinkUrl("");
    setImageUrl("");
    setIsActive(true);
    setSortOrder(0);
    setPlacement("home");
    setPageKey("about");
    setIsPrimary(false);
  }

  async function refreshAuthAndPermissions() {
    setDiag(null);
    try {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id ?? null;
      setAuthUserId(uid);
      if (!uid) {
        setAdminStatus("not_signed_in");
        setStorageListStatus("unknown");
        return;
      }

      try {
        const { data: adminRows } = await supabase.rest<{ user_id: string }[]>("admins", "?select=user_id");
        setAdminStatus(adminRows?.length ? "admin" : "not_admin");
      } catch (e) {
        setAdminStatus("error");
        setDiag(`Admin check failed: ${e instanceof Error ? e.message : "unknown error"}`);
      }

      try {
        await supabase.storage.list("site-media", "banners");
        setStorageListStatus("ok");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown error";
        const isRls = /row-level security|row level security|rls/i.test(msg);
        const isMissingBucket = /bucket not found/i.test(msg);
        setStorageListStatus(isMissingBucket ? "missing_bucket" : isRls ? "denied" : "error");
        setDiag((prev) => (prev ? `${prev}\nStorage list failed: ${msg}` : `Storage list failed: ${msg}`));
      }
    } catch (e) {
      setAdminStatus("error");
      setDiag(e instanceof Error ? e.message : "Failed to check auth");
    }
  }

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      try {
        const { data } = await supabase.rest<BannerRow[]>(
          "site_banners",
          "?select=id,title_i18n,image_url,link_url,is_active,sort_order,placement,page_key,is_primary,created_at,updated_at&order=placement.asc,sort_order.asc,created_at.desc"
        );
        setItems(data);
        setSchemaMode("extended");
      } catch (e) {
        const { data } = await supabase.rest<
          Omit<BannerRow, "placement" | "page_key" | "is_primary">[]
        >("site_banners", "?select=id,title_i18n,image_url,link_url,is_active,sort_order,created_at,updated_at&order=sort_order.asc,created_at.desc");
        setItems(
          (data ?? []).map((b) => ({
            ...b,
            placement: "home",
            page_key: null,
            is_primary: false,
          }))
        );
        setSchemaMode("legacy");
        setError(
          "Banner schema is not upgraded yet (missing columns like placement/page_key/is_primary). Run migration 0022 on Supabase, then refresh the page."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load banners");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    void refreshAuthAndPermissions();
  }, []);

  async function uploadBannerImage(file: File) {
    setError(null);
    setBusy(true);
    try {
      const path = `banners/${Date.now()}-${file.name}`;
      const { publicUrl } = await supabase.storage.uploadPublic("site-media", path, file);
      setImageUrl(publicUrl);
      setShowStorageWriteFix(false);
      setStorageWriteFixDetails(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      const bucketHint = /bucket not found/i.test(msg)
        ? "\n\nStorage 提示：site-media 桶不存在（Bucket not found）。请到 Supabase Dashboard → Storage → Buckets 创建 bucket：site-media（Public），再重试上传。"
        : "";
      const isStorageWriteRls =
        /row-level security|row level security|violates row-level security|rls/i.test(msg) && /\/storage\/v1\/object\//i.test(msg);
      const storageRlsHint =
        isStorageWriteRls
          ? "\n\nStorage RLS 提示：这是 Storage 写入被 RLS 拦截（storage.objects 没有允许 INSERT 的策略）。需要在 Supabase SQL Editor 给 storage.objects 增加允许管理员写入 site-media 的 policy（我下面给你 SQL）。"
          : "";
      const hint =
        /row-level security|row level security|violates row-level security|rls/i.test(msg) && authUserId
          ? `\n\nRLS 提示：当前 user.id=${authUserId}\nAdmin 状态=${adminStatus}\nStorage(list site-media/banners)=${storageListStatus}\n可在上方 Permissions 里点 Refresh / Bootstrap。`
          : "";
      setError(`${msg}${bucketHint}${storageRlsHint}${hint}`);
      if (isStorageWriteRls) {
        setShowStorageWriteFix(true);
        setStorageWriteFixDetails(
          `当前报错来自 Storage 写入：${msg}\n\n请在 Supabase SQL Editor 执行下方 SQL（会重置 site-media/site-files 的写入策略为“仅管理员可写”）。`
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function bootstrapMeAsFirstAdmin() {
    setError(null);
    if (busy) return;
    setBusy(true);
    try {
      if (!authUserId) throw new Error("Not signed in");
      await bootstrapFirstAdmin(authUserId);
      await refreshAuthAndPermissions();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bootstrap failed");
    } finally {
      setBusy(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (busy) return;
    setBusy(true);
    try {
      if (!imageUrl.trim()) throw new Error("Banner image is required");

      if (schemaMode === "extended") {
        if (placement === "home" && isPrimary) {
          await supabase.rest<void>("site_banners", `?placement=eq.home&is_primary=eq.true`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_primary: false }),
          });
        }

        if (placement === "page" && isActive) {
          const base = `?placement=eq.page&page_key=eq.${encodeURIComponent(pageKey)}&is_active=eq.true`;
          const filter = activeId ? `${base}&id=neq.${encodeURIComponent(activeId)}` : base;
          await supabase.rest<void>("site_banners", filter, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_active: false }),
          });
        }
      }

      const payload: Record<string, unknown> =
        schemaMode === "extended"
          ? {
              title_i18n: { en: titleEn.trim(), zh: titleZh.trim() },
              image_url: imageUrl.trim(),
              link_url: linkUrl.trim() ? linkUrl.trim() : null,
              is_active: isActive,
              sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
              placement,
              page_key: placement === "page" ? pageKey : null,
              is_primary: placement === "home" ? isPrimary : false,
            }
          : {
              title_i18n: { en: titleEn.trim(), zh: titleZh.trim() },
              image_url: imageUrl.trim(),
              link_url: linkUrl.trim() ? linkUrl.trim() : null,
              is_active: isActive,
              sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
            };

      if (activeId) {
        await supabase.rest<BannerRow[]>("site_banners", `?id=eq.${encodeURIComponent(activeId)}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(payload),
        });
      } else {
        const { data } = await supabase.rest<BannerRow[]>("site_banners", "", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify([payload]),
        });
        if (data[0]?.id) setActiveId(data[0].id);
      }

      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      const hint =
        /row-level security|row level security|violates row-level security|rls/i.test(msg) && authUserId
          ? `\n\nRLS 提示：当前 user.id=${authUserId}\nAdmin 状态=${adminStatus}\n可在上方 Permissions 里点 Refresh / Bootstrap。`
          : "";
      setError(`${msg}${hint}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    if (busy) return;
    setBusy(true);
    try {
      await supabase.rest<void>("site_banners", `?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
      if (activeId === id) resetForm();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function setHomeBanner(id: string) {
    setError(null);
    if (busy) return;
    setBusy(true);
    try {
      if (schemaMode === "extended") {
        await supabase.rest<void>("site_banners", `?placement=eq.home&is_primary=eq.true`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_primary: false }),
        });
        await supabase.rest<void>("site_banners", `?id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_primary: true, placement: "home", page_key: null }),
        });
      } else {
        const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
        const min = Number.isFinite(sorted[0]?.sort_order) ? (sorted[0]?.sort_order as number) : 0;
        await supabase.rest<void>("site_banners", `?id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: min - 1 }),
        });
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set home banner");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_420px]">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold text-zinc-900">Banners</div>
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            New banner
          </button>
        </div>

        {loading ? <div className="text-sm text-zinc-600">Loading...</div> : null}
        {error ? <div className="whitespace-pre-wrap rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-zinc-900">Permissions</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void refreshAuthAndPermissions()}
                className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Refresh
              </button>
              {adminStatus === "not_admin" ? (
                <button
                  type="button"
                  disabled={busy || !authUserId}
                  onClick={() => void bootstrapMeAsFirstAdmin()}
                  className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Bootstrap
                </button>
              ) : null}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-1 text-sm text-zinc-700 sm:grid-cols-2">
            <div className="text-xs font-semibold text-zinc-500">Supabase</div>
            <div className="truncate">
              {typeof import.meta.env.VITE_SUPABASE_URL === "string" && import.meta.env.VITE_SUPABASE_URL
                ? String(import.meta.env.VITE_SUPABASE_URL)
                : "(not set)"}
            </div>
            <div className="text-xs font-semibold text-zinc-500">user.id</div>
            <div className="truncate">{authUserId ?? "(not signed in)"}</div>
            <div className="text-xs font-semibold text-zinc-500">Admin</div>
            <div>
              {adminStatus === "admin"
                ? "Yes"
                : adminStatus === "not_admin"
                  ? "No"
                  : adminStatus === "not_signed_in"
                    ? "Not signed in"
                    : adminStatus === "error"
                      ? "Error"
                      : "Checking..."}
            </div>
            <div className="text-xs font-semibold text-zinc-500">Storage list</div>
            <div>
              {storageListStatus === "ok"
                ? "OK"
                : storageListStatus === "denied"
                  ? "Denied"
                  : storageListStatus === "missing_bucket"
                    ? "Bucket missing"
                  : storageListStatus === "error"
                    ? "Error"
                    : "Checking..."}
            </div>
          </div>
          {adminStatus === "not_admin" ? (
            <div className="mt-2 text-sm text-amber-700">
              你当前不是管理员：只能看到 Active 的 banner，且上传/保存会被 RLS 拒绝。点 Bootstrap（仅适用于“还没有任何管理员”的项目）。
            </div>
          ) : null}
          {showStorageWriteFix ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              {storageWriteFixDetails ? <div className="whitespace-pre-wrap text-sm text-amber-900">{storageWriteFixDetails}</div> : null}
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-amber-900">SQL（复制后到 Supabase SQL Editor 执行）</div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void navigator.clipboard.writeText(storageWriteFixSql)}
                  className="inline-flex items-center rounded-md border border-amber-200 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                >
                  Copy SQL
                </button>
              </div>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-white p-2 text-xs text-zinc-800">
                {storageWriteFixSql}
              </pre>
            </div>
          ) : null}
          {diag ? <div className="mt-2 whitespace-pre-wrap text-xs text-zinc-600">{diag}</div> : null}
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <div className="grid grid-cols-[90px_140px_1fr_120px_180px] gap-3 border-b border-zinc-200 px-4 py-3 text-xs font-semibold text-zinc-500">
            <div>Preview</div>
            <div>Scope</div>
            <div>Title</div>
            <div>Status</div>
            <div>Action</div>
          </div>
          <div className="divide-y divide-zinc-200">
            {items.map((b) => (
              <div key={b.id} className="grid grid-cols-[90px_140px_1fr_120px_180px] gap-3 px-4 py-3">
                <div>
                  {b.image_url ? (
                    <img src={b.image_url} alt="" className="h-10 w-[72px] rounded-md border border-zinc-200 object-cover" />
                  ) : (
                    <div className="h-10 w-[72px] rounded-md border border-dashed border-zinc-300 bg-zinc-50" />
                  )}
                </div>
                <div className="text-sm text-zinc-700">
                  {b.placement === "home"
                    ? b.is_primary
                      ? "Home (Primary)"
                      : "Home"
                    : `Page: ${b.page_key || ""}`}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveId(b.id)}
                  className="truncate text-left text-sm font-medium text-zinc-900 hover:underline"
                >
                  {getI18nText(b.title_i18n, "en") || getI18nText(b.title_i18n, "zh") || b.image_url}
                </button>
                <div className="text-sm text-zinc-700">{b.is_active ? "Active" : "Hidden"}</div>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void setHomeBanner(b.id)}
                    className="text-left text-sm font-medium text-emerald-700 hover:underline disabled:opacity-50"
                  >
                    Use for Home
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(b.id)}
                    className="text-left text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="text-base font-semibold text-zinc-900">{activeId ? "Edit banner" : "Create banner"}</div>
          <form onSubmit={save} className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <div className="text-sm font-medium text-zinc-900">Scope</div>
                <select
                  value={placement}
                  onChange={(e) => setPlacement(e.target.value as BannerRow["placement"])}
                  disabled={schemaMode !== "extended"}
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                >
                  <option value="home">Home</option>
                  <option value="page">Page</option>
                </select>
              </label>
              <label className="block space-y-1">
                <div className="text-sm font-medium text-zinc-900">Page</div>
                <select
                  value={pageKey}
                  onChange={(e) => setPageKey(e.target.value as Exclude<BannerRow["page_key"], null>)}
                  disabled={schemaMode !== "extended" || placement !== "page"}
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60 disabled:bg-zinc-50"
                >
                  {pageOptions.map((p) => (
                    <option key={p.key ?? ""} value={p.key ?? ""}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Title (EN)</div>
              <input
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Title (ZH)</div>
              <input
                value={titleZh}
                onChange={(e) => setTitleZh(e.target.value)}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </label>

            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Link URL (optional)</div>
              <input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                placeholder="/products or https://..."
              />
            </label>

            <div className="space-y-2">
              <div className="text-sm font-medium text-zinc-900">Banner image</div>
              {imageUrl ? (
                <img src={imageUrl} alt="Banner" className="h-32 w-full rounded-lg border border-zinc-200 object-cover" />
              ) : (
                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-500">
                  No image
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadBannerImage(f);
                  e.currentTarget.value = "";
                }}
                className="block w-full text-sm"
              />
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                placeholder="Or paste an image URL"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <div className="text-sm font-medium text-zinc-900">Sort</div>
                <input
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value))}
                  type="number"
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                />
              </label>
              <div className="flex items-end">
                <div className="flex flex-col gap-2">
                  <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
                    <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                    Active
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      checked={isPrimary}
                      disabled={schemaMode !== "extended" || placement !== "home"}
                      onChange={(e) => setIsPrimary(e.target.checked)}
                    />
                    Primary (Home hero)
                  </label>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Saving..." : "Save"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
