import path from "node:path";
import { prepareSocialData } from "../lib/data/social/prepareSocial";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-social.ts --write | --check");
  }
  await prepareSocialData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check");
  console.log(JSON.stringify({ status: "passed", scope: "social_protection_annual" }));
}

runAsCli(import.meta.url, main);
