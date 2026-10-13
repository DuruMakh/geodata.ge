import { pathToFileURL } from "node:url";
import { writeProductArtifacts } from "../lib/data/inflation/prepareProducts";

export async function main(args: readonly string[]) {
  const flags = (["--write", "--check"] as const).filter((flag) => args.includes(flag));
  if (flags.length !== 1) throw new Error("Pass exactly one of --write or --check");

  const report = await writeProductArtifacts(flags[0] === "--write" ? "write" : "check");
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
