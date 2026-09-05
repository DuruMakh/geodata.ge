import type { Locale } from "./types";

export function splitLanguagePath(pathname: string): { locale: Locale; pathname: string } {
  if (pathname === "/en") return { locale: "en", pathname: "/" };
  if (pathname.startsWith("/en/")) return { locale: "en", pathname: pathname.slice(3) };
  return { locale: "ka", pathname };
}

function isPublicPage(pathname: string): boolean {
  return pathname === "/" || pathname === "/about" || pathname === "/connect" ||
    pathname === "/explorer" || pathname.startsWith("/explorer/") ||
    pathname === "/methodology" || pathname.startsWith("/methodology/");
}

export function pageHref(href: string, locale: Locale): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const suffixIndex = href.search(/[?#]/);
  const pathname = suffixIndex < 0 ? href : href.slice(0, suffixIndex);
  const suffix = suffixIndex < 0 ? "" : href.slice(suffixIndex);
  const page = splitLanguagePath(pathname).pathname;
  if (!isPublicPage(page)) return href;
  return `${locale === "en" ? `/en${page === "/" ? "" : page}` : page}${suffix}`;
}

export function switchLanguageHref(
  location: { pathname: string; search: string; hash: string },
  target: Locale,
): string {
  return `${pageHref(location.pathname, target)}${location.search}${location.hash}`;
}
