import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import MediaPicker, { MediaAsset } from "@/components/admin/MediaPicker";
import { supabase } from "@/lib/supabaseClient";

type ProductRow = {
  id: string;
  slug: string;
  category: string;
  in_stock: boolean;
  shop_is_live: boolean;
  shop_price_cents: number | null;
  shop_currency: string;
  shop_stock_qty: number | null;
  name_i18n: Record<string, string>;
  short_description_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  spec_size: string | null;
  spec_resolution: string | null;
  spec_lcd_type: string | null;
  spec_luminance: string | null;
  spec_operating_temp: string | null;
  spec_table: any;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type ProductMediaRow = {
  id: string;
  product_id: string;
  kind: string;
  url: string;
  alt_i18n: Record<string, string>;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
};

type ProductAttachmentRow = {
  id: string;
  product_id: string;
  kind: string;
  url: string;
  label_i18n: Record<string, string>;
  file_name: string | null;
  created_at: string;
};

type ProductWithRelations = ProductRow & {
  product_media?: ProductMediaRow[];
  product_attachments?: ProductAttachmentRow[];
};

type SpecTableRow = {
  client_id: string;
  item: string;
  contents: string;
  unit: string;
};

type BulkProductRow = {
  client_id: string;
  slug: string;
  category: string;
  name_en: string;
  name_zh: string;
  short_en: string;
  short_zh: string;
  spec_size: string;
  spec_resolution: string;
  spec_lcd_type: string;
  spec_luminance: string;
  spec_operating_temp: string;
  image_name: string;
  in_stock: boolean;
  is_active: boolean;
  shop_is_live: boolean;
  shop_price_usd: number;
  shop_stock_qty: number | "";
  image_file: File | null;
};

const categories = ["TFT", "OLED", "PCAP", "EPD", "Mechanical"];

function safeSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getI18nText(obj: Record<string, string> | null | undefined, key: string) {
  return (obj?.[key] ?? "").toString();
}

function normalizeCategory(input: string) {
  const raw = (input ?? "").trim();
  if (!raw) return categories[0] ?? "TFT";
  const upper = raw.toUpperCase();
  if (upper === "FTP") return "TFT";
  const known = categories.find((c) => c.toUpperCase() === upper);
  return known ?? raw;
}

function newClientId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function csvSplitLine(line: string) {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] ?? "";
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === ",") {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function toBool(input: string, fallback: boolean) {
  const v = input.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes" || v === "y") return true;
  if (v === "0" || v === "false" || v === "no" || v === "n") return false;
  return fallback;
}

function normalizeImageKey(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/^.*[\\/]/g, "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "");
}

function findImageMatch(params: { imageName: string; slug: string; files: File[] }) {
  const byName = normalizeImageKey(params.imageName);
  const bySlug = normalizeImageKey(params.slug);
  const metas = params.files.map((f) => ({ file: f, full: normalizeImageKey(f.name), base: normalizeImageKey(f.name) }));

  if (byName) {
    const direct = metas.find((m) => m.full === byName || m.base === byName);
    if (direct) return direct.file;
  }

  if (bySlug) {
    const exact = metas.find((m) => m.base === bySlug);
    if (exact) return exact.file;
    const starts = metas.find((m) => m.base.startsWith(bySlug));
    if (starts) return starts.file;
    const contains = metas.find((m) => m.base.includes(bySlug));
    if (contains) return contains.file;
  }

  return null;
}

export default function ProductsAdmin() {
  const [items, setItems] = useState<ProductWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [adminStatus, setAdminStatus] = useState<"unknown" | "admin" | "not_admin" | "not_signed_in" | "error">("unknown");
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
    "        coalesce(pg_get_expr(p.polqual, p.polrelid), '') ilike '%product-media%'\n" +
    "        or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ilike '%product-media%'\n" +
    "        or coalesce(pg_get_expr(p.polqual, p.polrelid), '') ilike '%product-files%'\n" +
    "        or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ilike '%product-files%'\n" +
    "        or coalesce(pg_get_expr(p.polqual, p.polrelid), '') ilike '%site-media%'\n" +
    "        or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ilike '%site-media%'\n" +
    "        or coalesce(pg_get_expr(p.polqual, p.polrelid), '') ilike '%site-files%'\n" +
    "        or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ilike '%site-files%'\n" +
    "      )\n" +
    "  loop\n" +
    "    execute format('drop policy if exists %I on storage.objects', r.polname);\n" +
    "  end loop;\n" +
    "end $$;\n" +
    "\n" +
    "drop policy if exists storage_product_media_admin_insert on storage.objects;\n" +
    "create policy storage_product_media_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'product-media' and public.is_admin());\n" +
    "drop policy if exists storage_product_media_admin_update on storage.objects;\n" +
    "create policy storage_product_media_admin_update on storage.objects for update to authenticated using (bucket_id = 'product-media' and public.is_admin()) with check (bucket_id = 'product-media' and public.is_admin());\n" +
    "drop policy if exists storage_product_media_admin_delete on storage.objects;\n" +
    "create policy storage_product_media_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'product-media' and public.is_admin());\n" +
    "\n" +
    "drop policy if exists storage_product_files_admin_insert on storage.objects;\n" +
    "create policy storage_product_files_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'product-files' and public.is_admin());\n" +
    "drop policy if exists storage_product_files_admin_update on storage.objects;\n" +
    "create policy storage_product_files_admin_update on storage.objects for update to authenticated using (bucket_id = 'product-files' and public.is_admin()) with check (bucket_id = 'product-files' and public.is_admin());\n" +
    "drop policy if exists storage_product_files_admin_delete on storage.objects;\n" +
    "create policy storage_product_files_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'product-files' and public.is_admin());\n" +
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const [mainPickerOpen, setMainPickerOpen] = useState(false);
  const [galleryPickerOpen, setGalleryPickerOpen] = useState(false);
  const [pdfPickerOpen, setPdfPickerOpen] = useState(false);
  const [specTableAvailable, setSpecTableAvailable] = useState<"unknown" | "available" | "missing">("unknown");

  const active = useMemo(() => items.find((p) => p.id === activeId) ?? null, [items, activeId]);
  const selectedCount = selectedIds.size;
  const allSelected = items.length > 0 && selectedCount === items.length;
  const someSelected = selectedCount > 0 && selectedCount < items.length;

  const images = useMemo(() => {
    const list = (active?.product_media ?? []).filter((m) => m.kind === "image" && (m.url ?? "").trim().length > 0);
    list.sort((a, b) => (a.is_primary === b.is_primary ? a.sort_order - b.sort_order : a.is_primary ? -1 : 1));
    return list;
  }, [active]);

  const primaryImage = images.find((x) => x.is_primary) ?? images[0] ?? null;
  const galleryImages = images.filter((x) => x.id !== primaryImage?.id);

  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "TFT");
  const [inStock, setInStock] = useState(true);
  const [shopLive, setShopLive] = useState(false);
  const [shopPrice, setShopPrice] = useState<number>(0);
  const [shopCurrency, setShopCurrency] = useState("USD");
  const [shopStockQty, setShopStockQty] = useState<number | "">("");
  const [nameEn, setNameEn] = useState("");
  const [nameZh, setNameZh] = useState("");
  const [shortEn, setShortEn] = useState("");
  const [shortZh, setShortZh] = useState("");
  const [detailEn, setDetailEn] = useState("");
  const [detailZh, setDetailZh] = useState("");
  const [specSize, setSpecSize] = useState("");
  const [specResolution, setSpecResolution] = useState("");
  const [specLcdType, setSpecLcdType] = useState("");
  const [specLuminance, setSpecLuminance] = useState("");
  const [specOperatingTemp, setSpecOperatingTemp] = useState("");
  const [specTableRows, setSpecTableRows] = useState<SpecTableRow[]>([]);
  const [activeFlag, setActiveFlag] = useState(true);
  const [featured, setFeatured] = useState(false);
  const [sortOrder, setSortOrder] = useState(0);
  const [busy, setBusy] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkProductRow[]>(() => [
    {
      client_id: newClientId(),
      slug: "",
      category: categories[0] ?? "TFT",
      name_en: "",
      name_zh: "",
      short_en: "",
      short_zh: "",
      spec_size: "",
      spec_resolution: "",
      spec_lcd_type: "",
      spec_luminance: "",
      spec_operating_temp: "",
      image_name: "",
      in_stock: true,
      is_active: true,
      shop_is_live: false,
      shop_price_usd: 0,
      shop_stock_qty: "",
      image_file: null,
    },
  ]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [bulkCsv, setBulkCsv] = useState("");
  const [bulkCsvFileName, setBulkCsvFileName] = useState<string | null>(null);
  const [bulkImageFiles, setBulkImageFiles] = useState<File[]>([]);

  async function refreshAuth() {
    try {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id ?? null;
      setAuthUserId(uid);
      if (!uid) {
        setAdminStatus("not_signed_in");
        return;
      }
      try {
        const { data: rows } = await supabase.rest<{ user_id: string }[]>("admins", "?select=user_id");
        setAdminStatus(rows?.length ? "admin" : "not_admin");
      } catch {
        setAdminStatus("error");
      }
    } catch {
      setAdminStatus("error");
    }
  }

  useEffect(() => {
    if (!active) return;
    setSlug(active.slug);
    setCategory(normalizeCategory(active.category));
    setInStock(active.in_stock);
    setShopLive(active.shop_is_live);
    setShopPrice(active.shop_price_cents ? Math.round(active.shop_price_cents / 100) : 0);
    setShopCurrency(active.shop_currency || "USD");
    setShopStockQty(typeof active.shop_stock_qty === "number" ? active.shop_stock_qty : "");
    setNameEn(getI18nText(active.name_i18n, "en"));
    setNameZh(getI18nText(active.name_i18n, "zh"));
    setShortEn(getI18nText(active.short_description_i18n, "en"));
    setShortZh(getI18nText(active.short_description_i18n, "zh"));
    setDetailEn(getI18nText(active.description_i18n, "en"));
    setDetailZh(getI18nText(active.description_i18n, "zh"));
    setSpecSize(active.spec_size ?? "");
    setSpecResolution(active.spec_resolution ?? "");
    setSpecLcdType(active.spec_lcd_type ?? "");
    setSpecLuminance(active.spec_luminance ?? "");
    setSpecOperatingTemp(active.spec_operating_temp ?? "");
    const table = Array.isArray(active.spec_table) ? (active.spec_table as any[]) : [];
    const nextRows: SpecTableRow[] = table
      .map((r) => ({
        client_id: newClientId(),
        item: (r?.item ?? "").toString(),
        contents: (r?.contents ?? "").toString(),
        unit: (r?.unit ?? "").toString(),
      }))
      .filter((r) => r.item.trim() || r.contents.trim() || r.unit.trim());
    setSpecTableRows(nextRows);
    setActiveFlag(active.is_active);
    setFeatured(active.is_featured);
    setSortOrder(active.sort_order);
  }, [active]);

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    el.indeterminate = someSelected;
  }, [someSelected]);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.rest<ProductWithRelations[]>(
        "products",
        "?select=*,product_media(*),product_attachments(*)&order=sort_order.asc,created_at.desc"
      );
      setItems(data);
      setSelectedIds((prev) => {
        if (prev.size === 0) return prev;
        const exists = new Set(data.map((p) => p.id));
        const next = new Set<string>();
        for (const id of prev) if (exists.has(id)) next.add(id);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    void refreshAuth();
    void (async () => {
      try {
        await supabase.rest("products", "?select=spec_table&limit=1");
        setSpecTableAvailable("available");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.toLowerCase().includes("spec_table") && msg.toLowerCase().includes("schema cache")) {
          setSpecTableAvailable("missing");
        } else if (msg.toLowerCase().includes("spec_table") && msg.toLowerCase().includes("column")) {
          setSpecTableAvailable("missing");
        } else {
          setSpecTableAvailable("unknown");
        }
      }
    })();
  }, []);

  function resetForm() {
    setActiveId(null);
    setSlug("");
    setCategory(categories[0] ?? "TFT");
    setInStock(true);
    setShopLive(false);
    setShopPrice(0);
    setShopCurrency("USD");
    setShopStockQty("");
    setNameEn("");
    setNameZh("");
    setShortEn("");
    setShortZh("");
    setDetailEn("");
    setDetailZh("");
    setSpecSize("");
    setSpecResolution("");
    setSpecLcdType("");
    setSpecLuminance("");
    setSpecOperatingTemp("");
    setSpecTableRows([]);
    setActiveFlag(true);
    setFeatured(false);
    setSortOrder(0);
  }

  function addSpecTableRow() {
    setSpecTableRows((prev) => [...prev, { client_id: newClientId(), item: "", contents: "", unit: "" }]);
  }

  function updateSpecTableRow(id: string, patch: Partial<Omit<SpecTableRow, "client_id">>) {
    setSpecTableRows((prev) => prev.map((r) => (r.client_id === id ? { ...r, ...patch } : r)));
  }

  function removeSpecTableRow(id: string) {
    setSpecTableRows((prev) => prev.filter((r) => r.client_id !== id));
  }

  function normalizeSpecTablePayload() {
    return specTableRows
      .map((r) => ({
        item: r.item.trim(),
        contents: r.contents.trim(),
        unit: r.unit.trim(),
      }))
      .filter((r) => r.item.length > 0 && r.contents.length > 0);
  }

  async function upsertProduct(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setShowStorageWriteFix(false);
    setStorageWriteFixDetails(null);
    if (busy) return;
    setBusy(true);

    try {
      const s = safeSlug(slug);
      if (!s) throw new Error("Slug is required");
      if (!nameEn.trim() && !nameZh.trim()) throw new Error("At least one name is required");

      const payload: Partial<ProductRow> & Pick<ProductRow, "slug" | "category" | "name_i18n" | "short_description_i18n"> = {
        slug: s,
        category: normalizeCategory(category),
        in_stock: inStock,
        shop_is_live: shopLive,
        shop_currency: shopCurrency.trim() || "USD",
        shop_price_cents: shopPrice > 0 ? Math.round(shopPrice * 100) : null,
        shop_stock_qty: shopStockQty === "" ? null : Number(shopStockQty),
        name_i18n: { en: nameEn.trim(), zh: nameZh.trim() },
        short_description_i18n: { en: shortEn.trim(), zh: shortZh.trim() },
        description_i18n: { en: detailEn.trim(), zh: detailZh.trim() },
        spec_size: specSize.trim() || null,
        spec_resolution: specResolution.trim() || null,
        spec_lcd_type: specLcdType.trim() || null,
        spec_luminance: specLuminance.trim() || null,
        spec_operating_temp: specOperatingTemp.trim() || null,
        is_active: activeFlag,
        is_featured: featured,
        sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
      };
      if (specTableAvailable === "available") {
        (payload as any).spec_table = normalizeSpecTablePayload();
      }

      if (activeId) {
        const { data } = await supabase.rest<ProductRow[]>("products", `?id=eq.${encodeURIComponent(activeId)}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(payload),
        });
        if (!data || data.length === 0) {
          const who = authUserId ? `user.id=${authUserId}` : "not signed in";
          throw new Error(
            `Update was not applied (no rows returned). This usually means permission/RLS blocked the update.\n${who}\nAdmin=${adminStatus}`
          );
        }
      } else {
        const { data } = await supabase.rest<ProductRow[]>("products", "", {
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
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeProduct(id: string) {
    setError(null);
    setShowStorageWriteFix(false);
    setStorageWriteFixDetails(null);
    if (busy) return;
    setBusy(true);
    try {
      await supabase.rest<void>("products", `?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (activeId === id) resetForm();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(file: File) {
    await uploadGalleryImages([file]);
  }

  async function uploadPdf(file: File) {
    if (!activeId) {
      setError("Please save product first");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const path = `products/${activeId}/${Date.now()}-${file.name}`;
      const { publicUrl } = await supabase.storage.uploadPublic("product-files", path, file);

      try {
        await supabase.rest("media_assets", "", {
          method: "POST",
          headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify([
            {
              bucket: "product-files",
              object_path: path,
              public_url: publicUrl,
              file_name: file.name,
              mime_type: file.type || null,
              kind: "document",
              title: file.name,
              description: null,
              tags: [],
              is_active: true,
            },
          ]),
        });
      } catch {
      }

      await supabase.rest<ProductAttachmentRow[]>("product_attachments", "", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify([
          {
            product_id: activeId,
            kind: "pdf",
            url: publicUrl,
            label_i18n: { en: file.name, zh: file.name },
            file_name: file.name,
          },
        ]),
      });

      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadMainImage(file: File) {
    if (!activeId) {
      setError("Please save product first");
      return;
    }
    setError(null);
    setShowStorageWriteFix(false);
    setStorageWriteFixDetails(null);
    setBusy(true);
    try {
      const path = `products/${activeId}/${Date.now()}-${file.name}`;
      const uploaded = await supabase.storage.uploadPublic("product-media", path, file);

      try {
        await supabase.rest("media_assets", "", {
          method: "POST",
          headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify([
            {
              bucket: "product-media",
              object_path: uploaded.path,
              public_url: uploaded.publicUrl,
              file_name: file.name,
              mime_type: file.type || null,
              kind: "image",
              title: file.name,
              description: null,
              tags: [],
              is_active: true,
            },
          ]),
        });
      } catch {
      }

      await supabase.rest<void>("product_media", `?product_id=eq.${encodeURIComponent(activeId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ is_primary: false }),
      });

      await supabase.rest<ProductMediaRow[]>("product_media", "", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify([
          {
            product_id: activeId,
            kind: "image",
            url: uploaded.publicUrl,
            alt_i18n: { en: nameEn.trim(), zh: nameZh.trim() },
            sort_order: 0,
            is_primary: true,
          },
        ]),
      });

      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      const isStorageWriteRls =
        /row-level security|row level security|violates row-level security|rls/i.test(msg) && /\/storage\/v1\/object\//i.test(msg);
      setError(msg);
      if (isStorageWriteRls) {
        setShowStorageWriteFix(true);
        setStorageWriteFixDetails(
          `这是 Storage 写入被 RLS 拦截（影响 Banner 上传 & 产品图片上传）。\n\n请在 Supabase SQL Editor 执行下方 SQL（会重置 product-media/product-files/site-media/site-files 的写入策略为“仅管理员可写（public.is_admin）”）。`
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function uploadGalleryImages(files: File[]) {
    if (!activeId) {
      setError("Please save product first");
      return;
    }
    setError(null);
    setShowStorageWriteFix(false);
    setStorageWriteFixDetails(null);
    if (busy) return;
    setBusy(true);
    try {
      const maxSort = Math.max(0, ...(active?.product_media ?? []).map((m) => (Number.isFinite(m.sort_order) ? m.sort_order : 0)));
      let nextSort = maxSort + 1;
      for (const file of files) {
        const path = `products/${activeId}/${Date.now()}-${file.name}`;
        const uploaded = await supabase.storage.uploadPublic("product-media", path, file);

        try {
          await supabase.rest("media_assets", "", {
            method: "POST",
            headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
            body: JSON.stringify([
              {
                bucket: "product-media",
                object_path: uploaded.path,
                public_url: uploaded.publicUrl,
                file_name: file.name,
                mime_type: file.type || null,
                kind: "image",
                title: file.name,
                description: null,
                tags: [],
                is_active: true,
              },
            ]),
          });
        } catch {
        }

        await supabase.rest<ProductMediaRow[]>("product_media", "", {
          method: "POST",
          headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify([
            {
              product_id: activeId,
              kind: "image",
              url: uploaded.publicUrl,
              alt_i18n: { en: nameEn.trim(), zh: nameZh.trim() },
              sort_order: nextSort,
              is_primary: false,
            },
          ]),
        });
        nextSort++;
      }
      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      const isStorageWriteRls =
        /row-level security|row level security|violates row-level security|rls/i.test(msg) && /\/storage\/v1\/object\//i.test(msg);
      setError(msg);
      if (isStorageWriteRls) {
        setShowStorageWriteFix(true);
        setStorageWriteFixDetails(
          `这是 Storage 写入被 RLS 拦截（影响 Banner 上传 & 产品图片上传）。\n\n请在 Supabase SQL Editor 执行下方 SQL（会重置 product-media/product-files/site-media/site-files 的写入策略为“仅管理员可写（public.is_admin）”）。`
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function setAsMainImage(mediaId: string) {
    if (!activeId) return;
    setError(null);
    setBusy(true);
    try {
      await supabase.rest<void>("product_media", `?product_id=eq.${encodeURIComponent(activeId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ is_primary: false }),
      });
      await supabase.rest<void>("product_media", `?id=eq.${encodeURIComponent(mediaId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ is_primary: true, sort_order: 0 }),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function addMainFromLibrary(asset: MediaAsset) {
    if (!activeId) return;
    setError(null);
    setBusy(true);
    try {
      await supabase.rest<void>("product_media", `?product_id=eq.${encodeURIComponent(activeId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ is_primary: false }),
      });
      await supabase.rest<ProductMediaRow[]>("product_media", "", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify([
          {
            product_id: activeId,
            kind: "image",
            url: asset.public_url,
            alt_i18n: { en: nameEn.trim(), zh: nameZh.trim() },
            sort_order: 0,
            is_primary: true,
          },
        ]),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add failed");
    } finally {
      setBusy(false);
    }
  }

  async function addGalleryFromLibrary(assets: MediaAsset[]) {
    if (!activeId) return;
    setError(null);
    setBusy(true);
    try {
      const maxSort = Math.max(0, ...(active?.product_media ?? []).map((m) => (Number.isFinite(m.sort_order) ? m.sort_order : 0)));
      let nextSort = maxSort + 1;
      for (const asset of assets) {
        await supabase.rest<ProductMediaRow[]>("product_media", "", {
          method: "POST",
          headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify([
            {
              product_id: activeId,
              kind: "image",
              url: asset.public_url,
              alt_i18n: { en: nameEn.trim(), zh: nameZh.trim() },
              sort_order: nextSort,
              is_primary: false,
            },
          ]),
        });
        nextSort++;
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add failed");
    } finally {
      setBusy(false);
    }
  }

  async function addPdfFromLibrary(asset: MediaAsset) {
    if (!activeId) return;
    setError(null);
    setBusy(true);
    try {
      await supabase.rest<ProductAttachmentRow[]>("product_attachments", "", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify([
          {
            product_id: activeId,
            kind: "pdf",
            url: asset.public_url,
            label_i18n: { en: asset.file_name || asset.title || "Datasheet PDF", zh: asset.file_name || asset.title || "Datasheet PDF" },
            file_name: asset.file_name || null,
          },
        ]),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeMedia(id: string) {
    setError(null);
    setBusy(true);
    try {
      await supabase.rest<void>("product_media", `?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeAttachment(id: string) {
    setError(null);
    setBusy(true);
    try {
      await supabase.rest<void>("product_attachments", `?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(items.map((p) => p.id)));
  }

  async function bulkUpdateProducts(fields: Partial<ProductRow>) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setError(null);
    if (busy) return;
    setBusy(true);
    try {
      await supabase.rest<void>("products", `?id=in.(${ids.map(encodeURIComponent).join(",")})`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(fields),
      });
      await reload();
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch update failed");
    } finally {
      setBusy(false);
    }
  }

  function addBulkRow() {
    setBulkRows((prev) => [
      ...prev,
      {
        client_id: newClientId(),
        slug: "",
        category: categories[0] ?? "TFT",
        name_en: "",
        name_zh: "",
        short_en: "",
        short_zh: "",
        spec_size: "",
        spec_resolution: "",
        spec_lcd_type: "",
        spec_luminance: "",
        spec_operating_temp: "",
        image_name: "",
        in_stock: true,
        is_active: true,
        shop_is_live: false,
        shop_price_usd: 0,
        shop_stock_qty: "",
        image_file: null,
      },
    ]);
  }

  function removeBulkRow(clientId: string) {
    setBulkRows((prev) => prev.filter((r) => r.client_id !== clientId));
  }

  function updateBulkRow(clientId: string, patch: Partial<BulkProductRow>) {
    setBulkRows((prev) => prev.map((r) => (r.client_id === clientId ? { ...r, ...patch } : r)));
  }

  function importBulkFromCsvText(text: string) {
    const rawLines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (rawLines.length === 0) return;

    const header = csvSplitLine(rawLines[0] ?? "").map((h) => h.trim().toLowerCase());
    const idx = (key: string) => header.indexOf(key);

    const rows: BulkProductRow[] = [];
    for (const line of rawLines.slice(1)) {
      const cols = csvSplitLine(line);
      const get = (key: string) => {
        const i = idx(key);
        return i >= 0 ? (cols[i] ?? "").toString() : "";
      };
      const category = normalizeCategory(get("category") || (categories[0] ?? "TFT"));
      const slug = safeSlug(get("slug") || get("name_en") || get("name_zh") || "");
      rows.push({
        client_id: newClientId(),
        slug,
        category,
        name_en: get("name_en"),
        name_zh: get("name_zh"),
        short_en: get("short_en"),
        short_zh: get("short_zh"),
        spec_size: get("spec_size"),
        spec_resolution: get("spec_resolution"),
        spec_lcd_type: get("spec_lcd_type"),
        spec_luminance: get("spec_luminance"),
        spec_operating_temp: get("spec_operating_temp"),
        image_name: get("image_name"),
        in_stock: toBool(get("in_stock"), true),
        is_active: toBool(get("is_active"), true),
        shop_is_live: toBool(get("shop_is_live"), false),
        shop_price_usd: Number(get("shop_price_usd") || 0) || 0,
        shop_stock_qty: get("shop_stock_qty").trim() === "" ? "" : Number(get("shop_stock_qty") || 0) || 0,
        image_file: null,
      });
    }

    if (rows.length > 0) setBulkRows(rows);
  }

  function autoMatchImagesWith(files: File[]) {
    if (files.length === 0) return;
    setBulkRows((prev) =>
      prev.map((r) => {
        if (r.image_file) return r;
        const match = findImageMatch({ imageName: r.image_name, slug: r.slug, files });
        return match ? { ...r, image_file: match } : r;
      })
    );
  }

  async function createProductFromBulkRow(row: BulkProductRow) {
    const s = safeSlug(row.slug);
    if (!s) throw new Error("Slug is required");
    if (!row.name_en.trim() && !row.name_zh.trim()) throw new Error("At least one name is required");

    const payload: Partial<ProductRow> & Pick<ProductRow, "slug" | "category" | "name_i18n" | "short_description_i18n"> = {
      slug: s,
      category: normalizeCategory(row.category),
      in_stock: row.in_stock,
      shop_is_live: row.shop_is_live,
      shop_currency: "USD",
      shop_price_cents: row.shop_price_usd > 0 ? Math.round(row.shop_price_usd * 100) : null,
      shop_stock_qty: row.shop_stock_qty === "" ? null : Number(row.shop_stock_qty),
      name_i18n: { en: row.name_en.trim(), zh: row.name_zh.trim() },
      short_description_i18n: { en: row.short_en.trim(), zh: row.short_zh.trim() },
      spec_size: row.spec_size.trim() || null,
      spec_resolution: row.spec_resolution.trim() || null,
      spec_lcd_type: row.spec_lcd_type.trim() || null,
      spec_luminance: row.spec_luminance.trim() || null,
      spec_operating_temp: row.spec_operating_temp.trim() || null,
      is_active: row.is_active,
      is_featured: false,
      sort_order: 0,
    };

    const { data } = await supabase.rest<ProductRow[]>("products", "", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify([payload]),
    });

    const created = data[0];
    if (!created?.id) throw new Error("Create product failed");
    const productId = created.id;

    if (row.image_file) {
      const path = `products/${productId}/${Date.now()}-${row.image_file.name}`;
      const { publicUrl } = await supabase.storage.uploadPublic("product-media", path, row.image_file);
      await supabase.rest<ProductMediaRow[]>("product_media", "", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify([
          {
            product_id: productId,
            kind: "image",
            url: publicUrl,
            alt_i18n: { en: row.name_en.trim(), zh: row.name_zh.trim() },
            sort_order: 0,
            is_primary: true,
          },
        ]),
      });
    }
  }

  async function bulkCreateAndPublish() {
    setBulkErrors([]);
    setError(null);
    if (bulkBusy || busy) return;
    const candidates = bulkRows.filter((r) => safeSlug(r.slug).length > 0 || r.name_en.trim() || r.name_zh.trim());
    if (candidates.length === 0) {
      setBulkErrors(["No rows to save."]);
      return;
    }

    setBulkBusy(true);
    setBulkProgress({ done: 0, total: candidates.length });
    const errs: string[] = [];
    try {
      let done = 0;
      for (const r of candidates) {
        try {
          await createProductFromBulkRow(r);
        } catch (e) {
          errs.push(`${r.slug || r.name_en || r.name_zh || "(empty)"}: ${e instanceof Error ? e.message : "Failed"}`);
        } finally {
          done++;
          setBulkProgress({ done, total: candidates.length });
        }
      }
      await reload();
      if (errs.length === 0) {
        setBulkRows([
          {
            client_id: newClientId(),
            slug: "",
            category: categories[0] ?? "TFT",
            name_en: "",
            name_zh: "",
            short_en: "",
            short_zh: "",
            spec_size: "",
            spec_resolution: "",
            spec_lcd_type: "",
            spec_luminance: "",
            spec_operating_temp: "",
            image_name: "",
            in_stock: true,
            is_active: true,
            shop_is_live: false,
            shop_price_usd: 0,
            shop_stock_qty: "",
            image_file: null,
          },
        ]);
        setBulkCsv("");
        setBulkImageFiles([]);
      }
    } finally {
      setBulkErrors(errs);
      const hit = errs.some((m) => /row-level security|row level security|violates row-level security|rls/i.test(m) && /\/storage\/v1\/object\//i.test(m));
      if (hit) {
        setShowStorageWriteFix(true);
        setStorageWriteFixDetails(
          "Bulk create 时上传图片也被 Storage RLS 拦截。\n\n请在 Supabase SQL Editor 执行下方 SQL（会重置 product-media/product-files/site-media/site-files 的写入策略为“仅管理员可写（public.is_admin）”）。"
        );
      }
      setBulkBusy(false);
    }
  }

  function downloadBulkCsvTemplate() {
    const header =
      "slug,category,name_en,name_zh,short_en,short_zh,spec_size,spec_resolution,spec_lcd_type,spec_luminance,spec_operating_temp,image_name,in_stock,is_active,shop_is_live,shop_price_usd,shop_stock_qty";
    const example =
      '"oled-1-3inch",OLED,"1.3\\" OLED Display","1.3英寸OLED显示屏","Small OLED display","小尺寸OLED","1.3\\"","128×64","OLED","≥300 cd/m²","-20~70°C","oled-1-3inch.jpg",true,true,true,12.5,100';
    const content = `${header}\n${example}\n`;

    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bulk-create-products-template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_420px]">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold text-zinc-900">Products</div>
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            New product
          </button>
        </div>

        {loading ? <div className="text-sm text-zinc-600">Loading...</div> : null}
        {error ? <div className="whitespace-pre-wrap rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {showStorageWriteFix ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            {storageWriteFixDetails ? <div className="whitespace-pre-wrap text-sm text-amber-900">{storageWriteFixDetails}</div> : null}
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-amber-900">SQL（复制后到 Supabase SQL Editor 执行）</div>
              <button
                type="button"
                disabled={busy || bulkBusy}
                onClick={() => void navigator.clipboard.writeText(storageWriteFixSql)}
                className="inline-flex items-center rounded-md border border-amber-200 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
              >
                Copy SQL
              </button>
            </div>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-white p-2 text-xs text-zinc-800">
              {storageWriteFixSql}
            </pre>
          </div>
        ) : null}

        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-semibold text-zinc-900">Bulk create products</div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={addBulkRow}
                disabled={bulkBusy || busy}
                className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Add row
              </button>
              <button
                type="button"
                onClick={() => void bulkCreateAndPublish()}
                disabled={bulkBusy || busy}
                className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Save & publish all
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3">
            <div className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
              CSV headers (optional): slug,category,name_en,name_zh,short_en,short_zh,spec_size,spec_resolution,spec_lcd_type,spec_luminance,spec_operating_temp,image_name,in_stock,is_active,shop_is_live,shop_price_usd,shop_stock_qty
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                <span>Upload CSV</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  disabled={bulkBusy || busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    e.currentTarget.value = "";
                    if (!f) return;
                    setBulkCsvFileName(f.name);
                    const reader = new FileReader();
                    reader.onload = () => {
                      setBulkCsv(String(reader.result ?? ""));
                    };
                    reader.readAsText(f);
                  }}
                  className="hidden"
                />
              </label>
              {bulkCsvFileName ? <div className="text-xs text-zinc-600">Selected: {bulkCsvFileName}</div> : null}
              <button
                type="button"
                onClick={() => {
                  setBulkCsv("");
                  setBulkCsvFileName(null);
                }}
                disabled={(!bulkCsv.trim() && !bulkCsvFileName) || bulkBusy || busy}
                className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Clear CSV
              </button>
            </div>
            <textarea
              value={bulkCsv}
              onChange={(e) => setBulkCsv(e.target.value)}
              placeholder="Paste CSV text here, or click Upload CSV"
              className="min-h-24 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => importBulkFromCsvText(bulkCsv)}
                disabled={!bulkCsv.trim() || bulkBusy || busy}
                className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Import CSV
              </button>
              <button
                type="button"
                onClick={downloadBulkCsvTemplate}
                disabled={bulkBusy || busy}
                className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Download CSV template
              </button>
              <label className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                <span>Select images</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={bulkBusy || busy}
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    setBulkImageFiles(files);
                    e.currentTarget.value = "";
                    autoMatchImagesWith(files);
                  }}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={() => autoMatchImagesWith(bulkImageFiles)}
                disabled={bulkImageFiles.length === 0 || bulkBusy || busy}
                className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Auto match images
              </button>
              <button
                type="button"
                onClick={() => setBulkImageFiles([])}
                disabled={bulkImageFiles.length === 0 || bulkBusy || busy}
                className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Clear images
              </button>
              {bulkBusy ? (
                <div className="text-sm text-zinc-600">
                  Saving... {bulkProgress.done}/{bulkProgress.total}
                </div>
              ) : null}
            </div>
            {bulkImageFiles.length > 0 ? <div className="text-xs text-zinc-600">Images selected: {bulkImageFiles.length}</div> : null}
            {bulkErrors.length > 0 ? (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {bulkErrors.slice(0, 8).map((m) => (
                  <div key={m}>{m}</div>
                ))}
                {bulkErrors.length > 8 ? <div>…and {bulkErrors.length - 8} more</div> : null}
              </div>
            ) : null}
          </div>

          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[1500px]">
              <div className="grid grid-cols-[160px_120px_180px_180px_240px_260px_150px_160px_90px_90px_90px] gap-2 border-b border-zinc-200 pb-2 text-xs font-semibold text-zinc-500">
                <div>Slug</div>
                <div>Category</div>
                <div>Name (EN)</div>
                <div>Name (ZH)</div>
                <div>Short desc</div>
                <div>Specs</div>
                <div>Image</div>
                <div>Shop</div>
                <div>In stock</div>
                <div>Publish</div>
                <div>Action</div>
              </div>
              <div className="divide-y divide-zinc-200">
                {bulkRows.map((r) => (
                  <div
                    key={r.client_id}
                    className="grid grid-cols-[160px_120px_180px_180px_240px_260px_150px_160px_90px_90px_90px] gap-2 py-2"
                  >
                    <input
                      value={r.slug}
                      onChange={(e) => updateBulkRow(r.client_id, { slug: e.target.value })}
                      placeholder="e.g. oled-1-3inch"
                      className="w-full rounded-md border border-zinc-200 px-2 py-1 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                    />
                    <select
                      value={r.category}
                      onChange={(e) => updateBulkRow(r.client_id, { category: e.target.value })}
                      className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <input
                      value={r.name_en}
                      onChange={(e) => updateBulkRow(r.client_id, { name_en: e.target.value })}
                      className="w-full rounded-md border border-zinc-200 px-2 py-1 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                    />
                    <input
                      value={r.name_zh}
                      onChange={(e) => updateBulkRow(r.client_id, { name_zh: e.target.value })}
                      className="w-full rounded-md border border-zinc-200 px-2 py-1 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                    />
                    <div className="grid grid-cols-1 gap-1">
                      <input
                        value={r.short_en}
                        onChange={(e) => updateBulkRow(r.client_id, { short_en: e.target.value })}
                        placeholder="Short (EN)"
                        className="w-full rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                      />
                      <input
                        value={r.short_zh}
                        onChange={(e) => updateBulkRow(r.client_id, { short_zh: e.target.value })}
                        placeholder="Short (ZH)"
                        className="w-full rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-1">
                      <input
                        value={r.spec_size}
                        onChange={(e) => updateBulkRow(r.client_id, { spec_size: e.target.value })}
                        placeholder='Size e.g. 1.3"'
                        className="w-full rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                      />
                      <input
                        value={r.spec_resolution}
                        onChange={(e) => updateBulkRow(r.client_id, { spec_resolution: e.target.value })}
                        placeholder="Resolution e.g. 128×64"
                        className="w-full rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                      />
                      <input
                        value={r.spec_lcd_type}
                        onChange={(e) => updateBulkRow(r.client_id, { spec_lcd_type: e.target.value })}
                        placeholder="LCD Type e.g. TFT"
                        className="w-full rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                      />
                      <input
                        value={r.spec_luminance}
                        onChange={(e) => updateBulkRow(r.client_id, { spec_luminance: e.target.value })}
                        placeholder="Luminance e.g. ≥300"
                        className="w-full rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                      />
                      <input
                        value={r.spec_operating_temp}
                        onChange={(e) => updateBulkRow(r.client_id, { spec_operating_temp: e.target.value })}
                        placeholder="Temp e.g. -20~70°C"
                        className="w-full rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                      />
                    </div>
                    <div className="space-y-1">
                      <input
                        value={r.image_name}
                        onChange={(e) => updateBulkRow(r.client_id, { image_name: e.target.value })}
                        placeholder="Image name (optional)"
                        className="w-full rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                      />
                      <input
                        type="file"
                        accept="image/*"
                        disabled={bulkBusy || busy}
                        onChange={(e) => updateBulkRow(r.client_id, { image_file: e.target.files?.[0] ?? null })}
                        className="block w-full text-xs"
                      />
                      <div className="truncate text-[11px] text-zinc-600">{r.image_file?.name ?? "—"}</div>
                    </div>
                    <div className="space-y-1">
                      <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
                        <input
                          type="checkbox"
                          checked={r.shop_is_live}
                          onChange={(e) => updateBulkRow(r.client_id, { shop_is_live: e.target.checked })}
                        />
                        Live
                      </label>
                      <div className="grid grid-cols-2 gap-1">
                        <input
                          value={r.shop_price_usd}
                          onChange={(e) => updateBulkRow(r.client_id, { shop_price_usd: Number(e.target.value) })}
                          type="number"
                          min={0}
                          className="w-full rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                          placeholder="USD"
                        />
                        <input
                          value={r.shop_stock_qty}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateBulkRow(r.client_id, { shop_stock_qty: v === "" ? "" : Number(v) });
                          }}
                          type="number"
                          min={0}
                          className="w-full rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                          placeholder="Qty"
                        />
                      </div>
                    </div>
                    <label className="inline-flex items-center justify-center gap-2 text-sm text-zinc-700">
                      <input
                        type="checkbox"
                        checked={r.in_stock}
                        onChange={(e) => updateBulkRow(r.client_id, { in_stock: e.target.checked })}
                      />
                    </label>
                    <label className="inline-flex items-center justify-center gap-2 text-sm text-zinc-700">
                      <input
                        type="checkbox"
                        checked={r.is_active}
                        onChange={(e) => updateBulkRow(r.client_id, { is_active: e.target.checked })}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={bulkBusy || busy}
                      onClick={() => removeBulkRow(r.client_id)}
                      className="text-left text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-zinc-600">{selectedCount > 0 ? `Selected: ${selectedCount}` : ""}</div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={selectedCount === 0 || busy}
              onClick={() => void bulkUpdateProducts({ is_active: true })}
              className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Publish selected
            </button>
            <button
              type="button"
              disabled={selectedCount === 0 || busy}
              onClick={() => void bulkUpdateProducts({ is_active: false })}
              className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Unpublish selected
            </button>
            <button
              type="button"
              disabled={selectedCount === 0 || busy}
              onClick={() => void bulkUpdateProducts({ shop_is_live: true })}
              className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Set shop live
            </button>
            <button
              type="button"
              disabled={selectedCount === 0 || busy}
              onClick={() => void bulkUpdateProducts({ shop_is_live: false })}
              className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Set shop hidden
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <div className="grid grid-cols-[40px_140px_1fr_120px_120px] gap-3 border-b border-zinc-200 px-4 py-3 text-xs font-semibold text-zinc-500">
            <div className="flex items-center">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allSelected}
                disabled={items.length === 0 || busy}
                onChange={(e) => toggleAll(e.target.checked)}
              />
            </div>
            <div>Category</div>
            <div>Name</div>
            <div>Status</div>
            <div>Action</div>
          </div>
          <div className="divide-y divide-zinc-200">
            {items.map((p) => (
              <div key={p.id} className="grid grid-cols-[40px_140px_1fr_120px_120px] gap-3 px-4 py-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p.id)}
                    disabled={busy}
                    onChange={(e) => toggleSelected(p.id, e.target.checked)}
                  />
                </div>
                <div className="text-sm text-zinc-700">{p.category}</div>
                <button
                  type="button"
                  onClick={() => setActiveId(p.id)}
                  className="text-left text-sm font-medium text-zinc-900 hover:underline"
                >
                  {getI18nText(p.name_i18n, "en") || getI18nText(p.name_i18n, "zh") || p.slug}
                </button>
                <div className="text-sm text-zinc-700">{p.is_active ? "Active" : "Hidden"}</div>
                <button
                  type="button"
                  onClick={() => void removeProduct(p.id)}
                  className="text-left text-sm font-medium text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="text-base font-semibold text-zinc-900">{activeId ? "Edit product" : "Create product"}</div>
          <form onSubmit={upsertProduct} className="mt-4 space-y-4">
            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Slug</div>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                placeholder="e.g. oled-1-3inch"
              />
            </label>

            <label className="block space-y-1">
              <div className="text-sm font-medium text-zinc-900">Category</div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-sm font-semibold text-zinc-900">Shop</div>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block space-y-1">
                  <div className="text-sm font-medium text-zinc-900">Price (USD)</div>
                  <input
                    value={shopPrice}
                    onChange={(e) => setShopPrice(Number(e.target.value))}
                    type="number"
                    min={0}
                    className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                  />
                </label>
                <label className="block space-y-1">
                  <div className="text-sm font-medium text-zinc-900">Stock Qty (optional)</div>
                  <input
                    value={shopStockQty}
                    onChange={(e) => {
                      const v = e.target.value;
                      setShopStockQty(v === "" ? "" : Number(v));
                    }}
                    type="number"
                    min={0}
                    className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                  />
                </label>
                <div className="flex items-center gap-6 md:col-span-2">
                  <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
                    <input type="checkbox" checked={shopLive} onChange={(e) => setShopLive(e.target.checked)} />
                    Live in shop
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
                    <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} />
                    In stock label
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <label className="block space-y-1">
                <div className="text-sm font-medium text-zinc-900">Name (EN)</div>
                <input
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                />
              </label>
              <label className="block space-y-1">
                <div className="text-sm font-medium text-zinc-900">Name (ZH)</div>
                <input
                  value={nameZh}
                  onChange={(e) => setNameZh(e.target.value)}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <label className="block space-y-1">
                <div className="text-sm font-medium text-zinc-900">Short description (EN)</div>
                <input
                  value={shortEn}
                  onChange={(e) => setShortEn(e.target.value)}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                />
              </label>
              <label className="block space-y-1">
                <div className="text-sm font-medium text-zinc-900">Short description (ZH)</div>
                <input
                  value={shortZh}
                  onChange={(e) => setShortZh(e.target.value)}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="text-sm font-semibold text-zinc-900">Details</div>
              <label className="block space-y-1">
                <div className="text-sm font-medium text-zinc-900">Details (EN)</div>
                <textarea
                  value={detailEn}
                  onChange={(e) => setDetailEn(e.target.value)}
                  placeholder="Product details..."
                  className="min-h-28 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                />
              </label>
              <label className="block space-y-1">
                <div className="text-sm font-medium text-zinc-900">Details (ZH)</div>
                <textarea
                  value={detailZh}
                  onChange={(e) => setDetailZh(e.target.value)}
                  placeholder="产品细节..."
                  className="min-h-28 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="text-sm font-semibold text-zinc-900">Specifications</div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block space-y-1">
                  <div className="text-sm font-medium text-zinc-900">Size</div>
                  <input
                    value={specSize}
                    onChange={(e) => setSpecSize(e.target.value)}
                    placeholder='e.g. 1.3" / 7" / 2.9"'
                    className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                  />
                </label>
                <label className="block space-y-1">
                  <div className="text-sm font-medium text-zinc-900">Resolution</div>
                  <input
                    value={specResolution}
                    onChange={(e) => setSpecResolution(e.target.value)}
                    placeholder="e.g. 128×64 / 800×480"
                    className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                  />
                </label>
                <label className="block space-y-1">
                  <div className="text-sm font-medium text-zinc-900">LCD Type</div>
                  <input
                    value={specLcdType}
                    onChange={(e) => setSpecLcdType(e.target.value)}
                    placeholder="e.g. TFT / OLED / EPD"
                    list="spec-lcd-type"
                    className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                  />
                </label>
                <label className="block space-y-1">
                  <div className="text-sm font-medium text-zinc-900">Luminance</div>
                  <input
                    value={specLuminance}
                    onChange={(e) => setSpecLuminance(e.target.value)}
                    placeholder="e.g. ≥300 cd/m²"
                    list="spec-luminance"
                    className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                  />
                </label>
                <label className="block space-y-1 md:col-span-2">
                  <div className="text-sm font-medium text-zinc-900">Operating Temp</div>
                  <input
                    value={specOperatingTemp}
                    onChange={(e) => setSpecOperatingTemp(e.target.value)}
                    placeholder="e.g. -20~70°C"
                    list="spec-temp"
                    className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                  />
                </label>
              </div>
              <datalist id="spec-lcd-type">
                <option value="TN" />
                <option value="IPS" />
                <option value="Transflective" />
              </datalist>
              <datalist id="spec-luminance">
                <option value="<300 cd/m²" />
                <option value="≥300~<500 cd/m²" />
                <option value="≥500~<750 cd/m²" />
                <option value="≥750~<1000 cd/m²" />
                <option value="≥1000 cd/m²" />
              </datalist>
              <datalist id="spec-temp">
                <option value="< -30~80°C" />
                <option value="≥ -30~80°C" />
                <option value="-20~70°C" />
                <option value="-30~80°C" />
              </datalist>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-zinc-900">Custom specifications</div>
                  <button
                    type="button"
                    onClick={addSpecTableRow}
                    disabled={busy || specTableAvailable === "missing"}
                    className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    Add row
                  </button>
                </div>

                {specTableAvailable === "missing" ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    当前数据库还没有 `products.spec_table` 字段，无法保存自定义规格行。请先在 Supabase 执行迁移
                    0027_products_spec_table_jsonb.sql 后刷新后台。
                  </div>
                ) : null}

                {specTableRows.length === 0 ? <div className="text-sm text-zinc-600">No custom rows</div> : null}

                {specTableRows.length > 0 ? (
                  <div className="overflow-hidden rounded-xl border border-zinc-200">
                    <div className="grid grid-cols-2 gap-3 bg-slate-900 px-4 py-3 text-xs font-semibold text-white">
                      <div>Item</div>
                      <div>Contents</div>
                    </div>
                    <div className="divide-y divide-zinc-200">
                      {specTableRows.map((r) => (
                        <div key={r.client_id} className="grid grid-cols-2 gap-3 px-4 py-3">
                          <div className="space-y-2">
                            <input
                              value={r.item}
                              onChange={(e) => updateSpecTableRow(r.client_id, { item: e.target.value })}
                              placeholder="e.g. Interface"
                              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                            />
                            <input
                              value={r.unit}
                              onChange={(e) => updateSpecTableRow(r.client_id, { unit: e.target.value })}
                              placeholder="Unit (optional) e.g. V / mm"
                              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-xs text-zinc-700 outline-none focus:ring-2 focus:ring-emerald-400/60"
                            />
                          </div>
                          <div className="space-y-2">
                            <textarea
                              value={r.contents}
                              onChange={(e) => updateSpecTableRow(r.client_id, { contents: e.target.value })}
                              placeholder="e.g. 3.3"
                              className="min-h-20 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-400/60"
                            />
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => removeSpecTableRow(r.client_id)}
                                disabled={busy}
                                className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-50"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
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
              <div className="flex items-end gap-4">
                <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
                  <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} />
                  In stock
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
                  <input type="checkbox" checked={activeFlag} onChange={(e) => setActiveFlag(e.target.checked)} />
                  Active
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
                  <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
                  Featured
                </label>
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

        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="text-sm font-semibold text-zinc-900">Media</div>
          <div className="mt-3 space-y-3">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-semibold text-zinc-900">Main image</div>
                <div className="flex items-start gap-3">
                  <div className="h-28 w-28 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
                    {primaryImage?.url ? <img src={primaryImage.url} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="truncate text-xs text-zinc-600">{primaryImage?.url || "No main image"}</div>
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">
                        Upload main
                        <input
                          type="file"
                          accept="image/*"
                          disabled={!activeId || busy}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void uploadMainImage(f);
                            e.currentTarget.value = "";
                          }}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setMainPickerOpen(true)}
                        disabled={!activeId || busy}
                        className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                      >
                        Choose from library
                      </button>
                      {primaryImage ? (
                        <button
                          type="button"
                          onClick={() => void removeMedia(primaryImage.id)}
                          disabled={busy}
                          className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-zinc-900">Gallery images</div>
                  <div className="flex gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">
                      Upload gallery
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={!activeId || busy}
                        onChange={(e) => {
                          const files = Array.from(e.target.files ?? []);
                          if (files.length > 0) void uploadGalleryImages(files);
                          e.currentTarget.value = "";
                        }}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setGalleryPickerOpen(true)}
                      disabled={!activeId || busy}
                      className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                    >
                      Choose from library
                    </button>
                  </div>
                </div>

                {galleryImages.length === 0 ? <div className="text-sm text-zinc-600">No gallery images</div> : null}
                {galleryImages.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {galleryImages.map((m) => (
                      <div key={m.id} className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
                        <div className="aspect-square bg-zinc-50">
                          <img src={m.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                        </div>
                        <div className="flex items-center justify-between gap-2 p-2">
                          <button
                            type="button"
                            onClick={() => void setAsMainImage(m.id)}
                            disabled={busy}
                            className="text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-50"
                          >
                            Set as main
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeMedia(m.id)}
                            disabled={busy}
                            className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="text-sm font-semibold text-zinc-900">Attachments</div>
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">
                Upload PDF
                <input
                  type="file"
                  accept="application/pdf"
                  disabled={!activeId || busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadPdf(f);
                    e.currentTarget.value = "";
                  }}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={() => setPdfPickerOpen(true)}
                disabled={!activeId || busy}
                className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Choose from library
              </button>
            </div>

            <div className="space-y-2">
              {(active?.product_attachments ?? []).map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 p-3">
                  <a href={a.url} target="_blank" rel="noreferrer" className="truncate text-sm text-zinc-800 hover:underline">
                    {a.file_name || a.url}
                  </a>
                  <button
                    type="button"
                    onClick={() => void removeAttachment(a.id)}
                    disabled={busy}
                    className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <MediaPicker
        open={mainPickerOpen}
        onClose={() => setMainPickerOpen(false)}
        kind="image"
        multi={false}
        title="Choose main image"
        onConfirm={(sel) => {
          setMainPickerOpen(false);
          const one = sel[0];
          if (one) void addMainFromLibrary(one);
        }}
      />

      <MediaPicker
        open={galleryPickerOpen}
        onClose={() => setGalleryPickerOpen(false)}
        kind="image"
        multi
        title="Choose gallery images"
        onConfirm={(sel) => {
          setGalleryPickerOpen(false);
          if (sel.length > 0) void addGalleryFromLibrary(sel);
        }}
      />

      <MediaPicker
        open={pdfPickerOpen}
        onClose={() => setPdfPickerOpen(false)}
        kind="document"
        multi={false}
        title="Choose PDF"
        onConfirm={(sel) => {
          setPdfPickerOpen(false);
          const one = sel[0];
          if (one) void addPdfFromLibrary(one);
        }}
      />
    </div>
  );
}
