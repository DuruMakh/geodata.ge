import { writeProductArtifacts } from "../lib/data/inflation/prepareProducts";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  const flags = (["--write", "--check"] as const).filter((flag) => args.includes(flag));
  if (flags.length !== 1) throw new Error("Pass exactly one of --write or --check");

  const report = await writeProductArtifacts(flags[0] === "--write" ? "write" : "check");
  console.log(JSON.stringify(report, null, 2));
}

runAsCli(import.meta.url, main);
