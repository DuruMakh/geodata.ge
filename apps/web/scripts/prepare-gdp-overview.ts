import { writeGdpOverviewArtifacts } from "../lib/data/gdpOverview/prepareGdpOverview";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  const result = await writeGdpOverviewArtifacts(args.includes("--write"));
  console.log(JSON.stringify(result, null, 2));
}

runAsCli(import.meta.url, main);
