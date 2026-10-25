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

/** The group page's topic links: one row that scrolls sideways. */
export const TOPIC_LINKS_ID = "group-topic-links";

/** Room left beside a topic link scrolled into the row, so it is clear of the edge's fade (`w-10`). */
const FADE_ROOM = 40;

/** Scrolls the row of topic links sideways, not the page, until the topic's link is in it, clear of the fades. */
function revealTopicLink(links: HTMLElement, topic: string) {
  const link = links.querySelector<HTMLElement>(`a[href="#t-${CSS.escape(topic)}"]`);
  if (!link) return;
  const row = links.getBoundingClientRect();
  const box = link.getBoundingClientRect();
  if (box.left < row.left + FADE_ROOM) links.scrollLeft -= row.left + FADE_ROOM - box.left;
  else if (box.right > row.right - FADE_ROOM) links.scrollLeft += box.right - (row.right - FADE_ROOM);
}

/**
 * On a group page: marks which ends of the topic links' row have more links beyond them (`data-more-start`, `data-more-end`
 * on the row, which show its edge fades) and whether its scrollbar takes room (`data-scrollbar`), follows the forwarded topic (`topicScrollTarget`) once the page has loaded, brings
 * the link of the topic the page opened at into the row, and flags the page hydrated.
 */
export function GroupTopicScroll({ locale, group }: { locale: Locale; group: GroupId }) {
  const router = useRouter();
  useEffect(() => {
    const links = document.getElementById(TOPIC_LINKS_ID);
    const row = links?.parentElement;
    if (!links || !row) return;
    const edges = () => {
      const end = links.scrollWidth - links.clientWidth;
      row.toggleAttribute("data-more-start", links.scrollLeft > 1);
      row.toggleAttribute("data-more-end", links.scrollLeft < end - 1);
      // A scrollbar that takes room (not an overlay one) stands in for the row's bottom padding, so the row stays about one link high.
      links.toggleAttribute("data-scrollbar", links.offsetHeight - links.clientHeight > 1);
    };
    edges();
    links.addEventListener("scroll", edges, { passive: true });
    // The row's width, and its links' widths once the fonts arrive.
    const observer = new ResizeObserver(edges);
    observer.observe(links);
    for (const link of links.children) observer.observe(link);
    return () => {
      links.removeEventListener("scroll", edges);
      observer.disconnect();
    };
  }, []);
  useEffect(() => {
    const target = topicScrollTarget(group, locale, window.location.pathname, window.location.search, window.location.hash);
    if (target !== null && "navigate" in target) {
      router.replace(target.navigate, { scroll: false });
      return;
    }
    if (target !== null) {
      window.history.replaceState(window.history.state, "", target.url);
      const section = document.getElementById(`t-${target.topic}`);
      section?.scrollIntoView();
      section?.focus({ preventScroll: true });
    }
    const topic = target?.topic ?? /^#t-(.+)$/.exec(window.location.hash)?.[1];
    const links = document.getElementById(TOPIC_LINKS_ID);
    if (topic && links) revealTopicLink(links, topic);
  }, [group, locale, router]);
  useAppReady();
  return null;
}
