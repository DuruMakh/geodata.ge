export type MunicipalityRoute = { code: string; slug: string };

export const MUNICIPALITY_ROUTES: readonly MunicipalityRoute[] = [
  { code: "04", slug: "tbilisi" },
  { code: "06", slug: "batumi" },
  { code: "07", slug: "kobuleti" },
  { code: "08", slug: "khelvachauri" },
  { code: "09", slug: "keda" },
  { code: "10", slug: "shuakhevi" },
  { code: "11", slug: "khulo" },
  { code: "12", slug: "akhmeta" },
  { code: "13", slug: "gurjaani" },
  { code: "14", slug: "dedoplistskaro" },
  { code: "15", slug: "telavi" },
  { code: "16", slug: "lagodekhi" },
  { code: "17", slug: "sagarejo" },
  { code: "18", slug: "sighnaghi" },
  { code: "19", slug: "kvareli" },
  { code: "20", slug: "kutaisi" },
  { code: "21", slug: "chiatura" },
  { code: "22", slug: "tkibuli" },
  { code: "23", slug: "tskaltubo" },
  { code: "24", slug: "baghdati" },
  { code: "25", slug: "vani" },
  { code: "26", slug: "zestafoni" },
  { code: "27", slug: "terjola" },
  { code: "28", slug: "samtredia" },
  { code: "29", slug: "sachkhere" },
  { code: "30", slug: "kharagauli" },
  { code: "31", slug: "khoni" },
  { code: "32", slug: "poti" },
  { code: "33", slug: "zugdidi" },
  { code: "34", slug: "abasha" },
  { code: "35", slug: "martvili" },
  { code: "36", slug: "mestia" },
  { code: "37", slug: "senaki" },
  { code: "38", slug: "chkhorotsku" },
  { code: "39", slug: "tsalenjikha" },
  { code: "40", slug: "khobi" },
  { code: "41", slug: "gori" },
  { code: "44", slug: "kareli" },
  { code: "45", slug: "kaspi" },
  { code: "47", slug: "khashuri" },
  { code: "48", slug: "rustavi" },
  { code: "49", slug: "bolnisi" },
  { code: "50", slug: "gardabani" },
  { code: "51", slug: "dmanisi" },
  { code: "52", slug: "tetritskaro" },
  { code: "53", slug: "marneuli" },
  { code: "54", slug: "tsalka" },
  { code: "55", slug: "lanchkhuti" },
  { code: "56", slug: "ozurgeti" },
  { code: "57", slug: "chokhatauri" },
  { code: "58", slug: "borjomi" },
  { code: "59", slug: "adigeni" },
  { code: "60", slug: "aspindza" },
  { code: "61", slug: "akhalkalaki" },
  { code: "62", slug: "akhaltsikhe" },
  { code: "63", slug: "ninotsminda" },
  { code: "65", slug: "dusheti" },
  { code: "66", slug: "tianeti" },
  { code: "67", slug: "mtskheta" },
  { code: "68", slug: "kazbegi" },
  { code: "69", slug: "ambrolauri" },
  { code: "70", slug: "lentekhi" },
  { code: "71", slug: "oni" },
  { code: "72", slug: "tsageri" },
] as const;

const byCode = new Map(MUNICIPALITY_ROUTES.map((row) => [row.code, row.slug]));
const bySlug = new Map(MUNICIPALITY_ROUTES.map((row) => [row.slug, row.code]));

export function municipalitySlugForCode(code: string): string | null {
  return byCode.get(code) ?? null;
}

export function municipalityCodeForSlug(slug: string): string | null {
  return bySlug.get(slug) ?? null;
}

export function municipalityHrefForCode(code: string): `/explorer/municipalities/${string}` {
  const slug = municipalitySlugForCode(code);
  if (!slug) throw new Error(`Missing municipality route for code ${code}`);
  return `/explorer/municipalities/${slug}`;
}
