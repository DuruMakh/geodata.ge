"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "../../lib/i18n/types";
import { navGroup, type GroupId } from "../../lib/navigation/navTree";
import { useAppReady } from "../explorer-shell/use-app-ready";
import { unemploymentLegacyHref } from "../unemployment/unemployment-legacy-link";

type Target = { navigate: string } | { topic: string; url: string } | null;

/**
 * What a group page does with the address it was opened at. An old topic hub forwards here as `?topic={topic}` with its
 * own `#…` kept (spec 2026-10-24-explorer-regroup §3.1): an old Unemployment hub view in the hash goes on to the page that
 * serves it now; otherwise the topic becomes the section's anchor, `#t-{topic}`, and leaves the query.
 */
export function topicScrollTarget(group: GroupId, locale: Locale, pathname: string, search: string, hash: string): Target {
  const params = new URLSearchParams(search);
  const topic = params.get("topic");
  params.delete("topic");
  const rest = params.toString() ? `?${params}` : "";
  // Only an old Unemployment hub link, forwarded or typed without its topic, can carry one of its views.
  if (group === "labour" && (topic === "unemployment" || topic === null)) {
    const legacy = unemploymentLegacyHref(locale, rest, hash);
    if (legacy) return { navigate: legacy };
  }
  const topics: readonly string[] = navGroup(group).topics;
  return topic !== null && topics.includes(topic) ? { topic, url: `${pathname}${rest}#t-${topic}` } : null;
}

/** The group page's topic links, which wrap onto more rows from 900px. */
export const TOPIC_LINKS_ID = "group-topic-links";

/**
 * On a group page, keeps the sections' scroll margin equal to the sticky topic links' height (`--topic-links-h`, which grows
 * when the links wrap), follows the forwarded topic (`topicScrollTarget`) once the page has loaded, and flags it hydrated.
 */
export function GroupTopicScroll({ locale, group }: { locale: Locale; group: GroupId }) {
  const router = useRouter();
  useEffect(() => {
    const links = document.getElementById(TOPIC_LINKS_ID);
    if (!links) return;
    const root = document.documentElement;
    const measure = () => root.style.setProperty("--topic-links-h", `${links.offsetHeight}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(links);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--topic-links-h");
    };
  }, []);
  useEffect(() => {
    const target = topicScrollTarget(group, locale, window.location.pathname, window.location.search, window.location.hash);
    if (target === null) return;
    if ("navigate" in target) {
      router.replace(target.navigate, { scroll: false });
      return;
    }
    window.history.replaceState(window.history.state, "", target.url);
    const section = document.getElementById(`t-${target.topic}`);
    section?.scrollIntoView();
    section?.focus({ preventScroll: true });
  }, [group, locale, router]);
  useAppReady();
  return null;
}
