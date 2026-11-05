// Next.js ships its own copy of path-to-regexp (v6) without types; scripts/serve-static.ts uses it to match
// vercel.json route sources the way Next and Vercel do.
declare module "next/dist/compiled/path-to-regexp" {
  export function pathToRegexp(path: string, keys?: unknown[], options?: { sensitive?: boolean }): RegExp;
}
