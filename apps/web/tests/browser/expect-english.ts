import { expect, type Page } from "@playwright/test";

/** No Georgian script in the page's visible text or in its aria-label, title and svg <title> descriptions (the language switch excepted). */
export async function expectEnglish(page: Page) {
  expect((await page.locator("body").innerText()).replaceAll("ქართული", "")).not.toMatch(/\p{Script=Georgian}/u);
  const descriptions = await page.locator("[aria-label], [title], svg title").evaluateAll(elements => elements.flatMap(element => [element.getAttribute("aria-label") ?? "", element.getAttribute("title") ?? "", element.tagName.toLowerCase() === "title" ? element.textContent ?? "" : ""]));
  expect(descriptions.filter(text => text !== "ქართული").join(" ")).not.toMatch(/\p{Script=Georgian}/u);
}
