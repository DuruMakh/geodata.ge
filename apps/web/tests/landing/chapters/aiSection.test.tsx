import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AiSection, MCP_ENDPOINT, type AiLabels } from "../../../components/landing/chapters/ai-section";
import { CopyEndpoint } from "../../../components/connect/copy-endpoint";

const labels: AiLabels = {
  title: "ჰკითხე AI-ს — პასუხი წყაროსთან ერთად",
  lede: "დააკავშირე Claude ან სხვა ასისტენტი.",
  meta: "MCP · Streamable HTTP · ავტორიზაციის გარეშე",
  copy: "კოპირება",
  copied: "დაკოპირდა",
  copyLabel: "მისამართის კოპირება",
  copiedLabel: "მისამართი დაკოპირდა",
  facts: ["მხოლოდ წაკითხვა", "ტოკენი არ სჭირდება", "სესიის გარეშე"],
  tools: "ინსტრუმენტები",
  cta: "AI-კავშირის ინსტრუქცია →",
  cardTitle: "როგორ მუშაობს",
  cardKicker: "კითხვიდან წყარომდე",
  nodes: [
    { title: "თქვენი კითხვა", text: "ტექსტი 1" },
    { title: "AI ასისტენტი", text: "ტექსტი 2" },
    { title: "fiscal.ge/mcp", text: "ტექსტი 3" },
    { title: "ოფიციალური წყარო", text: "ტექსტი 4" },
    { title: "პასუხი", text: "ტექსტი 5" },
  ],
};
const tools = ["query_economic_sectors", "query_inflation", "query_inflation_products"];

const render = (locale: "ka" | "en" = "ka") => renderToStaticMarkup(<AiSection tools={tools} labels={labels} locale={locale} />);

describe("AiSection", () => {
  const html = render();

  it("is the #ai band", () => {
    expect(html).toContain('id="ai"');
    expect(html).toContain("ჰკითხე AI-ს — პასუხი წყაროსთან ერთად");
  });

  it("shows the address as visible, selectable text next to the copy button", () => {
    expect(MCP_ENDPOINT).toBe("https://fiscal.ge/mcp");
    expect(html).toMatch(/<code class="[^"]*select-all[^"]*">https:\/\/fiscal\.ge\/mcp<\/code>/);
    expect(html).toContain('data-testid="landing-ai-copy"');
    expect(html).toContain('aria-label="მისამართის კოპირება"');
    expect(html).toContain(">კოპირება</button>");
  });

  it("renders one chip per tool and one line per fact", () => {
    for (const tool of tools) expect(html).toContain(`>${tool}</li>`);
    expect(html.match(/border-\[var\(--ai-line\)\]/g)).toHaveLength(tools.length);
    for (const fact of labels.facts) expect(html).toContain(fact);
  });

  it("links to the connect page, with the /en prefix in English", () => {
    expect(html).toMatch(/href="\/connect"[^>]*>AI-კავშირის ინსტრუქცია →/);
    expect(render("en")).toMatch(/href="\/en\/connect"/);
  });

  it("draws the five-node how-it-works card", () => {
    expect(html).toContain("როგორ მუშაობს");
    expect(html.match(/<li class="relative grid/g)).toHaveLength(5);
  });
});

describe("CopyEndpoint look", () => {
  const props = { value: "x", copyLabel: "a", copiedLabel: "b", copyText: "c", copiedText: "d" };

  it("keeps the Connect page's button look by default", () => {
    const html = renderToStaticMarkup(<CopyEndpoint {...props} />);
    expect(html).toContain("border border-[var(--control)]");
    expect(html).toContain("uppercase");
  });

  it("takes a different look when a class name is given", () => {
    const html = renderToStaticMarkup(<CopyEndpoint {...props} className="custom-look" />);
    expect(html).toContain('class="custom-look"');
    expect(html).not.toContain("border-[var(--control)]");
  });
});
