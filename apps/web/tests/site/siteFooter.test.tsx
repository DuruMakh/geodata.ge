import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SiteFooterView } from "../../components/site/site-footer-view";
import { message } from "../../lib/i18n/messages";
import { getMessages } from "../../lib/i18n/messages.server";
import { DATASET_HUBS } from "../../lib/navigation/datasetHubs";
import { pageHref } from "../../lib/i18n/routes";

describe("site footer variants", () => {
  it("default variant renders today's markup", async () => {
    const html = renderToStaticMarkup(<SiteFooterView locale="ka" messages={await getMessages("ka", ["common"])} updatedAt="2026-10-20" year={2026} />);
    expect(html).toMatchInlineSnapshot(`"<footer data-testid="site-footer" class="mt-10 border-t-2 border-[var(--ink)] pb-5 pt-5 min-[768px]:mt-[72px] min-[768px]:pb-10 min-[768px]:pt-[26px]"><div data-testid="landing-footer"><div class="flex flex-col gap-4 min-[768px]:grid min-[768px]:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] min-[768px]:gap-9"><div class="grid grid-cols-[150px_minmax(0,1fr)] items-center gap-x-4 gap-y-2 min-[768px]:flex min-[768px]:flex-col min-[768px]:items-stretch min-[768px]:gap-2.5"><a aria-label="Fiscal.ge — მთავარი" class="block w-[150px]" href="/"><img data-testid="site-footer-logo" src="/brand/fiscal-logo-compact.svg" width="1080" height="340" loading="lazy" alt="" class="block h-auto w-full"/></a><a href="mailto:info@fiscal.ge" class="max-[768px]:col-start-2 max-[768px]:row-start-1 max-[768px]:inline-flex max-[768px]:min-h-11 max-[768px]:items-center max-[768px]:justify-self-end font-[family-name:var(--font-numeric)] text-[0.6875rem] text-[var(--accent)] underline underline-offset-[3px] min-[768px]:self-start">info@fiscal.ge</a></div><div class="flex flex-col gap-[9px]"><span class="hidden text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)] min-[768px]:block">ნავიგაცია</span><ul class="grid list-none grid-cols-2 gap-x-4 min-[768px]:flex min-[768px]:flex-col min-[768px]:gap-[9px]"><li><a class="flex min-h-11 items-center text-[0.78125rem] text-[var(--body)] hover:text-[var(--ink)] min-[768px]:inline min-[768px]:min-h-0" href="/explorer">ბიუჯეტი</a></li><li><a class="flex min-h-11 items-center text-[0.78125rem] text-[var(--body)] hover:text-[var(--ink)] min-[768px]:inline min-[768px]:min-h-0" href="/explorer/economy">ეკონომიკა</a></li><li><a class="flex min-h-11 items-center text-[0.78125rem] text-[var(--body)] hover:text-[var(--ink)] min-[768px]:inline min-[768px]:min-h-0" href="/explorer/business">ბიზნესი</a></li><li><a class="flex min-h-11 items-center text-[0.78125rem] text-[var(--body)] hover:text-[var(--ink)] min-[768px]:inline min-[768px]:min-h-0" href="/explorer/housing">საცხოვრებელი და მშენებლობა</a></li><li><a class="flex min-h-11 items-center text-[0.78125rem] text-[var(--body)] hover:text-[var(--ink)] min-[768px]:inline min-[768px]:min-h-0" href="/explorer/inflation">ინფლაცია</a></li><li><a class="flex min-h-11 items-center text-[0.78125rem] text-[var(--body)] hover:text-[var(--ink)] min-[768px]:inline min-[768px]:min-h-0" href="/explorer/money">ფული და ბანკები</a></li><li><a class="flex min-h-11 items-center text-[0.78125rem] text-[var(--body)] hover:text-[var(--ink)] min-[768px]:inline min-[768px]:min-h-0" href="/explorer/unemployment">უმუშევრობა</a></li><li><a class="flex min-h-11 items-center text-[0.78125rem] text-[var(--body)] hover:text-[var(--ink)] min-[768px]:inline min-[768px]:min-h-0" href="/explorer/wages">ხელფასები</a></li><li><a class="flex min-h-11 items-center text-[0.78125rem] text-[var(--body)] hover:text-[var(--ink)] min-[768px]:inline min-[768px]:min-h-0" href="/explorer/living-standards">ცხოვრების დონე</a></li><li><a class="flex min-h-11 items-center text-[0.78125rem] text-[var(--body)] hover:text-[var(--ink)] min-[768px]:inline min-[768px]:min-h-0" href="/explorer/health">ჯანდაცვა და სოციალური დაცვა</a></li><li><a class="flex min-h-11 items-center text-[0.78125rem] text-[var(--body)] hover:text-[var(--ink)] min-[768px]:inline min-[768px]:min-h-0" href="/explorer/education">განათლება</a></li><li><a class="flex min-h-11 items-center text-[0.78125rem] text-[var(--body)] hover:text-[var(--ink)] min-[768px]:inline min-[768px]:min-h-0" href="/explorer/science-culture">მეცნიერება და კულტურა</a></li><li><a class="flex min-h-11 items-center text-[0.78125rem] text-[var(--body)] hover:text-[var(--ink)] min-[768px]:inline min-[768px]:min-h-0" href="/explorer/crime">დანაშაული და მართლმსაჯულება</a></li><li><a class="flex min-h-11 items-center text-[0.78125rem] text-[var(--body)] hover:text-[var(--ink)] min-[768px]:inline min-[768px]:min-h-0" href="/explorer/internet">ინტერნეტი და ტექნოლოგიები</a></li><li><a class="flex min-h-11 items-center text-[0.78125rem] text-[var(--body)] hover:text-[var(--ink)] min-[768px]:inline min-[768px]:min-h-0" href="/explorer/trade">საგარეო ვაჭრობა</a></li><li><a class="flex min-h-11 items-center text-[0.78125rem] text-[var(--body)] hover:text-[var(--ink)] min-[768px]:inline min-[768px]:min-h-0" href="/explorer/external">საგარეო ნაკადები</a></li><li><a class="flex min-h-11 items-center text-[0.78125rem] text-[var(--body)] hover:text-[var(--ink)] min-[768px]:inline min-[768px]:min-h-0" href="/explorer/energy-food">ენერგეტიკა და სურსათი</a></li><li><a class="flex min-h-11 items-center text-[0.78125rem] text-[var(--body)] hover:text-[var(--ink)] min-[768px]:inline min-[768px]:min-h-0" href="/explorer/environment">გარემო და კლიმატი</a></li><li><a class="flex min-h-11 items-center text-[0.78125rem] text-[var(--body)] hover:text-[var(--ink)] min-[768px]:inline min-[768px]:min-h-0" href="/explorer/transport">ტრანსპორტი</a></li><li><a class="flex min-h-11 items-center text-[0.78125rem] text-[var(--body)] hover:text-[var(--ink)] min-[768px]:inline min-[768px]:min-h-0" href="/explorer/demography">დემოგრაფია</a></li><li><a class="flex min-h-11 items-center text-[0.78125rem] text-[var(--body)] hover:text-[var(--ink)] min-[768px]:inline min-[768px]:min-h-0" href="/methodology">მეთოდოლოგია</a></li><li><a class="flex min-h-11 items-center text-[0.78125rem] text-[var(--body)] hover:text-[var(--ink)] min-[768px]:inline min-[768px]:min-h-0" href="/connect">AI-კავშირი</a></li><li><a class="flex min-h-11 items-center text-[0.78125rem] text-[var(--body)] hover:text-[var(--ink)] min-[768px]:inline min-[768px]:min-h-0" href="/about">მიზანი</a></li></ul></div><p class="text-pretty text-[0.75rem] leading-relaxed text-[var(--muted)] min-[768px]:max-w-[340px]">მონაცემები: გადამოწმებული ოფიციალური წყაროები. წყაროს ბოლო გადამოწმება Fiscal.ge-ზე: <span class="font-[family-name:var(--font-numeric)]">2026-10-20</span>. მონაცემები ქვეყნდება CC BY 4.0 ლიცენზიით — მიუთითე წყარო და გამოიყენე თავისუფლად.</p></div><div class="mt-3 flex flex-wrap justify-between gap-4 border-t border-[var(--hairline-soft)] pt-2.5 min-[768px]:mt-[30px] min-[768px]:pt-3.5"><span class="font-[family-name:var(--font-numeric)] text-[0.6875rem] min-[768px]:text-[10.5px] text-[var(--faint)]">© 2026 Fiscal.ge</span><span class="font-[family-name:var(--font-numeric)] text-[0.6875rem] min-[768px]:text-[10.5px] text-[var(--faint)]">CC BY 4.0</span></div></div></footer>"`);
  });

  describe.each(["ka", "en"] as const)("site variant in %s", (locale) => {
    const other = locale === "ka" ? "en" : "ka";
    const render = async () => {
      const messages = await getMessages(locale, ["common"]);
      const html = renderToStaticMarkup(<SiteFooterView variant="site" path="/about" locale={locale} messages={messages} updatedAt="2026-10-20" year={2026} />);
      return { html, messages };
    };
    const list = (html: string, label: string) => html.match(new RegExp(`<nav[^>]*aria-label="${label}"[\\s\\S]*?</nav>`))?.[0] ?? "";
    const hrefs = (markup: string) => [...markup.matchAll(/<a [^>]*href="([^"]*)"/g)].map((match) => match[1]);

    it("shows the mission sentence and a mailto address", async () => {
      const { html, messages } = await render();
      expect(html).toContain(message(messages, "common.footerMission"));
      expect(html).toContain('href="mailto:info@fiscal.ge"');
    });

    it("lists one link per dataset hub", async () => {
      const { html, messages } = await render();
      const data = list(html, message(messages, "common.footerData"));
      expect(data).not.toBe("");
      expect(hrefs(data)).toEqual(DATASET_HUBS.map(({ href }) => pageHref(href, locale)));
      for (const { labelKey } of DATASET_HUBS) expect(data).toContain(`>${message(messages, labelKey)}</a>`);
    });

    it("lists methodology, AI connection, about and the other language as the platform", async () => {
      const { html, messages } = await render();
      const platform = list(html, message(messages, "common.footerPlatform"));
      expect(platform).not.toBe("");
      expect(hrefs(platform)).toEqual([pageHref("/methodology", locale), pageHref("/connect", locale), pageHref("/about", locale), pageHref("/about", other)]);
      for (const key of ["common.methodology", "common.aiConnection", "common.about"] as const) expect(platform).toContain(`>${message(messages, key)}</a>`);
      expect(platform).toContain(`lang="${other}"`);
    });

    it("keeps the source note, licence and copyright", async () => {
      const { html } = await render();
      expect(html).toContain("2026-10-20");
      expect(html).toContain("© 2026 Fiscal.ge");
      expect(html).toContain('data-testid="site-footer"');
    });
  });
});
