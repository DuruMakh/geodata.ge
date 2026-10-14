import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// A <Link> without `prefetch` makes Next fetch its page's data as soon as it scrolls
// into view, so a sidebar or a long list downloads half the site in the background.
// Every Link sets it; only these calls-to-action keep prefetching on purpose.
const PREFETCHING_CTAS = ['data-testid="hero-cta"', 'data-testid="mission-explore"'];

/** Each `<name …>` opening tag, read up to the `>` outside any `{…}` expression. */
function openingTags(source: string, name: string): string[] {
  const tags: string[] = [];
  for (const match of source.matchAll(new RegExp(`<${name}\\b`, "g"))) {
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

const linkTags = (source: string) => openingTags(source, "Link");

/** The source without comments, so a comment that mentions Link is not read as code. */
const withoutComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");

/** `Link` used as a value rather than as a `<Link` / `</Link` tag or a longer name. */
const BARE_LINK = /(?<![<\/\w.])\bLink\b/;

/**
 * Names a file gives Link, as `const Anchor = plainAnchors ? "a" : Link` does, with each declaration.
 * Their tags are checked like `<Link …>` tags.
 */
function linkAliases(code: string): { name: string; declaration: string }[] {
  return [...code.matchAll(/\b(?:const|let|var)\s+([A-Z]\w*)\s*=[^;]*;/g)]
    .filter((match) => BARE_LINK.test(match[0].slice(match[0].indexOf("="))))
    .map((match) => ({ name: match[1], declaration: match[0] }));
}

/**
 * A tag sets prefetch when it names the prop, or spreads a props object declared in the same file
 * with `prefetch: false` (`<Anchor {...linkProps}>`, where `linkProps` is `{ prefetch: false }` for Link).
 */
function setsPrefetch(tag: string, code: string): boolean {
  if (/\bprefetch\b/.test(tag)) return true;
  return [...tag.matchAll(/\{\s*\.\.\.\s*(\w+)\s*\}/g)].some(([, name]) =>
    new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*=[^;]*\\bprefetch:\\s*false\\b[^;]*;`).test(code),
  );
}

describe("Link prefetch guard", () => {
  it("every next/link Link in the app, components and page modules sets prefetch", () => {
    const files = ["app", "components", "lib/pages"].flatMap((dir) => {
      const root = resolve(process.cwd(), dir);
      return (readdirSync(root, { recursive: true }) as string[])
        .filter((file) => file.endsWith(".tsx"))
        .map((file) => [`${dir}/${file.replaceAll("\\", "/")}`, readFileSync(resolve(root, file), "utf8")] as const)
        .filter(([, source]) => /from "next\/link"/.test(source));
    });
    expect(files.length).toBeGreaterThan(30);

    const missing = files.flatMap(([file, source]) => {
      const code = withoutComments(source);
      const aliases = linkAliases(code);
      // Link passed on any other way (`component={Link}`, `{ Link }`) hides its tags from this guard.
      const rest = aliases.reduce((remaining, alias) => remaining.replace(alias.declaration, ""), code).replace(/^import Link from "next\/link";$/m, "");
      const unfollowed = [
        ...(BARE_LINK.test(rest) ? [`${file}: Link is passed on in a way this guard cannot follow`] : []),
        ...(/^import Link from "next\/link";$/m.test(code) ? [] : [`${file}: import next/link as Link`]),
      ];
      return [
        ...unfollowed,
        ...["Link", ...aliases.map((alias) => alias.name)]
          .flatMap((name) => openingTags(code, name))
          // A same-page hash link counts too: Next prefetches the current route for it.
          .filter((tag) => !setsPrefetch(tag, code) && !PREFETCHING_CTAS.some((cta) => tag.includes(cta)))
          .map((tag) => `${file}: ${tag.replace(/\s+/g, " ").slice(0, 120)}`),
      ];
    });
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
