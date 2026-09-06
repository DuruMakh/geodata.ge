import { readFile } from "node:fs/promises";
import path from "node:path";
import { pageRevisionsSchema } from "./validation";

export async function loadPageRevisions(): Promise<Record<string, string>> {
  return pageRevisionsSchema.parse(JSON.parse(await readFile(path.resolve(process.cwd(), "../../data/localization/en/page-revisions.json"), "utf8")));
}
