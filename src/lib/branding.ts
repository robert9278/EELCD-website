import { useEffect, useState } from "react";

import { supabase, supabaseEnabled } from "@/lib/supabaseClient";

export type SiteBrandingRow = {
  key: string;
  logo_url: string | null;
  logo_alt: string | null;
  is_active: boolean;
};

export function useSiteBranding() {
  const [branding, setBranding] = useState<SiteBrandingRow | null>(null);

  const fallback = { key: "default", logo_url: "/favicon.svg", logo_alt: "EAGLEEYE TECH", is_active: true } satisfies SiteBrandingRow;

  useEffect(() => {
    if (!supabaseEnabled) {
      setBranding(fallback);
      return;
    }
    void (async () => {
      try {
        const { data } = await supabase.rest<SiteBrandingRow[]>(
          "site_branding",
          "?select=key,logo_url,logo_alt,is_active&key=eq.default&limit=1"
        );
        setBranding(data[0] ?? fallback);
      } catch {
        setBranding(fallback);
      }
    })();
  }, []);

  const logoUrl = branding?.logo_url?.trim() ? branding.logo_url.trim() : fallback.logo_url;
  const logoAlt = branding?.logo_alt?.trim() ? branding.logo_alt.trim() : "EAGLEEYE TECH";

  return { branding, logoUrl, logoAlt };
}
