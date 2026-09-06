import { readFile } from "node:fs/promises";
import path from "node:path";
import { englishCatalogueSchema } from "./validation";
import type { EnglishCatalogue } from "./types";

export async function loadEnglishCatalogue(repositoryRoot: string): Promise<EnglishCatalogue> {
  const directory = path.join(repositoryRoot, "data", "localization", "en");
  const files = { labels: "labels.json", programmeHistory: "programme-history.json", sources: "sources.json", documents: "documents.json" } as const;
  const entries = await Promise.all(Object.entries(files).map(async ([key, file]) => [key, JSON.parse(await readFile(path.join(directory, file), "utf8")) as unknown]));
  return englishCatalogueSchema.parse(Object.fromEntries(entries));
}
