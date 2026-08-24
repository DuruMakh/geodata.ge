import fs from "node:fs/promises";
import path from "node:path";

const REPO_ROOT = path.resolve(process.cwd(), "../..");

// Fails when a committed generated artifact no longer matches what its generator
// produces. `label` names the dataset: importing a caller-specific message would
// report a stale Geostat file as a stale national GDP file, and a wrong
// diagnostic costs more than a duplicated one.
export async function assertGeneratedArtifactMatches(
  label: string,
  filePath: string,
  expectedContent: string,
): Promise<void> {
  const actualContent = await fs.readFile(filePath, "utf8");
  if (actualContent !== expectedContent) {
    throw new Error(`Generated ${label} artifact is stale: ${path.relative(REPO_ROOT, filePath)}`);
  }
}
