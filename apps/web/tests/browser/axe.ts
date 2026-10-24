import path from "node:path";
import type { Page } from "@playwright/test";

// axe-core, pinned in package.json, run in the page; the rules are WCAG 2.0 and 2.1, levels A and AA.
const AXE = path.join(process.cwd(), "node_modules/axe-core/axe.min.js");
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** The page's WCAG 2.1 A and AA violations, as "rule: targets", leaving out the `exclude` selectors. */
export async function axeViolations(page: Page, exclude: string[] = []): Promise<string[]> {
  await page.addScriptTag({ path: AXE });
  return page.evaluate(async ({ tags, exclude }) => {
    const { axe } = window as unknown as { axe: { run: (context: unknown, options: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } };
    const result = await axe.run({ exclude: exclude.map(selector => [selector]) }, { runOnly: { type: "tag", values: tags } });
    return result.violations.map(violation => `${violation.id}: ${violation.nodes.map(node => node.target.join(" ")).join(", ")}`);
  }, { tags: WCAG_AA, exclude });
}
