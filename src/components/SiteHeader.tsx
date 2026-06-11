import { useEffect, useRef, useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { ChevronDown, Globe } from "lucide-react";

import { siteConfig } from "@/config/site";
import { useI18n } from "@/lib/i18n";
import BrandLogo from "@/components/BrandLogo";
import { useSiteBranding } from "@/lib/branding";

function HeaderNavLink({ label, href }: { label: string; href: string }) {
  return (
    <NavLink
      to={href}
      className={({ isActive }) =>
        [
          "shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
          isActive ? "text-zinc-900" : "text-zinc-600 hover:text-zinc-900",
        ].join(" ")
      }
    >
      {label}
    </NavLink>
  );
}

export default function SiteHeader() {
  const { header } = siteConfig;
  const { lang, setLang, t } = useI18n();
  const { logoUrl, logoAlt } = useSiteBranding();
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement | null>(null);
  const langOption = lang === "zh" ? { flag: "🇨🇳", label: "中文" } : { flag: "🇺🇸", label: "English" };

  const navLabelKey: Record<string, Parameters<typeof t>[0]> = {
    "About Us": "nav_about",
    Product: "nav_product",
    News: "nav_news",
    "Industry Case Studies": "nav_case",
    "Services & Support": "nav_services",
    "Contact Us": "nav_contact",
  };

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const el = langRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      setLangOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link to="/" className="inline-flex items-center">
          <BrandLogo src={logoUrl} alt={logoAlt} imgClassName="h-[3.6rem] w-auto" />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {header.navLinks.map((l) => (
            <HeaderNavLink
              key={l.href}
              label={navLabelKey[l.label] ? t(navLabelKey[l.label]) : l.label}
              href={l.href}
            />
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="relative" ref={langRef}>
            <button
              type="button"
              onClick={() => setLangOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              aria-haspopup="menu"
              aria-expanded={langOpen}
            >
              <Globe className="h-4 w-4" />
              <span className="inline-flex items-center gap-2">
                <span className="text-base leading-none">{langOption.flag}</span>
                <span className="leading-none">{langOption.label}</span>
              </span>
              <ChevronDown className="h-4 w-4 text-zinc-500" />
            </button>

            {langOpen ? (
              <div className="absolute right-0 top-full mt-2 w-44 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setLang("zh");
                    setLangOpen(false);
                  }}
                  className={
                    lang === "zh"
                      ? "flex w-full items-center gap-2 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-900"
                      : "flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                  }
                  role="menuitem"
                >
                  <span className="text-base leading-none">🇨🇳</span>
                  <span>中文</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLang("en");
                    setLangOpen(false);
                  }}
                  className={
                    lang === "en"
                      ? "flex w-full items-center gap-2 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-900"
                      : "flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                  }
                  role="menuitem"
                >
                  <span className="text-base leading-none">🇺🇸</span>
                  <span>English</span>
                </button>
              </div>
            ) : null}
          </div>
          <Link
            to="/shop"
            className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Shop
          </Link>
          <Link
            to={header.loginHref}
            className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            {t("login")}
          </Link>
        </div>
      </div>

      <div className="border-t border-zinc-200 lg:hidden">
        <div className="mx-auto flex max-w-6xl flex-nowrap gap-x-4 overflow-x-auto px-6 py-3">
          {header.navLinks.map((l) => (
            <HeaderNavLink key={l.href} label={navLabelKey[l.label] ? t(navLabelKey[l.label]) : l.label} href={l.href} />
          ))}
        </div>
      </div>
    </header>
  );
}
