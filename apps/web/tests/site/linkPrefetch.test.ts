import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// A <Link> without `prefetch` makes Next fetch its page's data as soon as it scrolls
// into view, so a sidebar or a long list downloads half the site in the background.
// Every Link sets it; only these calls-to-action keep prefetching on purpose.
const PREFETCHING_CTAS = ['data-testid="hero-cta"', 'data-testid="mission-explore"'];

/** Each `<Link …>` opening tag, read up to the `>` outside any `{…}` expression. */
function linkTags(source: string): string[] {
  const tags: string[] = [];
  for (const match of source.matchAll(/<Link\b/g)) {
    let depth = 0;
    let end = match.index + match[0].length;
    for (; end < source.length; end += 1) {
      const char = source[end];
      if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
      else if (char === ">" && depth === 0) break;
    }
    tags.push(source.slice(match.index, end + 1));
  }
  return tags;
}

describe("Link prefetch guard", () => {
  it("every next/link Link in components and page modules sets prefetch", () => {
    const files = ["components", "lib/pages"].flatMap((dir) => {
      const root = resolve(process.cwd(), dir);
      return (readdirSync(root, { recursive: true }) as string[])
        .filter((file) => file.endsWith(".tsx"))
        .map((file) => [`${dir}/${file.replaceAll("\\", "/")}`, readFileSync(resolve(root, file), "utf8")] as const)
        .filter(([, source]) => /from "next\/link"/.test(source));
    });
    expect(files.length).toBeGreaterThan(30);

    const missing = files.flatMap(([file, source]) =>
      linkTags(source)
        // A same-page hash link counts too: Next prefetches the current route for it.
        .filter((tag) => !/\bprefetch\b/.test(tag) && !PREFETCHING_CTAS.some((cta) => tag.includes(cta)))
        .map((tag) => `${file}: ${tag.replace(/\s+/g, " ").slice(0, 120)}`),
    );
    expect(missing).toEqual([]);
  });

  it("still finds the allowed calls-to-action, so the allowlist cannot go stale", () => {
    const sources = ["components/landing/landing-page.tsx", "lib/pages/about.tsx"].map((file) => readFileSync(resolve(process.cwd(), file), "utf8"));
    for (const cta of PREFETCHING_CTAS) {
      const tag = sources.flatMap(linkTags).find((candidate) => candidate.includes(cta));
      expect(tag, cta).toBeDefined();
      expect(tag, cta).not.toMatch(/\bprefetch\b/);
    }
  });
});
