"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { unemploymentSectionForBreakdown } from "../../lib/explorer/unemploymentSections";
import { pageHref } from "../../lib/i18n/routes";
import type { Locale } from "../../lib/i18n/types";
import { useAppReady } from "../explorer-shell/use-app-ready";

export function UnemploymentLegacyLink({ locale }: { locale: Locale }) {
  const router = useRouter();
  useAppReady();
  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(window.location.hash.slice(1));
      if (!["breakdown", "indicator", "sex", "view", "sel", "start", "end", "range"].some(key => params.has(key))) return;
      const section = unemploymentSectionForBreakdown(params.get("breakdown"));
      router.replace(`${pageHref(section.href, locale)}${window.location.search}${window.location.hash}`, { scroll: false });
    };
    restore();
    window.addEventListener("hashchange", restore);
    return () => window.removeEventListener("hashchange", restore);
  }, [locale, router]);
  return null;
}
