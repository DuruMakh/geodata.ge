// Editorial category colors (DESIGN.md §4.2). A category keeps the same color on
// every surface: chart lines, table swatches, series panel, treemap, Every 100 GEL,
// radar, budget field, ranking.

export const INK = "#1E1B16";
// Declared before SERIES_COLORS because the computed citizenship remainder reuses it.
export const OTHER_COLOR = "#94856D";

export const SERIES_COLORS: Record<string, string> = {
  "expenditure.total": INK,
  "revenue.total": INK,
  "admin_spending.total": INK,

  // COICOP divisions. A concept keeps its colour site-wide (DESIGN.md §4.2):
  // health, education and transport take the same hues as the budget categories.
  "cpi.cat.01": "#B3402A",
  "cpi.cat.02": "#9C3D5E",
  "cpi.cat.03": "#7A4E8C",
  "cpi.cat.04": "#A5822B",
  "cpi.cat.05": "#8A7B65",
  "cpi.cat.06": "#1F6E56",
  "cpi.cat.07": "#C26E4C",
  "cpi.cat.08": "#4A707A",
  "cpi.cat.09": "#4E5D74",
  "cpi.cat.10": "#3D5A98",
  "cpi.cat.11": "#8C5A32",
  "cpi.cat.12": "#2F4B3A",
  "cpi.cat.residual": "#94856D",

  // Inflation cities (spec 2026-09-26 §6). Six hue families; Georgia is the ink
  // benchmark and needs no entry.
  "city.tbilisi": "#B3402A",
  "city.kutaisi": "#3D5A98",
  "city.batumi": "#1F6E56",
  "city.gori": "#A5822B",
  "city.telavi": "#7A4E8C",
  "city.zugdidi": "#4A707A",

  "spending.social_protection": "#B3402A",
  "spending.health": "#1F6E56",
  "spending.education": "#3D5A98",
  "spending.infrastructure_regional_development": "#A5822B",
  "spending.defence": "#7A4E8C",
  "spending.public_order_safety": "#4A707A",
  "spending.economic_affairs": "#C26E4C",
  "spending.agriculture_environment": "#2F4B3A",
  "spending.culture": "#9C3D5E",
  "spending.sport": "#8A7B65",
  "spending.general_public_services": "#5B5347",
  "spending.debt_service": "#8C5A32",
  "spending.other_unclassified": "#94856D",

  "revenue.vat": "#B3402A",
  "revenue.income_tax": "#3D5A98",
  "revenue.profit_tax": "#1F6E56",
  "revenue.excise_tax": "#A5822B",
  "revenue.import_tax": "#C26E4C",
  "revenue.property_tax": "#7A4E8C",
  "revenue.other_taxes": "#8A7B65",
  "revenue.grants": "#4A707A",
  "revenue.other_revenue": "#9C3D5E",
  "revenue.asset_decrease": "#2F4B3A",
  "revenue.increase_liabilities": "#5B5347",

  "admin_spending.health_social_affairs": "#B3402A",
  "admin_spending.education_science_youth": "#3D5A98",
  "admin_spending.regional_development_infrastructure": "#A5822B",
  "admin_spending.defence": "#7A4E8C",
  "admin_spending.internal_affairs": "#4A707A",
  "admin_spending.environment_agriculture": "#2F4B3A",
  "admin_spending.economy_sustainable_development": "#C26E4C",
  "admin_spending.justice": "#1F6E56",
  "admin_spending.foreign_affairs": "#5B5347",
  "admin_spending.finance": "#4E5D74",
  "admin_spending.culture": "#9C3D5E",
  "admin_spending.sport": "#8A7B65",
  "admin_spending.debt_service": "#8C5A32",
  "admin_spending.other_costs": "#94856D",

  // Municipal functions reuse the semantic colour of the same concept on the
  // budget side, so a category keeps one colour across the whole site
  // (DESIGN.md §4.2). All ten are distinct.
  "municipal.social_protection": "#B3402A",
  "municipal.health": "#1F6E56",
  "municipal.education": "#3D5A98",
  "municipal.housing_communal": "#A5822B",
  "municipal.defence": "#7A4E8C",
  "municipal.public_order_safety": "#4A707A",
  "municipal.economic_affairs": "#C26E4C",
  "municipal.environment": "#2F4B3A",
  "municipal.recreation_culture": "#9C3D5E",
  "municipal.general_public_services": "#5B5347",

  // National economic sectors (NACE Rev.2 sections). A sector wears a site concept
  // colour only when it is that concept (DESIGN.md §4.2): agriculture, transport,
  // defence, education, health and culture. Every other sector has its own hex;
  // tests/explorer/economicSectors.test.ts holds all 21 series at CIEDE2000 ≥ 10
  // apart and ≥ 3:1 against paper and tint. Total GDP is the ink reference line.
  "economy.gdp_total": INK,
  "sector.a": "#2F4B3A",
  "sector.b": "#663E08",
  "sector.c": "#76819F",
  "sector.d": "#9F7B3E",
  "sector.e": "#41757E",
  "sector.f": "#816150",
  "sector.g": "#792F26",
  "sector.h": "#C26E4C",
  "sector.i": "#C16671",
  "sector.j": "#0D89C2",
  "sector.k": "#084D61",
  "sector.l": "#987793",
  "sector.m": "#6D6F50",
  "sector.n": "#474A02",
  "sector.o": "#7A4E8C",
  "sector.p": "#3D5A98",
  "sector.q": "#1F6E56",
  "sector.r": "#9C3D5E",
  "sector.s": "#588E54",
  "sector.t": "#26958A",

  // Migration citizenship groups (demography section spec 2026-10-04 §7). The
  // computed remainder is never a country and wears the shared "other" colour.
  "citizenship.georgia": "#3D5A98",
  "citizenship.russian_federation": "#C26E4C",
  "citizenship.turkey": "#1F6E56",
  "citizenship.azerbaijan": "#A5822B",
  "citizenship.ukraine": "#7A4E8C",
  "citizenship.all_other_computed": OTHER_COLOR,

  // Vital events (births-deaths spec §6) and the sexes (section spec §7, reserved for Age and sex, first used by life expectancy).
  "vital.births": "#1F6E56",
  "vital.deaths": "#8C5A32",
  "sex.male": "#3D5A98",
  "sex.female": "#C26E4C",
};

// Open-ended top-level sets cycle through the editorial palette by position so
// assignments stay stable for a given data ordering. Major programs derive from
// their resolved parent colour below.
export const EDITORIAL_PALETTE = [
  "#B3402A",
  "#1F6E56",
  "#3D5A98",
  "#A5822B",
  "#7A4E8C",
  "#4A707A",
  "#C26E4C",
  "#2F4B3A",
  "#9C3D5E",
  "#8A7B65",
  "#5B5347",
  "#8C5A32",
  "#4E5D74",
  "#94856D",
];

export const POSITIVE = "#1F6E56";
export const NEGATIVE = "#B3402A";
export const ACCENT = "#B3402A";

// Chart-local literals shared by the SVG charts (DESIGN.md §8.3). The lattice
// hex doubles as the hover guide; axis labels are muted mono.
export const CHART_LATTICE = "#C9BEA9";
export const CHART_AXIS_LABEL = "#6A6050";

// Municipality choropleth (spec §5.2). Six-step terracotta ramp, quantile-classed by
// the caller; the last step is ACCENT. Occupied-territory shapes carry no value,
// so they get a flat fill and a dashed stroke instead of a ramp step.
//
// These live here, not in municipality-map.tsx, because the plan's Global Constraints
// forbid hardcoding a hex in a component: colors.ts is this codebase's token
// module and components receive colours as data. Keeping them here also lets the
// index page read the ramp without importing from a "use client" file.
export const MAP_RAMP = ["#F3EBDB", "#E9D6C6", "#DEBBA6", "#D19A80", "#C4735A", ACCENT];
export const MAP_NO_DATA_FILL = "#E5DBC9";
export const MAP_NO_DATA_STROKE = "#C4B69C";

// Major programs take their ministry's hue and step through lightness and
// saturation inside it, so a line's parentage is legible from its colour.
// EDITORIAL_PALETTE cannot serve them: it holds the very hexes the categories
// use, so a program could draw as its own parent — with every ministries series
// selected that put #4A707A on the chart six times.
// Each step is a FRACTION of the headroom between the parent and the edge of the
// readable band, not a fixed offset: three category hexes (#94856D, #8A7B65,
// #5B5347) sit within 2° of hue and are told apart by lightness alone, so a
// fixed offset clamped at the band edge collapsed their families together.
// Scaling by headroom keeps every shade inside the band without clamping.
const PROGRAM_SHADES: ReadonlyArray<{ lightness: number; saturation: number }> = [
  { lightness: 0.3, saturation: -0.25 },
  { lightness: -0.22, saturation: 0.22 },
  { lightness: 0.55, saturation: -0.5 },
  { lightness: -0.45, saturation: 0.4 },
  { lightness: 0.15, saturation: 0.55 },
  { lightness: 0.8, saturation: -0.7 },
  { lightness: -0.7, saturation: -0.18 },
  { lightness: 0.4, saturation: 0.75 },
];

// The bands hold a shade inside its family: paler than this and siblings stop
// reading as one hue, more saturated and they stop reading as one family. The
// band alone does NOT make a shade readable — L 78 sits well above the 3:1
// crossing for the low-saturation warm hues, so readability is enforced
// separately by darkenToFloor below.
const LIGHTNESS_BAND = { min: 22, max: 78 };
const SATURATION_BAND = { min: 14, max: 84 };

// --paper and --tint from globals.css. Lines are drawn on paper; series swatches
// and checked boxes also sit on tinted selected/hovered rows.
const PAPER = "#F7F2E9";
const TINT = "#F1EADC";
const SERIES_BACKGROUNDS = [PAPER, TINT] as const;

// A series line is a graphical object you need to see to read the chart, so it
// owes WCAG 1.4.11 the same 3:1 the --control border owes it.
const NON_TEXT_CONTRAST_FLOOR = 3;

function relativeLuminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const srgb = parseInt(hex.slice(at, at + 2), 16) / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function minimumSeriesContrast(hex: string): number {
  const foreground = relativeLuminance(hex);

  return Math.min(
    ...SERIES_BACKGROUNDS.map((background) => {
      const backgroundLuminance = relativeLuminance(background);
      return (Math.max(foreground, backgroundLuminance) + 0.05) / (Math.min(foreground, backgroundLuminance) + 0.05);
    }),
  );
}

function towardBand(value: number, fraction: number, band: { min: number; max: number }): number {
  return value + fraction * (fraction > 0 ? band.max - value : value - band.min);
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;
  if (delta === 0) return { h: 0, s: 0, l: l * 100 };
  const raw = max === r ? (g - b) / delta : max === g ? 2 + (b - r) / delta : 4 + (r - g) / delta;

  return {
    h: ((raw * 60) % 360 + 360) % 360,
    s: (delta / (1 - Math.abs(2 * l - 1))) * 100,
    l: l * 100,
  };
}

function hslToHex({ h, s, l }: { h: number; s: number; l: number }): string {
  const saturation = s / 100;
  const lightness = l / 100;
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lightness - c / 2;
  const [r, g, b] = (
    [
      [c, x, 0],
      [x, c, 0],
      [0, c, x],
      [0, x, c],
      [x, 0, c],
      [c, 0, x],
    ] as const
  )[Math.floor(h / 60) % 6]!;

  return `#${[r, g, b].map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, "0").toUpperCase()).join("")}`;
}

// Darkening is what pays the floor: it holds hue and saturation — the two channels
// that carry parentage — and moves only lightness, the channel that separates
// siblings, which the caller has headroom to spare on. Stepping by whole L keeps
// the result on the same 8-bit grid the hexes already quantise to.
function darkenToFloor(hsl: { h: number; s: number; l: number }): string {
  let { l } = hsl;
  let hex = hslToHex({ ...hsl, l });
  while (minimumSeriesContrast(hex) < NON_TEXT_CONTRAST_FLOOR && l > 0) {
    l -= 1;
    hex = hslToHex({ ...hsl, l });
  }

  return hex;
}

export function colorForProgram(parentColor: string, ordinal: number): string {
  const parent = hexToHsl(parentColor);
  const used = new Set<string>();
  let resolved = OTHER_COLOR;

  for (let index = 0; index <= ordinal; index += 1) {
    const shade = PROGRAM_SHADES[index % PROGRAM_SHADES.length]!;
    // Later cycles move by smaller fractions of the same headroom instead of
    // repeating the first eight shades. The current corpus needs seven siblings;
    // three cycles cover a future 24 without changing today's assignments.
    const cycleScale = 1 / (Math.floor(index / PROGRAM_SHADES.length) + 1);
    const candidate = {
      h: parent.h,
      s: towardBand(parent.s, shade.saturation * cycleScale, SATURATION_BAND),
      l: towardBand(parent.l, shade.lightness * cycleScale, LIGHTNESS_BAND),
    };
    let collisionNudge = 0;

    do {
      resolved = darkenToFloor({ ...candidate, l: Math.max(0, candidate.l - collisionNudge) });
      collisionNudge += 0.5;
    } while (used.has(resolved));

    used.add(resolved);
  }

  return resolved;
}

export function colorForItem(itemId: string, index: number): string {
  return SERIES_COLORS[itemId] ?? EDITORIAL_PALETTE[index % EDITORIAL_PALETTE.length] ?? OTHER_COLOR;
}
