import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const landingSource = readFileSync(resolve(process.cwd(), "components/landing/landing-page.tsx"), "utf8");
const globalStyles = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

describe("landing hero font loading", () => {
  it("keeps the hero font rule in global CSS instead of a route stylesheet", () => {
    expect(landingSource).not.toContain('from "next/font/local"');
    expect(landingSource).not.toContain("heroDisplay.className");
    expect(globalStyles).toContain("EurostileGEOMt-Demi.ttf");
    expect(globalStyles).toContain(".hero-display");
  });
});
