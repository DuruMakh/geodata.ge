import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { MeasurePill } from "../../components/explorer-shell/measure-pill";
import { SegmentedTabs } from "../../components/ui/editorial";

const options = [
  { value: "a", label: "A", testId: "tab-a" },
  { value: "b", label: "B", testId: "tab-b" },
];

describe("optional control additions", () => {
  test("an option can be disabled and every other option renders as before", () => {
    const plain = renderToStaticMarkup(<SegmentedTabs ariaLabel="x" value="a" onChange={() => {}} options={options} />);
    const withDisabled = renderToStaticMarkup(
      <SegmentedTabs ariaLabel="x" value="a" onChange={() => {}} options={[options[0]!, { ...options[1]!, disabled: true }]} />,
    );
    expect(plain).not.toContain("disabled");
    expect(plain).toContain("cursor-pointer");
    expect(withDisabled.match(/disabled=""/g)).toHaveLength(1);
    expect(withDisabled).toMatch(/data-testid="tab-b"[^>]*disabled=""|disabled=""[^>]*data-testid="tab-b"/);
    expect(withDisabled).toContain("cursor-not-allowed");
  });

  test("the pill keeps its test id unless it is given another", () => {
    expect(renderToStaticMarkup(<MeasurePill label="x" pressed onChange={() => {}} />)).toContain('data-testid="measure-share-toggle"');
    expect(renderToStaticMarkup(<MeasurePill label="x" pressed onChange={() => {}} testId="georgia-pill" />)).toContain('data-testid="georgia-pill"');
  });
});
