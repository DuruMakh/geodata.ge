import path from "node:path";
import { loadEnglishCatalogue } from "./catalogue.server";
import { loadTranslationInventory } from "./inventory.server";
import { getMessages } from "./messages.server";
import { MESSAGE_SCOPES } from "./types";
import { validateCatalogue, validateMessages } from "./validation";

export async function checkLocalization(): Promise<{ errors: string[]; routeCount: number; labelCount: number }> {
  const [catalogue, inventory] = await Promise.all([
    loadEnglishCatalogue(path.resolve(process.cwd(), "../..")), loadTranslationInventory(),
  ]);
  const errors = validateCatalogue(catalogue, inventory);
  for (const scope of MESSAGE_SCOPES) {
    const [ka, en] = await Promise.all([getMessages("ka", [scope]), getMessages("en", [scope])]);
    errors.push(...validateMessages(ka, en).map((error) => `${scope}: ${error}`));
  }
  return { errors, routeCount: inventory.pagePaths.length, labelCount: inventory.labelIds.length };
}
