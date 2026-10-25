import { describe, expect, it, vi } from "vitest";

// The group pages' topic scroll reads the router.
vi.mock("next/navigation", async (original) => ({ ...(await original<typeof import("next/navigation")>()), useRouter: () => ({ replace() {} }) }));

// U28-06: every hub's header named its coverage and update date. The topic hubs are sections of the group pages now
// (spec 2026-10-24-explorer-regroup §5): each section's heading row states its topic's coverage, and the page header the
// group's latest update.
describe.each(["external", "economy"] as const)("the %s group page", (group) => {
  it("states each topic's coverage in its section, and the group's update date in the header", async () => {
    const [{ renderGroupPage }, { renderPageMarkup }] = await Promise.all([import("../../lib/pages/group"), import("../helpers/render-localized")]);
    const html = renderPageMarkup("en", (await renderGroupPage(group, "en")) as never);
    const sections = [...html.matchAll(/<section[^>]*id="t-[^"]+"[^>]*>([\s\S]*?)<\/section>/g)].map((match) => match[1]);
    expect(sections.length).toBeGreaterThan(1);
    for (const section of sections) expect(section).toMatch(/<p[^>]*>\d{4}–\d{4} · Updated \d{1,2} [A-Z][a-z]+ \d{4} · \d+ pages<\/p>/);
    expect(html).toMatch(/\d+ topics · \d+ pages · Updated \d{1,2} [A-Z][a-z]+ \d{4}/);
  });
});

// U28-10: one wording for the hub cards' "annual" suffix, and the typographic apostrophe in the hub texts.
it.each(["ka", "en"] as const)("the %s hub cards say \"annual data\" one way", async (locale) => {
  const { getMessages } = await import("../../lib/i18n/messages.server");
  const messages = await getMessages(locale, ["trade", "external", "wages", "unemployment", "inflation", "demography"]);
  for (const key of ["trade.annual", "external.annual", "unemployment.annual"]) expect(messages[key], key).toBe(messages["wages.annual"]);
  if (locale === "en") for (const key of ["trade.services.summary", "external.account.summary", "inflation.cardCitiesDescription"]) expect(messages[key], key).not.toContain("'");
});

// U28-19: the English trade heading names what the Georgian one does, and English says "sex" as demography does.
it("English names trade and sex as the Georgian does", async () => {
  const { getMessages } = await import("../../lib/i18n/messages.server");
  const messages = await getMessages("en", ["trade", "unemployment", "wages", "common"]);
  expect(messages["trade.hubTitle"]).toBe("External trade");
  for (const key of ["common.unemploymentGender", "unemployment.page.gender.title"]) expect(messages[key], key).not.toMatch(/gender/i);
});
