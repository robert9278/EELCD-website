import { useEffect, useState } from "react";

import { supabase, supabaseEnabled } from "@/lib/supabaseClient";

export type SiteContactRow = {
  key: string;
  email: string | null;
  phone: string | null;
  teams: string | null;
  address: string | null;
  google_maps_url: string | null;
  facebook: string | null;
  linkedin: string | null;
  tiktok: string | null;
  is_active: boolean;
};

export function useSiteContact() {
  const [row, setRow] = useState<SiteContactRow | null>(null);

  useEffect(() => {
    if (!supabaseEnabled) {
      setRow({
        key: "default",
        email: "sales@example.com",
        phone: "+86-000-0000-0000",
        teams: "",
        address: "深圳市宝安区美合意谷人和楼201室",
        google_maps_url: null,
        facebook: null,
        linkedin: null,
        tiktok: null,
        is_active: true,
      });
      return;
    }
    void (async () => {
      try {
        const { data } = await supabase.rest<SiteContactRow[]>(
          "site_contacts",
          "?select=key,email,phone,teams,address,google_maps_url,facebook,linkedin,tiktok,is_active&key=eq.default&limit=1"
        );
        setRow(data[0] ?? null);
      } catch {
        setRow(null);
      }
    })();
  }, []);

  return row;
}
