import path from "node:path";
import { readFile } from "node:fs/promises";
import { getMethodologyContent, LIVE_METHODOLOGY_IDS } from "../methodology/catalog";
import { METHODOLOGY_TRANSLATION_REVIEWED_AT } from "../methodology/content/en/revisions";
import { validateMethodologyTranslation } from "./methodology";
import { loadEnglishCatalogue } from "./catalogue.server";
import { loadTranslationInventory } from "./inventory.server";
import { getMessages } from "./messages.server";
import { MESSAGE_SCOPES } from "./types";
import { serviceMessagesSchema, validateCatalogue, validateMessages, validateServiceMessages, validatePageRevisions } from "./validation";
import { loadPageRevisions } from "./page-revisions.server";

export async function checkLocalization(): Promise<{ errors: string[]; routeCount: number; labelCount: number }> {
  const [catalogue, inventory] = await Promise.all([
    loadEnglishCatalogue(path.resolve(process.cwd(), "../..")), loadTranslationInventory(),
  ]);
  const errors = validateCatalogue(catalogue, inventory);
  errors.push(...validatePageRevisions(await loadPageRevisions(), inventory.pagePaths));
  const [serviceKa, serviceEn] = await Promise.all(["ka", "en"].map(async locale =>
    serviceMessagesSchema.parse(JSON.parse(await readFile(path.resolve(process.cwd(), `../../data/localization/${locale}/service-messages.json`), "utf8"))),
  ));
  errors.push(...validateServiceMessages(serviceKa, serviceEn));
  for (const id of LIVE_METHODOLOGY_IDS) {
    errors.push(...validateMethodologyTranslation(getMethodologyContent(id, "ka"), getMethodologyContent(id, "en"), METHODOLOGY_TRANSLATION_REVIEWED_AT[id]));
  }
  for (const scope of MESSAGE_SCOPES) {
    const [ka, en] = await Promise.all([getMessages("ka", [scope]), getMessages("en", [scope])]);
    errors.push(...validateMessages(ka, en).map((error) => `${scope}: ${error}`));
  }
  return { errors, routeCount: inventory.pagePaths.length, labelCount: inventory.labelIds.length };
}
