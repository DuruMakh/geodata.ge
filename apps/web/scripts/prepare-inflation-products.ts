import { writeProductArtifacts } from "../lib/data/inflation/prepareProducts";

const flags = (["--write", "--check"] as const).filter((flag) => process.argv.includes(flag));
if (flags.length !== 1) throw new Error("Pass exactly one of --write or --check");

writeProductArtifacts(flags[0] === "--write" ? "write" : "check")
  .then((report) => console.log(JSON.stringify(report, null, 2)))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
