import path from "node:path";
import { pathToFileURL } from "node:url";
import { prepareTradeDomesticData } from "../lib/data/tradeDomestic/prepareTradeDomestic";

export async function main(args: readonly string[]) {
  const mode = args.includes("--write") ? "write" : "check";
  await prepareTradeDomesticData(path.resolve(process.cwd(), "../.."), mode);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
