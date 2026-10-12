import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { YearPicker } from "../../components/ui/year-picker";

const YEARS = [2004, 2005, 2006, 2025, 2026];

test("a closed year picker shows its label and value on a collapsed button, with no list", () => {
  const html = renderToStaticMarkup(
    <YearPicker label="Year" years={YEARS} value={2026} onChange={() => {}} markYear={2025} markLabel="Census re-base" testId="picker" />,
  );
  const trigger = html.match(/<button[^>]*data-testid="picker"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";
  expect(trigger).toContain('type="button"');
  expect(trigger).toContain('aria-haspopup="listbox"');
  expect(trigger).toContain('aria-expanded="false"');
  expect(trigger).toContain(">2026<");
  expect(html).toContain(">Year<");
  expect(html).not.toContain('role="listbox"');
  expect(html).not.toContain('role="option"');
});

test("with a none label and no value, the trigger shows the none label", () => {
  const html = renderToStaticMarkup(
    <YearPicker label="Compared with" years={YEARS} value={null} onChange={() => {}} noneLabel="None" testId="picker" />,
  );
  const trigger = html.match(/<button[^>]*data-testid="picker"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";
  expect(trigger).toContain(">None<");
  expect(trigger).not.toMatch(/>20\d\d</);
});
