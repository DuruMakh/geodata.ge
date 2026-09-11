import { writeInflationArtifacts, type InflationArtifactMode } from "../lib/data/inflation/prepareInflation";

const modes = (["--write", "--check", "--public", "--check-public"] as const).filter((flag) => process.argv.includes(flag));
if (modes.length !== 1) throw new Error("Pass exactly one of --write, --check, --public or --check-public");
const mode = modes[0].slice(2) as InflationArtifactMode;

writeInflationArtifacts(mode)
  .then((validation) => console.log(validation ? JSON.stringify(validation, null, 2) : `Inflation public CSV ${mode === "public" ? "written" : "matches"}`))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
