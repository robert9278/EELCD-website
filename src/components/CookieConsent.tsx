import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "ee_cookie_consent";

export default function CookieConsent() {
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    setValue(localStorage.getItem(STORAGE_KEY));
  }, []);

  if (value === "accepted" || value === "declined") return null;

  function accept() {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setValue("accepted");
  }

  function decline() {
    localStorage.setItem(STORAGE_KEY, "declined");
    setValue("declined");
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-zinc-700">
          We use cookies to improve your experience.{" "}
          <Link to="/p/cookies-policy" className="font-semibold text-emerald-700 hover:underline">
            Learn more
          </Link>
          .
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={decline}
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={accept}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

