import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { withLari } from "../../components/ui/lari";

describe("withLari", () => {
  it("sets each ₾ in the UI sans face without changing the text", () => {
    const html = renderToStaticMarkup(<span>{withLari("7.2 მლრდ ₾ · 705 ₾")}</span>);
    expect(html.match(/data-lari=""/g)).toHaveLength(2);
    expect(html).toContain('class="font-[family-name:var(--font-ui)]">₾</span>');
    expect(html.replace(/<[^>]+>/g, "")).toBe("7.2 მლრდ ₾ · 705 ₾");
  });

  it("returns text without a lari sign unchanged", () => {
    expect(withLari("7.2 bn GEL")).toBe("7.2 bn GEL");
    expect(withLari("13.9%")).toBe("13.9%");
  });
});
