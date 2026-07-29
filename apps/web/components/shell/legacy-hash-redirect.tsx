"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { readLegacyNav, stripNavFromHash } from "../../lib/explorer/urlState";

// Links shared before the route split carried the section in the hash
// (/explorer#nav=analysis). Honour them once, then get out of the way.
// Also flags the hub as hydrated for the browser tests, which wait on it.
export function LegacyHashRedirect() {
  const router = useRouter();

  useEffect(() => {
    document.body.dataset.appReady = "true";

    const nav = readLegacyNav(window.location.hash);
    if (nav === null) return;

    const rest = stripNavFromHash(window.location.hash);
    router.replace(`/explorer/${nav}${rest ? `#${rest}` : ""}`);
  }, [router]);

  return null;
}
