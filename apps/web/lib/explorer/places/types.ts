import type { Locale } from "../../i18n/types";

// The place index (spec 2026-10-24-explorer-regroup §8): Georgia's 11 regions and 63 other municipalities, and every
// place page with the latest figure its line states. Search (its place card and rows), the group pages' region spread and
// the prerendered `explorer-places.{ka,en}.json` read it.

/** One of a place card's four figures, formatted in the page's language, with its year. */
export type PlaceFact = { label: "population" | "budget" | "perResident" | "birthsPer100Deaths"; value: string; period: string };

export type Place = {
  /** `region.{id}` (Tbilisi is `region.tbilisi`) or a municipality's two-digit code. */
  id: string;
  kind: "region" | "municipality";
  nameKa: string;
  nameEn: string;
  /** Other spellings search also knows the place by (`Zestaponi`, `Ajara`, `Stepantsminda`). */
  aliases?: string[];
  /** A municipality's region; a region's own id. */
  regionId: string;
  /** Tbilisi: a region, the capital, whose one municipality is itself. */
  capital: boolean;
  /** Regions other than the capital: how many municipalities they hold. */
  municipalityCount?: number;
  facts: PlaceFact[];
};

/** A place's page under one of the navigation's pages, with the latest figure its line states whatever range a reader picks. */
export type PlaceEntry = {
  /** A place id, or `country.georgia`. */
  placeId: string;
  /** The navigation page (a `NavSection` href) the place page sits under. */
  page: string;
  /** The place's own page, or the page's section for the place where it has no page of its own. */
  href: string;
  value: string;
  /** The figure unformatted, for comparing places. */
  number: number;
  /** The figure's period as the page writes it (`2025`, `2025/26`, `სექ 2026`). */
  period: string;
  /** What the figure counts, where the page's name does not say (`Births` on Births and deaths), as the page's card captions it. */
  caption?: string;
};

export type PlaceIndex = { places: Place[]; entries: PlaceEntry[] };

/** A place entry's adapter: one page family's entries in one language. */
export type PlaceAdapter = (locale: Locale) => Promise<PlaceEntry[]>;
