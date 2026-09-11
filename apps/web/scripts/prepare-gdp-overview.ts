import { writeGdpOverviewArtifacts } from "../lib/data/gdpOverview/prepareGdpOverview";
writeGdpOverviewArtifacts(process.argv.includes("--write"))
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
