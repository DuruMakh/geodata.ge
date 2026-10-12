import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TopicHub } from "../../lib/pages/hub";
import type { HubCardModel } from "../../lib/explorer/hubCards";

const presentation = { locale: "en" as const, messages: { "common.home": "Home", "common.data": "Data" }, englishLabels: {} };
const card = (index: string): HubCardModel => ({ index, title: `Card ${index}`, description: "About it", href: `/explorer/example/${index}`, comingSoon: false, series: null, seriesColor: null, footer: null });

function render(props: Partial<Parameters<typeof TopicHub>[0]> = {}) {
  return renderToStaticMarkup(
    <TopicHub locale="en" presentation={presentation} title="Example topic" summary="What this hub covers." path="/explorer/example" coverage="" cards={[card("01"), card("02")]} testId="example-hub" {...props} />,
  );
}

describe("TopicHub", () => {
  it("renders the hub cards under the heading and summary", () => {
    const html = render();
    expect(html.match(/data-testid="hub-card"/g) ?? []).toHaveLength(2);
    expect(html).toContain('data-testid="example-hub"');
    expect(html).toContain("What this hub covers.");
    expect(html).toMatch(/<h1[^>]*>Example topic<\/h1>/);
  });

  it("emits one breadcrumb JSON-LD block ending at the hub", () => {
    const html = render();
    const scripts = html.match(/<script[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/g) ?? [];
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toContain("Example topic");
  });

  it("omits the breadcrumb JSON-LD when asked", () => {
    expect(render({ breadcrumb: false })).not.toContain("application/ld+json");
  });

  it("labels the breadcrumb with crumbLabel while the heading keeps the title", () => {
    const html = render({ crumbLabel: "Example" });
    expect(html).toMatch(/<h1[^>]*>Example topic<\/h1>/);
    expect(html.match(/<script[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/)![0]).toContain('"Example"');
  });
});
