import type { EnglishCatalogue, Locale } from "../i18n/types";
import type { ValidatedSourceManifestRow } from "./sourceManifest";

export type PublicSourceManifestRow = Pick<ValidatedSourceManifestRow,
  "source_id" | "year" | "years" | "official_filename" | "media_type" | "byte_size" | "downloadHref"
> & {
  title: string;
  publisher: string;
  searchLabels: readonly string[];
  documentLanguage: "ka" | "en" | "mul" | null;
};

export function projectPublicSources(rows: readonly ValidatedSourceManifestRow[], locale: Locale, documents: EnglishCatalogue["documents"]): PublicSourceManifestRow[] {
  return rows.map(row => {
    const translated = documents[row.source_id];
    if (!translated) throw new Error(`Missing reviewed source document: ${row.source_id}`);
    return {
      source_id: row.source_id, year: row.year, years: row.years,
      official_filename: row.official_filename, media_type: row.media_type,
      byte_size: row.byte_size, downloadHref: row.downloadHref,
      title: locale === "en" ? translated.title.text : row.display_title_ka,
      publisher: locale === "en" ? translated.publisher.text : row.source_organization,
      searchLabels: [row.display_title_ka, translated.title.text, row.source_organization, translated.publisher.text],
      documentLanguage: translated.documentLanguage,
    };
  });
}
