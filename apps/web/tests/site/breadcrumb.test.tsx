import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BreadcrumbTrail } from "../../components/seo/breadcrumb-json-ld";
import { PageHeader } from "../../components/shell/page-header";
import { I18nProvider } from "../../lib/i18n/provider";
import { getMessages } from "../../lib/i18n/messages.server";
import { message } from "../../lib/i18n/messages";

vi.mock("next/navigation", () => ({ usePathname: () => "/explorer/expenditure" }));

const landmarkNames = (html: string) => [...html.matchAll(/<nav\b[^>]*aria-label="([^"]*)"/g)].map((match) => match[1]);

describe.each([
  ["ka", "ნავიგაციის ბილიკი"],
  ["en", "Breadcrumb"],
] as const)("breadcrumbs in %s", (locale, name) => {
  it("the breadcrumb landmark is named in the page language", async () => {
    const messages = await getMessages(locale, ["common"]);
    const header = renderToStaticMarkup(
      <I18nProvider locale={locale} messages={messages}>
        <PageHeader crumbs={[{ label: message(messages, "common.home"), href: "/" }, { label: message(messages, "common.data") }, { label: message(messages, "common.expenditure") }]} coverage="2010–2025" />
      </I18nProvider>,
    );
    // The full trail and the phone back-crumb are both named.
    expect(landmarkNames(header)).toEqual([name, name]);

    const trail = renderToStaticMarkup(
      <BreadcrumbTrail label={message(messages, "common.breadcrumb")} items={[{ name: message(messages, "common.home"), path: "/" }, { name: message(messages, "common.methodology"), path: "/methodology" }]} />,
    );
    expect(landmarkNames(trail)).toEqual([name]);
  });
});
