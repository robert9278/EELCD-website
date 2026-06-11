import { Link } from "react-router-dom";
import { Facebook, Linkedin, Music2, Youtube } from "lucide-react";

import { siteConfig } from "@/config/site";
import { useI18n } from "@/lib/i18n";
import BrandLogo from "@/components/BrandLogo";
import { useSiteBranding } from "@/lib/branding";

function FooterNavLink({ label, href, external }: { label: string; href: string; external?: boolean }) {
  const cls =
    "inline-flex items-center text-sm text-zinc-200/65 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-800";

  if (external) {
    return (
      <a className={cls} href={href} target="_blank" rel="noreferrer">
        {label}
      </a>
    );
  }

  return (
    <Link className={cls} to={href}>
      {label}
    </Link>
  );
}

function SocialIcon({ label }: { label: "Facebook" | "YouTube" | "TikTok" | "LinkedIn" }) {
  if (label === "Facebook") return <Facebook className="h-5 w-5" />;
  if (label === "YouTube") return <Youtube className="h-5 w-5" />;
  if (label === "LinkedIn") return <Linkedin className="h-5 w-5" />;
  return <Music2 className="h-5 w-5" />;
}

export default function SiteFooter() {
  const { footer } = siteConfig;
  const { t } = useI18n();
  const { logoUrl, logoAlt } = useSiteBranding();

  return (
    <footer className="bg-zinc-800 text-zinc-200">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-y-14 px-6 py-16 sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-[minmax(320px,1.7fr)_minmax(160px,0.9fr)_minmax(260px,1.2fr)_minmax(140px,0.6fr)] lg:gap-x-24 lg:px-10 lg:py-20">
        <div className="space-y-7 lg:justify-self-start">
          <BrandLogo src={logoUrl} alt={logoAlt} imgClassName="h-[4.2rem] w-auto" />
          <div className="max-w-sm space-y-3 text-sm leading-7 text-zinc-200/80">
            <div>{t("brand_intro_1")}</div>
            <div>{t("brand_intro_2")}</div>
          </div>
        </div>

        <div className="space-y-6 lg:justify-self-center">
          <div className="text-lg font-semibold tracking-tight text-white">{t("footer_company")}</div>
          <nav className="flex flex-col gap-3" aria-label="Company">
            {footer.companyLinks.map((l) => (
              <FooterNavLink key={l.href + l.label} label={l.label} href={l.href} external={l.external} />
            ))}
          </nav>
        </div>

        <div className="space-y-6 lg:justify-self-center">
          <div className="text-lg font-semibold tracking-tight text-white">{t("footer_product")}</div>
          <nav className="flex flex-col gap-3" aria-label="Product">
            {footer.productLinks.map((l) => (
              <FooterNavLink key={l.href + l.label} label={l.label} href={l.href} external={l.external} />
            ))}
          </nav>
        </div>

        <div className="space-y-6 lg:justify-self-end">
          <div className="text-lg font-semibold tracking-tight text-white lg:text-center">{t("footer_connect")}</div>
          <div className="flex flex-col items-start gap-4 lg:items-center" aria-label="Social links">
            {footer.socialLinks.map((s) => {
              const enabled = s.href.trim().length > 0;
              const cls =
                "inline-flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-800";

              if (!enabled) {
                return (
                  <span
                    key={s.label}
                    className={cls + " opacity-40"}
                    aria-label={s.label}
                    title={s.label}
                    aria-disabled="true"
                  >
                    <SocialIcon label={s.label} />
                  </span>
                );
              }

              return (
                <a
                  key={s.label}
                  className={cls + " hover:bg-zinc-700"}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={s.label}
                  title={s.label}
                >
                  <SocialIcon label={s.label} />
                </a>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-6 text-xs text-zinc-200/60 sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <div>
            © {new Date().getFullYear()} EAGLEEYE TECH. {t("footer_rights")}
          </div>
        </div>
      </div>
    </footer>
  );
}
