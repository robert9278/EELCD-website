import { Link } from "react-router-dom";

import { useI18n } from "@/lib/i18n";

export default function NotFound() {
  const { t } = useI18n();

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="space-y-4">
        <div className="text-sm font-medium text-zinc-500">404</div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">{t("notfound_title")}</h1>
        <p className="max-w-2xl text-base text-zinc-600">{t("notfound_desc")}</p>
        <div>
          <Link
            to="/"
            className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            {t("notfound_back")}
          </Link>
        </div>
      </div>
    </div>
  );
}

