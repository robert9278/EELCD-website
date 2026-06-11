import { useEffect, useState } from "react";

import { supabase, supabaseEnabled } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/i18n";
import { Facebook, Linkedin, MapPin, Mail, Music2, Phone } from "lucide-react";
import PageBanner from "@/components/PageBanner";

type ContactRow = {
  key: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  google_maps_url: string | null;
  facebook: string | null;
  linkedin: string | null;
  tiktok: string | null;
  is_active: boolean;
};

type ContactItem = {
  label: string;
  value: string;
  href?: string;
  icon?: React.ReactNode;
};

function externalHref(value: string) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return "";
}

function googleEmbedUrl(address: string) {
  return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
}

export default function Contact() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<ContactRow | null>(null);

  useEffect(() => {
    if (!supabaseEnabled) return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await supabase.rest<ContactRow[]>(
          "site_contacts",
          "?select=key,email,phone,address,google_maps_url,facebook,linkedin,tiktok,is_active&key=eq.default&limit=1"
        );
        setRow(data[0] ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("contact_loading_failed"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const addressText = row?.address?.trim() || "深圳市宝安区美合意谷人和楼201室";
  const factoryAddressText =
    "No. 1, Fifth Industrial Road, Jingmei Village, Dongkeng Town, Dongguan City, Guangdong Province, China";
  const mapsLink = externalHref(row?.google_maps_url || "") || (addressText ? `https://www.google.com/maps?q=${encodeURIComponent(addressText)}` : "");

  const items: ContactItem[] = [
    {
      label: t("contact_sales_email"),
      value: row?.email || "sales@example.com",
      href: row?.email ? `mailto:${row.email}` : undefined,
      icon: <Mail className="h-4 w-4" />,
    },
    {
      label: t("contact_phone"),
      value: row?.phone || "+86-000-0000-0000",
      href: row?.phone ? `tel:${row.phone}` : undefined,
      icon: <Phone className="h-4 w-4" />,
    },
    {
      label: "Address",
      value: addressText,
      href: mapsLink || undefined,
      icon: <MapPin className="h-4 w-4" />,
    },
    {
      label: "Factory Address",
      value: factoryAddressText,
      icon: <MapPin className="h-4 w-4" />,
    },
  ];

  if (row && !row.is_active) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">{t("contact_hidden")}</div>
      </div>
    );
  }

  return (
    <div>
      <PageBanner title={t("contact_title")} subtitle={t("contact_desc")} pageKey="contact" />
      <div className="mx-auto max-w-6xl space-y-8 px-6 py-16">

        {loading ? <div className="text-sm text-zinc-600">{t("services_loading")}</div> : null}
        {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_420px]">
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {items.map((item) => (
                <div key={item.label} className="rounded-xl border border-zinc-200 bg-white p-6">
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                    <span className="text-zinc-500">{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.href ? (
                    <a
                      href={item.href}
                      target={item.href.startsWith("http") ? "_blank" : undefined}
                      rel={item.href.startsWith("http") ? "noreferrer" : undefined}
                      className="mt-2 block break-all text-sm text-zinc-700 hover:text-zinc-900"
                    >
                      {item.value}
                    </a>
                  ) : (
                    <div className="mt-2 break-all text-sm text-zinc-700">{item.value}</div>
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <div className="text-sm font-semibold text-zinc-900">Social</div>
              <div className="mt-3 flex items-center gap-3">
                {[
                  { label: "Facebook", href: externalHref(row?.facebook || ""), icon: <Facebook className="h-5 w-5" /> },
                  { label: "LinkedIn", href: externalHref(row?.linkedin || ""), icon: <Linkedin className="h-5 w-5" /> },
                  { label: "TikTok", href: externalHref(row?.tiktok || ""), icon: <Music2 className="h-5 w-5" /> },
                ].map((s) => {
                  const enabled = Boolean(s.href);
                  const cls =
                    "inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60";
                  if (!enabled) {
                    return (
                      <span key={s.label} className={cls + " opacity-40"} aria-label={s.label} title={s.label} aria-disabled="true">
                        {s.icon}
                      </span>
                    );
                  }
                  return (
                    <a
                      key={s.label}
                      href={s.href}
                      target="_blank"
                      rel="noreferrer"
                      className={cls}
                      aria-label={s.label}
                      title={s.label}
                    >
                      {s.icon}
                    </a>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <div className="border-b border-zinc-200 p-4">
              <div className="text-sm font-semibold text-zinc-900">Google Map</div>
              <div className="mt-1 text-xs text-zinc-500">{addressText}</div>
            </div>
            <div className="aspect-[4/3]">
              <iframe
                title="Google Map"
                src={googleEmbedUrl(addressText)}
                className="h-full w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

