import { pathToFileURL } from "node:url";
import { writeGdpOverviewArtifacts } from "../lib/data/gdpOverview/prepareGdpOverview";

export async function main(args: readonly string[]) {
  const result = await writeGdpOverviewArtifacts(args.includes("--write"));
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
