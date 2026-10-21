import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The command-line entry of a script under scripts/: runs `main` with the command's arguments when the calling module
 * is the file node was started with, and does nothing when another module imports it (scripts/validate-all.ts runs
 * the data checks that way, and tests import their helpers). Both sides are compared as real paths, so a script
 * started through a symlink, a junction or a differently cased drive letter still runs. When the started path does
 * not resolve to a file (given without its extension, say) it throws instead of guessing: a check that quietly does
 * nothing would exit 0 and pass.
 */
export function runAsCli(moduleUrl: string, main: (args: readonly string[]) => Promise<unknown>): void {
  const entry = process.argv[1];
  if (!entry) return;
  const modulePath = realpathSync.native(fileURLToPath(moduleUrl));
  let entryPath: string;
  try {
    entryPath = realpathSync.native(entry);
  } catch {
    throw new Error(`Cannot tell whether ${modulePath} is the script being run: ${entry} is not a file. Run it by its full file name.`);
  }
  if (entryPath !== modulePath) return;
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
