import { checkLocalization } from "../lib/i18n/check.server";
import { loadTranslationInventory } from "../lib/i18n/inventory.server";

async function main() {
  const inventoryOnly = process.argv.includes("--inventory");
  const check = process.argv.includes("--check");
  if (inventoryOnly === check) throw new Error("Pass exactly one of --check or --inventory");
  if (inventoryOnly) {
    console.log(JSON.stringify(await loadTranslationInventory(), null, 2));
    return;
  }
  const result = await checkLocalization();
  if (result.errors.length > 0) throw new Error(result.errors.join("\n"));
  console.log(`Translation catalogue and registered messages valid: ${result.labelCount} labels; ${result.routeCount} public page identities. Page-body completion is checked separately.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
