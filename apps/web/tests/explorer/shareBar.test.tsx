import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ShareBar } from "../../components/ui/editorial";

describe("ShareBar", () => {
  it("fills the given share of the track", () => {
    expect(renderToStaticMarkup(<ShareBar share={0.25} />)).toContain("width:25.0%");
  });

  it("clamps a share above one to a full bar", () => {
    expect(renderToStaticMarkup(<ShareBar share={1.4} />)).toContain("width:100.0%");
  });

  it("fills the rest in a second colour when asked", () => {
    const html = renderToStaticMarkup(<ShareBar share={0.25} restColor="var(--accent)" />);
    expect(html).toContain("width:75.0%");
    expect(html).toContain("var(--accent)");
  });

  it("is decorative and uses only spans, so it fits inside links", () => {
    const html = renderToStaticMarkup(<ShareBar share={0.5} testId="bar" fillTestId="fill" />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("<div");
    expect(html).toContain('data-testid="bar"');
    expect(html).toContain('data-testid="fill"');
  });
});
