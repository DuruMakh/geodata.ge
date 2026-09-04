import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";

const missionCopy = [
  "საქართველოში ეკონომიკის, სახელმწიფო ფინანსების, რეგიონების, ვაჭრობის, ბიზნესისა და სხვა მნიშვნელოვანი მიმართულებების შესახებ დიდი რაოდენობით საჯარო მონაცემები არსებობს. თუმცა ეს ინფორმაცია სხვადასხვა უწყების ვებგვერდებზე, ექსელის ფაილებში, ანგარიშებსა და რთულ ცხრილებშია გაფანტული. ხშირად ერთი მარტივი პასუხის მისაღებადაც კი საჭიროა რამდენიმე წყაროს მოძიება, მონაცემების ჩამოტვირთვა, დამუშავება და ერთმანეთთან შედარება.",
  "პრობლემა მხოლოდ ინფორმაციის მოძიება არ არის. არსებული მონაცემები ხშირად წარმოდგენილია ისეთი ფორმით, რომელიც სპეციალური ცოდნის გარეშე რთულად გასაგებია. ასევე რთულია სხვადასხვა წლის მონაცემების, სხვადასხვა რეგიონისა თუ ეკონომიკური მაჩვენებლების ერთმანეთთან შედარება და საერთო სურათის დანახვა. შედეგად, საჯაროდ ხელმისაწვდომი მონაცემების მნიშვნელოვანი ნაწილი პრაქტიკაში მხოლოდ ადამიანთა მცირე წრისთვის არის მარტივად გამოსაყენებელი.",
  "fiscal.ge სწორედ ამ პრობლემის გადასაჭრელად შეიქმნა. ჩვენი მიზანია საქართველოს შესახებ საჯაროდ ხელმისაწვდომი ეკონომიკური და ფინანსური მონაცემების დიდი ნაწილი ერთ სივრცეში მოვაქციოთ, დავალაგოთ, ერთმანეთთან დავაკავშიროთ და მარტივი, ვიზუალურად გასაგები ფორმით წარმოვადგინოთ.",
  "გვინდა, მომხმარებელს რამდენიმე საათის ძიების ნაცვლად, რამდენიმე წამში შეეძლოს საჭირო მონაცემის პოვნა, მისი შედარება და კონტექსტის დანახვა. ჩვენი მიზანია, საქართველოს მონაცემები იყოს არა მხოლოდ საჯარო, არამედ რეალურად ხელმისაწვდომი, გასაგები და გამოყენებადი.",
] as const;

async function expectNoPageOverflow(page: Page) {
  const { clientWidth, scrollWidth } = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

for (const viewport of [
  { width: 320, height: 844 },
  { width: 390, height: 844 },
  { width: 767, height: 900 },
  { width: 768, height: 900 },
  { width: 1366, height: 768 },
] as const) {
  test(`/about locks the approved mission contract at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(`${BASE_URL}/about`);

    await expect(page).toHaveTitle("მიზანი — Fiscal.ge");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("მიზანი");
    await expect(page.getByTestId("mission-copy").locator("p")).toHaveCount(4);
    for (const [index, copy] of missionCopy.entries()) {
      await expect(page.getByTestId("mission-copy").locator("p").nth(index)).toHaveText(copy);
    }
    await expect(page.getByTestId("mission-copy").locator("h2")).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveCount(0);
    await expect(page.getByTestId("breadcrumb-json-ld")).toHaveCount(0);
    await expect(page.getByText("ჩვენი მიზანი / ტექსტი", { exact: true })).toHaveCount(0);
    await expect(page.getByText("საჯარო მონაცემი უნდა მუშაობდეს ადამიანისთვის.", { exact: true })).toHaveCount(0);
    await expect(page.getByText("გამოყენებადი", { exact: false })).toHaveCount(1);

    const header = page.getByTestId("about-header");
    await expect(header.getByRole("link", { name: "მთავარი", exact: true })).toHaveAttribute("href", "/");
    await expect(header.getByRole("link", { name: "მონაცემები", exact: true })).toHaveAttribute("href", "/explorer");
    await expect(header.getByRole("link", { name: "მიზანი", exact: true })).toHaveAttribute("href", "/about");
    await expect(header.getByRole("link", { name: "მიზანი", exact: true })).toHaveAttribute("aria-current", "page");

    const footer = page.getByTestId("site-footer");
    await expect(footer.getByRole("link", { name: "მიზანი", exact: true })).toHaveCount(1);
    await expect(footer.getByRole("link", { name: "მიზანი", exact: true })).toHaveAttribute("href", "/about");
    await expect(footer.locator('a[href="/about"]')).toHaveCount(1);

    const closingStyles = await page.getByTestId("mission-closing").evaluate((element, finalSentence) => {
      const strong = [...element.querySelectorAll("strong")].find(
        (candidate) => candidate.textContent?.trim() === finalSentence,
      )!;
      const parent = getComputedStyle(element);
      const final = getComputedStyle(strong);
      return {
        parentTopBorder: parent.borderTopWidth,
        parentLeftBorder: parent.borderLeftWidth,
        finalLeftBorder: final.borderLeftWidth,
        finalLeftBorderColor: final.borderLeftColor,
      };
    }, "ჩვენი მიზანია, საქართველოს მონაცემები იყოს არა მხოლოდ საჯარო, არამედ რეალურად ხელმისაწვდომი, გასაგები და გამოყენებადი.");

    expect(closingStyles).toEqual({
      parentTopBorder: "0px",
      parentLeftBorder: "0px",
      finalLeftBorder: "4px",
      finalLeftBorderColor: "rgb(179, 64, 42)",
    });

    if (viewport.width === 767 || viewport.width === 768) {
      await expectNoPageOverflow(page);

      const gridColumns = await page.getByTestId("mission-cover").evaluate((element) =>
        getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/),
      );
      expect(gridColumns).toHaveLength(viewport.width === 767 ? 1 : 3);
    }

    if (viewport.width === 320 || viewport.width === 390) {
      await expectNoPageOverflow(page);

      const cover = page.getByTestId("mission-cover");
      const copy = page.getByTestId("mission-copy");
      const main = page.locator("main");
      await expect(cover).toBeVisible();
      const footerBox = await footer.boundingBox();
      const coverBox = await cover.boundingBox();
      const copyBox = await copy.boundingBox();
      const mainBox = await main.boundingBox();

      expect(coverBox).not.toBeNull();
      expect(copyBox).not.toBeNull();
      expect(mainBox).not.toBeNull();
      expect(footerBox).not.toBeNull();
      expect(coverBox!.x).toBeGreaterThanOrEqual(0);
      expect(coverBox!.width).toBeLessThanOrEqual(viewport.width);
      expect(coverBox!.x + coverBox!.width).toBeLessThanOrEqual(viewport.width);
      expect(coverBox!.y).toBeLessThan(copyBox!.y);
      expect(footerBox!.y).toBeGreaterThanOrEqual(mainBox!.y + mainBox!.height);
    }
  });
}
