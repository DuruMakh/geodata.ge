import { beforeAll, describe, expect, it } from "vitest";
import kaCommon from "../../lib/i18n/messages/ka/common.json";
import enCommon from "../../lib/i18n/messages/en/common.json";
import kaAllData from "../../lib/i18n/messages/ka/allData.json";
import enAllData from "../../lib/i18n/messages/en/allData.json";
import type { Locale } from "../../lib/i18n/types";
import { NAV_GROUPS, NAV_TREE, PAGE_COUNT, groupOfTopic, groupPages } from "../../lib/navigation/navTree";
import type { Place, PlaceEntry, PlaceIndex } from "../../lib/explorer/places/types";
import { buildPlaceIndex } from "../../lib/explorer/places/buildPlaceIndex.server";
import { latinToGeorgian, stem } from "../../lib/explorer/search/georgian";
import { rowLabel, searchExplorer, valueNote, type SearchPage, type SearchResult, type SearchShortcut, type Segment } from "../../lib/explorer/search/searchExplorer";

const ka = kaCommon as Record<string, string>;
const en = enCommon as Record<string, string>;
const kaWords = kaAllData as Record<string, string>;
const enWords = enAllData as Record<string, string>;

// The real navigation names and search words, with no data values.
const PAGES: SearchPage[] = NAV_TREE.flatMap((hub) => {
  const group = groupOfTopic(hub.id);
  return hub.sections.map((section) => {
    const wordKey = `allData.words.${section.href.replace("/explorer/", "").replaceAll("/", ".")}`;
    return {
      href: section.href,
      group: group.id,
      topic: hub.id,
      name: { ka: ka[section.labelKey], en: en[section.labelKey] },
      topicName: { ka: ka[`common.topic.${hub.id}`], en: en[`common.topic.${hub.id}`] },
      groupName: { ka: ka[group.labelKey], en: en[group.labelKey] },
      words: [kaWords[wordKey], enWords[wordKey]].filter(Boolean).join(" "),
      value: "",
      period: "",
      caption: "",
      spark: null,
    };
  });
});

// Every group, and the topics of the groups that hold more than one.
const SHORTCUTS: SearchShortcut[] = NAV_GROUPS.flatMap((group) => [
  { kind: "group" as const, href: group.href, group: group.id, name: { ka: ka[group.labelKey], en: en[group.labelKey] }, count: groupPages(group).length },
  ...(group.topics.length > 1
    ? group.topics.map((topic) => ({
      kind: "topic" as const, href: `${group.href}?topic=${topic}`, group: group.id,
      name: { ka: ka[`common.topic.${topic}`], en: en[`common.topic.${topic}`] }, count: NAV_TREE.find((hub) => hub.id === topic)!.sections.length,
    }))
    : []),
]);

const place = (id: string, kind: Place["kind"], nameKa: string, nameEn: string, regionId: string, extra: Partial<Place> = {}): Place => ({
  id, kind, nameKa, nameEn, regionId, capital: false, facts: [], ...extra,
});
const PLACES: Place[] = [
  place("region.adjara", "region", "აჭარა", "Adjara", "region.adjara", { municipalityCount: 6 }),
  place("region.tbilisi", "region", "თბილისი", "Tbilisi", "region.tbilisi", { capital: true }),
  place("06", "municipality", "ბათუმი", "Batumi", "region.adjara"),
  place("21", "municipality", "ქობულეთი", "Kobuleti", "region.adjara"),
];
const entry = (placeId: string, page: string, href: string): PlaceEntry => ({
  placeId, page, href, value: placeId === "country.georgia" ? "Georgia's figure" : "1", number: 1, period: "2025",
});
const ENTRIES: PlaceEntry[] = [
  entry("country.georgia", "/explorer/municipalities", "/explorer/municipalities/georgia"),
  entry("country.georgia", "/explorer/education/schools", "/explorer/education/schools/georgia"),
  entry("country.georgia", "/explorer/wages/regions", "/explorer/wages/regions"),
  entry("region.adjara", "/explorer/municipalities", "/explorer/municipalities/region/adjara"),
  entry("region.adjara", "/explorer/demography/population", "/explorer/demography/population/region/adjara"),
  entry("region.adjara", "/explorer/education/schools", "/explorer/education/schools/region/adjara"),
  entry("region.adjara", "/explorer/wages/regions", "/explorer/wages/regions/adjara"),
  entry("region.tbilisi", "/explorer/municipalities", "/explorer/municipalities/tbilisi"),
  entry("region.tbilisi", "/explorer/demography/population", "/explorer/demography/population/region/tbilisi"),
  entry("region.tbilisi", "/explorer/inflation/cities", "/explorer/inflation/cities/tbilisi"),
  entry("region.tbilisi", "/explorer/environment/air-quality", "/explorer/environment/air-quality/tbilisi"),
  entry("region.tbilisi", "/explorer/wages/regions", "/explorer/wages/regions/tbilisi"),
  // Batumi's schools come before its budget here, so the budget's first place is the search's doing.
  entry("06", "/explorer/education/schools", "/explorer/education/schools/batumi"),
  entry("06", "/explorer/municipalities", "/explorer/municipalities/batumi"),
  entry("06", "/explorer/demography/population", "/explorer/demography/population/batumi"),
  entry("06", "/explorer/inflation/cities", "/explorer/inflation/cities/batumi"),
  entry("21", "/explorer/municipalities", "/explorer/municipalities/kobuleti"),
];
const INDEX = { places: PLACES, entries: ENTRIES };

const run = (query: string, locale: Locale = "ka") => searchExplorer(query, locale, PAGES, SHORTCUTS, INDEX)!;
const rows = (result: SearchResult) => result.groups.flatMap((group) => group.rows);
const firstRow = (result: SearchResult) => rows(result)[0];
const pageName = (href: string, locale: Locale = "en") => PAGES.find((page) => page.href === href)!.name[locale];
const marked = (segments: Segment[]) => segments.filter((segment) => segment.mark).map((segment) => segment.text).join("|");

describe("the fixture", () => {
  it("carries every page with its names and topic", () => {
    expect(PAGES).toHaveLength(PAGE_COUNT);
    for (const page of PAGES) for (const value of [page.name.ka, page.name.en, page.topicName.ka, page.topicName.en, page.groupName.ka, page.groupName.en]) expect(value, page.href).toBeTruthy();
  });
});

describe("Georgian endings and the Georgian keyboard", () => {
  it("reads Latin letters as the standard Georgian layout", () => {
    expect(latinToGeorgian("xelfasebi")).toBe("ხელფასები");
    expect(latinToGeorgian("Tbilisi")).toBe("თბილისი");
  });

  it("gives a word and its case ending one stem", () => {
    expect(stem("ხელფასების")).toBe(stem("ხელფასები"));
    expect(stem("ბათუმში")).toBe(stem("ბათუმი"));
    expect(stem("მშპ")).toBe("მშპ");
  });
});

describe("the expected results (spec §7.5)", () => {
  it("ინფლაცია: the Inflation shortcut in Prices and money, then Inflation overview", () => {
    const result = run("ინფლაცია");
    expect(result.shortcuts[0]).toMatchObject({ kind: "topic", group: "prices", name: { en: "Inflation" } });
    expect(firstRow(result).href).toBe("/explorer/inflation/overview");
    expect(result.place).toBeNull();
    expect(result.groups.map((group) => group.kind)).toEqual(["flat"]);
  });

  it.each([["ხელფასები", "ka"], ["wages", "en"], ["xelfasebi", "en"]] as const)("%s: the Wages shortcut, then Wages overview", (query, locale) => {
    const result = run(query, locale);
    expect(result.shortcuts[0]).toMatchObject({ kind: "topic", group: "labour", name: { en: "Wages" } });
    expect(firstRow(result).href).toBe("/explorer/wages/overview");
  });

  it("xelfasebi: read through the Georgian keyboard, with the reading", () => {
    expect(run("xelfasebi", "en").reading).toBe("ხელფასები");
    expect(run("ხელფასები").reading).toBeNull();
    expect(run("wages", "en").reading).toBeNull();
  });

  it.each([["მშპ", "ka"], ["GDP", "en"]] as const)("%s: Economy overview", (query, locale) => {
    expect(firstRow(run(query, locale)).href).toBe("/explorer/economy/gdp");
  });

  it("NEET: Young people not in work or study", () => {
    const result = run("NEET", "en");
    expect(firstRow(result).href).toBe("/explorer/unemployment/young-people");
    expect(pageName(firstRow(result).href)).toMatch(/young people/i);
  });

  it.each([["ბათუმი", "ka"], ["Batumi", "en"]] as const)("%s: the Batumi place card, then Batumi's municipal budget", (query, locale) => {
    const result = run(query, locale);
    expect(result.place).toMatchObject({ place: { id: "06" }, typeLabelArgs: { kind: "municipality", region: locale === "ka" ? "აჭარა" : "Adjara" } });
    expect(result.groups[0]).toMatchObject({ kind: "own", label: locale === "ka" ? "ბათუმი" : "Batumi" });
    expect(firstRow(result)).toMatchObject({ href: "/explorer/municipalities/batumi", value: "1", period: "2025" });
    expect(result.groups[0].rows.map((row) => row.href)).toEqual([
      "/explorer/municipalities/batumi", "/explorer/education/schools/batumi", "/explorer/demography/population/batumi", "/explorer/inflation/cities/batumi",
    ]);
    // Adjara's pages Batumi has no row of its own on; its Schools, Population and Budget rows are Batumi's.
    expect(result.groups[1]).toMatchObject({ kind: "region", label: locale === "ka" ? "აჭარა" : "Adjara" });
    expect(result.groups[1].rows.map((row) => row.href)).toEqual(["/explorer/wages/regions/adjara"]);
    expect(result.shortcuts).toEqual([]);
    expect(result.total).toBe(5);
  });

  it("ბათუმი სკოლა: the Batumi card, then Schools in Batumi only", () => {
    const result = run("ბათუმი სკოლა");
    expect(result.place?.place.id).toBe("06");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].kind).toBe("own");
    expect(result.groups[0].rows.map((row) => row.href)).toEqual(["/explorer/education/schools/batumi"]);
    expect(result.total).toBe(1);
  });

  it("აჭარა: the Adjara region card with its six municipalities, then its pages", () => {
    const result = run("აჭარა");
    expect(result.place).toMatchObject({ place: { id: "region.adjara" }, typeLabelArgs: { kind: "region", count: 6 } });
    expect(result.groups.map((group) => group.kind)).toEqual(["own"]);
    expect(result.groups[0].rows.map((row) => row.href)).toEqual([
      "/explorer/municipalities/region/adjara", "/explorer/demography/population/region/adjara", "/explorer/education/schools/region/adjara", "/explorer/wages/regions/adjara",
    ]);
  });

  it("qwzx: nothing found", () => {
    const result = run("qwzx", "en");
    expect(result.total).toBe(0);
    expect(result.groups).toEqual([]);
    expect(result.shortcuts).toEqual([]);
    expect(result.place).toBeNull();
    expect(result.reading).toBeNull();
  });
});

describe("decorated and mixed queries (Review Focus 1)", () => {
  it.each([
    ["„ბათუმი“", "ბათუმი"],
    [" WAGES ", "wages"],
    ["  wages  ", "wages"],
    ["WAGES", "wages"],
    ["ხელფასები,", "ხელფასები"],
    ["(ინფლაცია).", "ინფლაცია"],
    ["ხელფასები — რეგიონები", "ხელფასები რეგიონები"],
    ["Wages — regions", "wages regions"],
    ["Wages - regions", "wages regions"],
    ["Wages – regions", "wages regions"],
  ])("%j gives the same results as %j", (decorated, plain) => {
    expect(run(decorated)).toEqual(run(plain));
    expect(run(decorated, "en")).toEqual(run(plain, "en"));
  });

  it("returns null for an empty or punctuation-only query", () => {
    expect(searchExplorer("", "ka", PAGES, SHORTCUTS, INDEX)).toBeNull();
    expect(searchExplorer("   ", "ka", PAGES, SHORTCUTS, INDEX)).toBeNull();
    expect(searchExplorer("„“,", "ka", PAGES, SHORTCUTS, INDEX)).toBeNull();
  });
});

describe("a lone dash or capital Latin", () => {
  it("finds the page a row's own label names", () => {
    expect(firstRow(run("ხელფასები — რეგიონები")).href).toBe("/explorer/wages/regions");
    expect(firstRow(run("Wages — regions", "en")).href).toBe("/explorer/wages/regions");
  });

  it("reads all-caps Latin through the keyboard in lower case once the Shift letters find nothing", () => {
    const result = run("XELFASEBI", "en");
    expect(result.reading).toBe("ხელფასები");
    expect(firstRow(result).href).toBe("/explorer/wages/overview");
    expect(run("Tbilisi", "en").reading).toBeNull();
  });
});

describe("a place with a case ending", () => {
  it.each([["ბათუმში", "06"], ["ბათუმის", "06"], ["თბილისში", "region.tbilisi"], ["აჭარაში", "region.adjara"], ["ქობულეთში", "21"]])("%s finds %s", (query, id) => {
    expect(run(query).place?.place.id).toBe(id);
  });
});

describe("Tbilisi (Review Focus 2)", () => {
  it("is one capital place card, with its own rows once each", () => {
    for (const query of ["თბილისი", "Tbilisi", "tbilisi"]) {
      const result = run(query);
      expect(result.place).toMatchObject({ place: { id: "region.tbilisi" }, typeLabelArgs: { kind: "capital" } });
      const hrefs = rows(result).map((row) => row.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
      expect(result.groups.map((group) => group.kind)).toEqual(["own"]);
      expect(hrefs).toEqual([
        "/explorer/municipalities/tbilisi", "/explorer/demography/population/region/tbilisi", "/explorer/inflation/cities/tbilisi",
        "/explorer/environment/air-quality/tbilisi", "/explorer/wages/regions/tbilisi",
      ]);
    }
  });
});

describe("rows", () => {
  it("never lists Georgia's entries for a place or a page", () => {
    for (const query of ["ბათუმი", "აჭარა", "თბილისი", "სკოლები", "ხელფასები", "საქართველოს სკოლები", "schools in georgia"]) {
      for (const row of rows(run(query))) expect(row.value, `${query} ${row.href}`).not.toBe("Georgia's figure");
    }
  });

  it("list Georgia's own entries for Georgia alone, with no place card", () => {
    for (const [query, locale] of [["საქართველო", "ka"], ["georgia", "en"], ["Georgia", "en"], ["of Georgia", "en"], ["საქართველოში", "ka"]] as const) {
      const result = run(query, locale);
      expect(result.place, query).toBeNull();
      expect(result.groups.map((group) => group.kind), query).toEqual(["country"]);
      expect(rows(result).map((row) => row.href), query).toEqual([
        "/explorer/municipalities/georgia", "/explorer/education/schools/georgia", "/explorer/wages/regions",
      ]);
      expect(rows(result).every((row) => row.value === "Georgia's figure"), query).toBe(true);
    }
    // Without the place index there is nothing to list, and no error.
    expect(searchExplorer("საქართველო", "ka", PAGES, SHORTCUTS, null)).toMatchObject({ place: null, groups: [], total: 0 });
  });

  it("show the page's own value without a place, and the place's value with one", () => {
    const pages = PAGES.map((page) => (page.href === "/explorer/education/schools" ? { ...page, value: "500", period: "2024/25" } : page));
    const flat = searchExplorer("სკოლები", "ka", pages, SHORTCUTS, INDEX)!;
    expect(firstRow(flat)).toMatchObject({ href: "/explorer/education/schools", value: "500", period: "2024/25" });
    const placed = searchExplorer("ბათუმი სკოლები", "ka", pages, SHORTCUTS, INDEX)!;
    expect(firstRow(placed)).toMatchObject({ href: "/explorer/education/schools/batumi", value: "1", period: "2025" });
    expect(firstRow(placed).page.href).toBe("/explorer/education/schools");
  });

  it("search pages alone when the place index has not arrived", () => {
    expect(firstRow(searchExplorer("სკოლა", "ka", PAGES, SHORTCUTS, null)!).href).toBe("/explorer/education/schools");
    const result = searchExplorer("ბათუმი სკოლა", "ka", PAGES, SHORTCUTS, null)!;
    expect(result.place).toBeNull();
    expect(result.total).toBe(0);
  });

  it("highlight the matched letters in the label and the other language's name", () => {
    const result = run("ინფლაცია");
    const overview = firstRow(result);
    expect(overview.label.map((segment) => segment.text).join("")).toBe("ინფლაციის მიმოხილვა");
    expect(overview.label.slice(0, 2)).toEqual([{ text: "ინფლაციი", mark: true }, { text: "ს მიმოხილვა", mark: false }]);
    expect(marked(overview.label)).toBe([..."ინფლაციის მიმოხილვა"].slice(0, 8).join(""));
    expect(marked(run("wag", "en").groups[0].rows[0].label)).toBe("Wag");
    expect(marked(run("wages", "ka").groups[0].rows[0].mirror)).toBe("Wages");
  });

  it("put the topic in front of a vague page name", () => {
    const wagesRegions = PAGES.find((page) => page.href === "/explorer/wages/regions")!;
    expect(rowLabel(wagesRegions, "ka")).toBe("ხელფასები — რეგიონები");
    expect(rowLabel(wagesRegions, "en")).toBe("Wages — regions");
    const tradeOverview = PAGES.find((page) => page.href === "/explorer/trade/overview")!;
    expect([rowLabel(tradeOverview, "ka"), rowLabel(tradeOverview, "en")]).toEqual(["საგარეო ვაჭრობა — მიმოხილვა", "Trade — overview"]);
    const gdpExpenditure = PAGES.find((page) => page.href === "/explorer/economy/expenditure")!;
    expect([rowLabel(gdpExpenditure, "ka"), rowLabel(gdpExpenditure, "en")]).toEqual(["ეკონომიკა — დანახარჯები", "Economy — expenditure"]);
    const overview = PAGES.find((page) => page.href === "/explorer/wages/overview")!;
    expect(rowLabel(overview, "en")).toBe(overview.name.en);
  });

  it("narrow to pages that match every word", () => {
    const result = run("ხელფასები რეგიონები");
    expect(firstRow(result).href).toBe("/explorer/wages/regions");
    expect(marked(firstRow(result).label)).toBe("ხელფასები|რეგიონები");
  });
});

describe("the real 74 places", () => {
  const indexes = {} as Record<Locale, PlaceIndex>;
  beforeAll(async () => {
    process.env.NEXT_PUBLIC_SITE_URL ??= "https://fiscal.ge";
    [indexes.ka, indexes.en] = await Promise.all([buildPlaceIndex("ka"), buildPlaceIndex("en")]);
  }, 180_000);

  it.each(["ka", "en"] as const)("never take a page's name or label for a place (%s)", (locale) => {
    expect(indexes[locale].places).toHaveLength(74);
    for (const page of PAGES) {
      for (const query of [page.name[locale], rowLabel(page, locale)]) {
        const result = searchExplorer(query, locale, PAGES, SHORTCUTS, indexes[locale])!;
        expect(result.place, `${query} → ${result.place?.place.nameEn}`).toBeNull();
        expect(firstRow(result).page.name[locale], query).toBe(page.name[locale]);
      }
      // A name two pages share (English "Expenditure": the budget's and GDP's) cannot pick one of them.
      if (PAGES.filter((other) => other.name[locale] === page.name[locale]).length > 1) continue;
      const label = searchExplorer(rowLabel(page, locale), locale, PAGES, SHORTCUTS, indexes[locale])!;
      expect(firstRow(label).href, rowLabel(page, locale)).toBe(page.href);
    }
  });

  it.each(["საბავშვო ბაღები", "ბაღები", "საგარეო", "საგარეო ვალი", "საგარეო ვაჭრობა", "საგარეო ნაკადები", "საგარეო სექტორი", "წყალი"])("%s names no place", (query) => {
    const result = searchExplorer(query, "ka", PAGES, SHORTCUTS, indexes.ka)!;
    expect(result.place).toBeNull();
    expect(result.suggestions).toEqual([]);
  });

  it.each([
    ["ბათუმში", "ka", "Batumi"], ["თბილისში", "ka", "Tbilisi"], ["აჭარაში", "ka", "Adjara"], ["ქობულეთში", "ka", "Kobuleti"],
    // Short names take a case ending on their stem, and a municipality's whole name beats the region it starts.
    ["გორში", "ka", "Gori"], ["ფოთში", "ka", "Poti"], ["ხონში", "ka", "Khoni"], ["ვანში", "ka", "Vani"], ["ხობში", "ka", "Khobi"],
    ["ქედაში", "ka", "Keda"], ["ხულოში", "ka", "Khulo"], ["ონში", "ka", "Oni"], ["გორის", "ka", "Gori"], ["მცხეთაში", "ka", "Mtskheta"],
    ["სამეგრელო-ზემო სვანეთი", "ka", "Samegrelo-Zemo Svaneti"], ["Samegrelo-Zemo Svaneti", "en", "Samegrelo-Zemo Svaneti"], ["Kvemo Kartli", "en", "Kvemo Kartli"],
  ] as const)("%s finds %s", (query, locale, nameEn) => {
    expect(searchExplorer(query, locale, PAGES, SHORTCUTS, indexes[locale])!.place?.place.nameEn).toBe(nameEn);
  });

  // The deep review's queries (search.md, 2026-10-25), against the real index.
  const real = (query: string, locale: Locale = "ka") => searchExplorer(query, locale, PAGES, SHORTCUTS, indexes[locale])!;
  const placeOf = (query: string, locale: Locale = "ka") => real(query, locale).place?.place.nameEn ?? null;
  const hrefsOf = (query: string, locale: Locale = "ka") => rows(real(query, locale)).map((row) => row.href);

  it("never take a word of a page's names, topic, group or search words for a place", () => {
    for (const locale of ["ka", "en"] as const) {
      const words = new Set(PAGES.flatMap((page) => [page.name.ka, page.name.en, page.topicName.ka, page.topicName.en, page.groupName.ka, page.groupName.en, page.words]
        .flatMap((field) => field.toLocaleLowerCase("en").split(/[\s,—–]+/)).filter((word) => /[\p{L}\p{N}]/u.test(word))));
      for (const word of words) expect(placeOf(word, locale), `${word} (${locale})`).toBeNull();
    }
  });

  it.each([["გურიის", "Guria"], ["გურიით", "Guria"], ["მესტიის", "Mestia"], ["სამტრედიის", "Samtredia"]])("%s, a -ია name's genitive or instrumental, finds %s", (query, nameEn) => {
    expect(placeOf(query)).toBe(nameEn);
    expect(real(query).total).toBeGreaterThan(0);
  });

  it("narrows a -ია name's genitive by the next word", () => {
    expect(hrefsOf("გურიის ბიუჯეტი")).toEqual(["/explorer/municipalities/region/guria"]);
    expect(hrefsOf("მესტიის მოსახლეობა")).toEqual(["/explorer/demography/population/mestia"]);
  });

  it.each([["მთლიანი შიდა პროდუქტი", "ka"], ["შიდა პროდუქტი", "ka"], ["gross domestic product", "en"]] as const)("%s is GDP, not Shida Kartli", (query, locale) => {
    const result = real(query, locale);
    expect(result.place).toBeNull();
    expect(firstRow(result).href).toBe("/explorer/economy/gdp");
    expect(firstRow(searchExplorer(query, locale, PAGES, SHORTCUTS, null)!).href).toBe("/explorer/economy/gdp");
  });

  it.each(["შიდა", "ქვემო", "ზემო", "შიდ", "ქვემ", "შიდა ვალი"])("a lone %s names no region", (query) => {
    expect(placeOf(query)).toBeNull();
  });

  it.each(["Shida", "Kvemo", "Zemo"])("a lone %s names no region in English", (query) => {
    expect(placeOf(query, "en")).toBeNull();
  });

  const KVEMO = ["Kvemo Kartli", "Racha-Lechkhumi and Kvemo Svaneti"], ZEMO = ["Samegrelo-Zemo Svaneti"], SHIDA = ["Shida Kartli"];
  const KARTLI = ["Kvemo Kartli", "Shida Kartli"], SVANETI = ["Racha-Lechkhumi and Kvemo Svaneti", "Samegrelo-Zemo Svaneti"];
  it.each([
    ["ქვემო", "ka", KVEMO], ["ზემო", "ka", ZEMO], ["შიდა", "ka", SHIDA], ["Kvemo", "en", KVEMO], ["Zemo", "en", ZEMO], ["Shida", "en", SHIDA],
    ["ქართლი", "ka", KARTLI], ["ქართლის", "ka", KARTLI], ["სვანეთი", "ka", SVANETI], ["Kartli", "en", KARTLI], ["Svaneti", "en", SVANETI], ["kvemo", "ka", KVEMO],
  ] as const)("a lone %s suggests the regions whose names hold it, and names none (N4)", (query, locale, names) => {
    const result = real(query, locale);
    expect(result.place).toBeNull();
    expect(result.suggestions.map((candidate) => candidate.nameEn).sort()).toEqual([...names].sort());
  });

  it("keeps the pages a lone weak word finds beside its suggestions", () => {
    const result = real("შიდა");
    expect(rows(result).map((row) => row.href)).toEqual(expect.arrayContaining(["/explorer/economy/gdp", "/explorer/debt"]));
    expect(result.suggestions.map((candidate) => candidate.nameEn)).toEqual(SHIDA);
  });

  it.each([
    ["მთიანეთი", "ka", "Mtskheta-Mtianeti"], ["ლეჩხუმი", "ka", "Racha-Lechkhumi and Kvemo Svaneti"], ["ჯავახეთი", "ka", "Samtskhe-Javakheti"],
    ["ქვემო სვანეთი", "ka", "Racha-Lechkhumi and Kvemo Svaneti"], ["ზემო სვანეთი", "ka", "Samegrelo-Zemo Svaneti"], ["ზემო სვანეთის", "ka", "Samegrelo-Zemo Svaneti"],
    ["Kvemo Svaneti", "en", "Racha-Lechkhumi and Kvemo Svaneti"], ["zemo svaneti", "en", "Samegrelo-Zemo Svaneti"], ["mtianeti", "en", "Mtskheta-Mtianeti"],
  ] as const)("%s, a later part of one region's name, finds %s", (query, locale, nameEn) => {
    const result = real(query, locale);
    expect(result.place?.place.nameEn).toBe(nameEn);
    expect(result.suggestions).toEqual([]);
    expect(result.total).toBeGreaterThan(0);
  });

  it("narrows a region found by a later word with the next word", () => {
    expect(hrefsOf("ზემო სვანეთის ხელფასები")).toEqual(["/explorer/wages/regions/samegrelo_zemo_svaneti"]);
  });

  it.each(["და", "and", "შიდა ვალი", "ქვემო ქართლი", "ბათუმი", "ინფლაცია"])("%s suggests no place", (query) => {
    expect(real(query, /^[a-z]/.test(query) ? "en" : "ka").suggestions).toEqual([]);
  });

  it.each([
    ["შიდა ქართლი", "ka", "Shida Kartli"], ["Shida Kartli", "en", "Shida Kartli"], ["ქვემო ქართლი", "ka", "Kvemo Kartli"], ["kvemo kartli", "en", "Kvemo Kartli"],
    ["ქვემო ქართლის", "ka", "Kvemo Kartli"], ["მცხეთა მთიანეთი", "ka", "Mtskheta-Mtianeti"], ["mtskheta mtianeti", "en", "Mtskheta-Mtianeti"],
    ["მცხეთა", "ka", "Mtskheta"], ["რაჭა", "ka", "Racha-Lechkhumi and Kvemo Svaneti"], ["Samegrelo", "en", "Samegrelo-Zemo Svaneti"],
  ] as const)("%s, with its second word or as a whole, finds %s", (query, locale, nameEn) => {
    expect(placeOf(query, locale)).toBe(nameEn);
    expect(real(query, locale).total).toBeGreaterThan(0);
  });

  it.each([["შიდა ვალი", "ka"], ["საგარეო ვალი", "ka"], ["domestic debt", "en"], ["external debt", "en"]] as const)("%s finds the Debt page, which has the series (N3)", (query, locale) => {
    const result = real(query, locale);
    expect(result.place).toBeNull();
    expect(rows(result).map((row) => row.href)).toContain("/explorer/debt");
  });

  it("reads a region's two words and a page word together", () => {
    expect(hrefsOf("შიდა ქართლის ხელფასები")).toEqual(["/explorer/wages/regions/shida_kartli"]);
  });

  it.each([
    ["schools in gori", "Gori", ["/explorer/education/schools/gori"]],
    ["population of batumi", "Batumi", ["/explorer/demography/population/batumi"]],
    ["budget of tbilisi", "Tbilisi", ["/explorer/municipalities/tbilisi"]],
    ["wages in tbilisi", "Tbilisi", ["/explorer/wages/regions/tbilisi"]],
    ["inflation in batumi", "Batumi", ["/explorer/inflation/cities/batumi"]],
  ])("%s: English joining words are dropped", (query, nameEn, expected) => {
    expect(placeOf(query, "en")).toBe(nameEn);
    expect(hrefsOf(query, "en")).toEqual(expected);
  });

  it("unemployment in kutaisi: Kutaisi, with its region's unemployment", () => {
    expect(placeOf("unemployment in kutaisi", "en")).toBe("Kutaisi");
    expect(hrefsOf("unemployment in kutaisi", "en")).toContain("/explorer/unemployment/regions/imereti");
  });

  it.each([["georgia", "en"], ["Georgia", "en"], ["საქართველო", "ka"]] as const)("%s alone lists Georgia's national figures", (query, locale) => {
    const result = real(query, locale);
    expect(result.place).toBeNull();
    expect(result.groups.map((group) => group.kind)).toEqual(["country"]);
    expect(rows(result).length).toBe(indexes[locale].entries.filter((candidate) => candidate.placeId === "country.georgia").length);
    expect(firstRow(result).href).toBe("/explorer/municipalities/georgia");
  });

  it("drops Georgia beside other words", () => {
    expect(firstRow(real("inflation in georgia", "en")).href).toBe("/explorer/inflation/overview");
    expect(real("inflation in georgia", "en").shortcuts[0]).toMatchObject({ name: { en: "Inflation" } });
    for (const [query, locale] of [["Georgia budget", "en"], ["საქართველოს ბიუჯეტი", "ka"]] as const) {
      const result = real(query, locale);
      expect(result.place, query).toBeNull();
      expect(firstRow(result).page.group, query).toBe("budget");
      expect(result.shortcuts[0], query).toMatchObject({ kind: "group", group: "budget" });
    }
  });

  it.each([
    ["საგ", "ka"], ["საგა", "ka"], ["საგარ", "ka"], ["საგარე", "ka"], ["ახალ", "ka"], ["ხელ", "ka"], ["საბავშვო ბაღ", "ka"], ["ჰაერის ხარ", "ka"],
    ["ახალგაზრდები გარ", "ka"], ["mar", "en"],
  ] as const)("%s, a page word half typed, keeps its pages rather than a place's", (query, locale) => {
    const result = real(query, locale);
    expect(result.place).toBeNull();
    expect(result.total).toBeGreaterThan(0);
  });

  it("a half-typed place with no page to find still names it", () => {
    expect(placeOf("ბათ")).toBe("Batumi");
    expect(placeOf("Zestaf", "en")).toBe("Zestafoni");
  });

  it("gives the pages when a place's rows are all ruled out", () => {
    // Keda has no inflation city page, nor has Adjara.
    const result = real("ქედა ინფლაცია");
    expect(result.place).toBeNull();
    expect(firstRow(result).href).toBe("/explorer/inflation/overview");
  });

  it.each([
    ["Zestaponi", "Zestafoni"], ["Ajara", "Adjara"], ["Achara", "Adjara"], ["Stepantsminda", "Kazbegi"], ["Signagi", "Sighnaghi"], ["Tsqaltubo", "Tskaltubo"],
  ])("%s, another spelling, finds %s", (query, nameEn) => {
    expect(placeOf(query, "en")).toBe(nameEn);
  });

  it("knows Stepantsminda in Georgian too", () => {
    expect(placeOf("სტეფანწმინდა")).toBe("Kazbegi");
  });

  it("drops only whole words of the place's name: tsageri age keeps age", () => {
    const all = hrefsOf("tsageri", "en");
    const aged = hrefsOf("tsageri age", "en");
    expect(placeOf("tsageri age", "en")).toBe("Tsageri");
    expect(aged).toContain("/explorer/demography/age-sex");
    expect(aged.length).toBeLessThan(all.length);
    expect(hrefsOf("ცაგერი ასაკი")).toEqual(["/explorer/demography/age-sex"]);
    expect(hrefsOf("Kvemo Kartli", "en")).toEqual(hrefsOf("kvemo kartli kartli", "en"));
  });

  it("states births, captioned, on a place's Births and deaths row", () => {
    const births = rows(real("ბათუმი")).find((row) => row.page.href === "/explorer/demography/births-deaths")!;
    const entry = indexes.ka.entries.find((candidate) => candidate.placeId === "06" && candidate.page === "/explorer/demography/births-deaths")!;
    expect(births).toMatchObject({ value: entry.value, caption: "დაბადება", href: "/explorer/demography/population/batumi#births-deaths" });
  });

  it("lists a region's share aged 65+ under its municipalities' region", () => {
    const result = real("ბათუმი");
    const region = result.groups.find((group) => group.kind === "region")!;
    expect(region.rows.find((row) => row.page.href === "/explorer/demography/age-sex")).toMatchObject({ href: "/explorer/demography/age-sex", caption: "65+ წლის მოსახლეობა" });
  });

});

describe("valueNote", () => {
  it("writes a row's caption, period and preliminary mark as its card does", () => {
    expect(valueNote({ caption: "Top 3 sectors’ GDP share", period: "2025", status: "preliminary" }, "Preliminary")).toBe("Top 3 sectors’ GDP share · 2025 · Preliminary");
    expect(valueNote({ caption: "", period: "2025" }, "Preliminary")).toBe("2025");
  });
});
