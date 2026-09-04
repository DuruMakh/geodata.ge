import { expect, type Locator } from "@playwright/test";
import { computedCssColorAlpha } from "./focus-outline";

function luminance(color: string): number {
  const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (channels?.length !== 3) throw new Error(`Expected RGB color: ${color}`);
  const [r, g, b] = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export async function expectReadableText(text: Locator, surface: Locator) {
  await expect(text).toBeVisible();
  const [foreground, background] = await Promise.all([
    text.evaluate((element) => getComputedStyle(element).color),
    surface.evaluate((element) => getComputedStyle(element).backgroundColor),
  ]);
  // These checks use opaque surfaces; transparent backgrounds need compositing.
  expect(computedCssColorAlpha(foreground)).toBe(1);
  expect(computedCssColorAlpha(background)).toBe(1);
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  expect((lighter + 0.05) / (darker + 0.05), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
}
