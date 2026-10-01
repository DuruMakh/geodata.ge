import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach } from "vitest";

export const repositoryRoot = path.resolve(process.cwd(), "../..");
export const VINTAGE_DIR = "docs/Raw Data/Demography/geostat-demography/2026-10";
const MUNICIPAL_TABLE_01 =
  "docs/Raw Data/Municipalities/geostat-population-regional-gdp/official/01-population-by-self-governed-unit.xlsx";

const created: string[] = [];

/** Removes every throwaway repository root a test created. Call once at the top of a describe. */
export function cleanUpTempRoots() {
  afterEach(async () => {
    await Promise.all(created.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });
}

/** A throwaway repository root holding only the demography package and the reused table 01. */
export async function copyDemographyPackage(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "demography-"));
  created.push(root);
  await cp(path.join(repositoryRoot, "docs/Raw Data/Demography"), path.join(root, "docs/Raw Data/Demography"), {
    recursive: true,
  });
  await mkdir(path.dirname(path.join(root, MUNICIPAL_TABLE_01)), { recursive: true });
  await cp(path.join(repositoryRoot, MUNICIPAL_TABLE_01), path.join(root, MUNICIPAL_TABLE_01));
  return root;
}
