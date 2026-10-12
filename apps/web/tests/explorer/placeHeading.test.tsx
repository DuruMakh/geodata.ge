import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EntityNeighbourLinks } from "../../components/explorer-shell/entity-neighbour-links";
import { PlaceHeading } from "../../components/explorer-shell/place-heading";

const neighbours = {
  testId: "regional-entity-navigation",
  previous: { href: "/explorer/economy/regions/guria", label: "Guria" },
  next: { href: "/explorer/economy/regions/kakheti", label: "Kakheti" },
};

describe("PlaceHeading", () => {
  it("renders the picker trigger as a closed dialog button", () => {
    const html = renderToStaticMarkup(<PlaceHeading lead="Regional economy —" placeLabel="Imereti" triggerTestId="region-picker-trigger" picker={() => null} />);
    const trigger = html.match(/<button[^>]*>/)![0];
    expect(trigger).toContain('data-testid="region-picker-trigger"');
    expect(trigger).toContain('aria-haspopup="dialog"');
    expect(trigger).toContain('aria-expanded="false"');
    expect(html).toContain("Imereti");
  });

  it("shows previous and next only when given", () => {
    const withLinks = renderToStaticMarkup(<PlaceHeading lead="Regional economy —" placeLabel="Imereti" triggerTestId="region-picker-trigger" picker={() => null} neighbours={neighbours} />);
    const nav = withLinks.slice(withLinks.indexOf('data-testid="regional-entity-navigation"'));
    expect(nav).toContain('href="/explorer/economy/regions/guria"');
    expect(nav).toContain('href="/explorer/economy/regions/kakheti"');
    const without = renderToStaticMarkup(<PlaceHeading lead="Regional economy —" placeLabel="Imereti" triggerTestId="region-picker-trigger" picker={() => null} />);
    expect(without).not.toContain("←");
  });
});

describe("EntityNeighbourLinks plainAnchors", () => {
  it("renders two plain links with the default classes", () => {
    const props = { testId: "municipal-entity-navigation", previous: neighbours.previous, next: neighbours.next };
    const plain = renderToStaticMarkup(<EntityNeighbourLinks {...props} plainAnchors />);
    const linked = renderToStaticMarkup(<EntityNeighbourLinks {...props} />);
    expect(plain.match(/<a href=/g) ?? []).toHaveLength(2);
    const classes = (html: string) => [...html.matchAll(/class="([^"]*)"/g)].map((match) => match[1]);
    expect(classes(plain)).toEqual(classes(linked));
  });
});
