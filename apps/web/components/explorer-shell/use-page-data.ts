"use client";
import { useEffect, useState } from "react";

export type PageData<T> = { status: "loading" } | { status: "error" } | { status: "ready"; data: T };

const LOADING = { status: "loading" } as const;
const requests = new Map<string, Promise<unknown>>();

function request(url: string): Promise<unknown> {
  let pending = requests.get(url);
  if (!pending) {
    pending = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
      return response.json();
    });
    // A failure is not remembered, so the next mount asks again.
    pending.catch(() => requests.delete(url));
    requests.set(url, pending);
  }
  return pending;
}

/**
 * A page-data file (lib/data/pageDataFiles.ts) fetched after mount, once per URL per page load. Until `enabled`, nothing
 * is requested and the state stays "loading". The server render is always "loading", so the page around it prerenders.
 */
export function usePageData<T>(url: string, enabled = true): PageData<T> {
  const [result, setResult] = useState<{ url: string; state: PageData<T> } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    request(url).then(
      (data) => { if (current) setResult({ url, state: { status: "ready", data: data as T } }); },
      () => { if (current) setResult({ url, state: { status: "error" } }); },
    );
    return () => { current = false; };
  }, [url, enabled]);
  return result?.url === url ? result.state : LOADING;
}
