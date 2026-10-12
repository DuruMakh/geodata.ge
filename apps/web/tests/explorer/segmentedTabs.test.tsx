import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SegmentedTabs } from "../../components/ui/editorial";

const render = (disabled?: boolean, title?: string) =>
  renderToStaticMarkup(
    <SegmentedTabs
      ariaLabel="Measure"
      value="share"
      onChange={() => {}}
      options={[
        { value: "share", label: "%", testId: "share" },
        { value: "persons", label: "People", testId: "persons", disabled, title },
      ]}
    />,
  );

describe("SegmentedTabs", () => {
  it("renders an option without `disabled` exactly as before: no aria-disabled, no title, the pointer and hover classes", () => {
    const html = render();
    expect(html).not.toContain("aria-disabled");
    expect(html).not.toContain("title=");
    expect(html).not.toContain("cursor-default");
    expect((html.match(/hover:bg-\[var\(--tint\)\]/g) ?? []).length).toBe(1);
  });

  it("renders a disabled option inert, with the reason as its title", () => {
    const html = render(true, "Not comparable");
    expect(html).toMatch(/data-testid="persons"[^>]*aria-disabled="true"[^>]*title="Not comparable"/);
    expect(html).toContain("cursor-default");
    expect(html).not.toContain("hover:bg-[var(--tint)]");
  });
});
