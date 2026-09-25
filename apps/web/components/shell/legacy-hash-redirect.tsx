"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import { readLegacyNav, stripNavFromHash } from "../../lib/explorer/urlState";
import { useAppReady } from "../explorer-shell/use-app-ready";

// Links shared before the route split carried the section in the hash
// (/explorer#nav=analysis). Honour them once, then get out of the way.
// Also flags the hub as hydrated for the browser tests, which wait on it.
export function LegacyHashRedirect() {
  const router = useRouter();
  const { locale } = useI18n();

  useAppReady({ clearOnUnmount: false });

  useEffect(() => {
    const nav = readLegacyNav(window.location.hash);
    if (nav === null) return;

    const rest = stripNavFromHash(window.location.hash);
    router.replace(`${pageHref(`/explorer/${nav}`, locale)}${window.location.search}${rest ? `#${rest}` : ""}`);
  }, [router, locale]);

  return null;
}
