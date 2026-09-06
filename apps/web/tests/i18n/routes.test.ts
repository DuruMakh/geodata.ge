import { describe, expect, it } from "vitest";
import { pageHref, splitLanguagePath, switchLanguageHref } from "../../lib/i18n/routes";

describe("language page addresses", () => {
  it.each([
    ["/", "en", "/en"],
    ["/en", "ka", "/"],
    ["/en/", "en", "/en"],
    ["/explorer/debt", "en", "/en/explorer/debt"],
    ["/en/explorer/debt", "ka", "/explorer/debt"],
    ["/en/explorer/debt", "en", "/en/explorer/debt"],
    ["/explorer/municipalities/06", "en", "/en/explorer/municipalities/06"],
    ["/en/explorer/municipalities/batumi", "ka", "/explorer/municipalities/batumi"],
    ["/methodology/expenditure?from=chart#sources", "en", "/en/methodology/expenditure?from=chart#sources"],
    ["/about", "en", "/en/about"],
    ["/connect", "en", "/en/connect"],
  ] as const)("maps %s to %s without changing the page", (href, locale, expected) => {
    expect(pageHref(href, locale)).toBe(expected);
  });

  it.each([
    "/mcp", "/downloads/data/manifest.json", "/downloads/methodology/debt/files/source.pdf",
    "/sitemap.xml", "/robots.txt", "/llms.txt", "/brand/fiscal-logo-horizontal.svg",
    "/opengraph-image", "https://mof.ge", "//example.com/explorer", "mailto:info@fiscal.ge",
    "#source-archive", "/english", "/explorer-extra", "/en/en/explorer", "/en/mcp",
  ])("leaves resources and unrecognized addresses unchanged: %s", (href) => {
    expect(pageHref(href, "en")).toBe(href);
    expect(pageHref(href, "ka")).toBe(href);
  });

  it("recognizes only a complete English language segment", () => {
    expect(splitLanguagePath("/en/explorer")).toEqual({ locale: "en", pathname: "/explorer" });
    expect(splitLanguagePath("/en")).toEqual({ locale: "en", pathname: "/" });
    expect(splitLanguagePath("/english")).toEqual({ locale: "ka", pathname: "/english" });
  });

  it("preserves a complete shared view in either direction", () => {
    const location = {
      pathname: "/explorer/expenditure",
      search: "?source=shared%20view",
      hash: "#g=ministries&m=table&sh=1&r=2020-2025&sel=admin_spending.defence",
    };
    expect(switchLanguageHref(location, "en")).toBe(
      "/en/explorer/expenditure?source=shared%20view#g=ministries&m=table&sh=1&r=2020-2025&sel=admin_spending.defence",
    );
    expect(switchLanguageHref({ ...location, pathname: "/en/explorer/expenditure" }, "ka")).toBe(
      "/explorer/expenditure?source=shared%20view#g=ministries&m=table&sh=1&r=2020-2025&sel=admin_spending.defence",
    );
  });
});
