import path from "node:path";
import { prepareTransportData } from "../lib/data/transport/prepareTransport";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-transport.ts --write | --check");
  }
  await prepareTransportData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check");
  console.log(JSON.stringify({ status: "passed", scope: "transport_annual" }));
}

runAsCli(import.meta.url, main);
