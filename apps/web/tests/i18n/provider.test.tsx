import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { I18nProvider, useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";

function Label() {
  const { locale, messages } = useI18n();
  return <span lang={locale}>{message(messages, "common.home")}</span>;
}

describe("explicit language context", () => {
  it("renders the supplied language and scoped dictionary", () => {
    expect(renderToStaticMarkup(
      <I18nProvider locale="en" messages={{ "common.home": "Home" }}><Label /></I18nProvider>,
    )).toBe('<span lang="en">Home</span>');
  });

  it("rejects a missing provider instead of rendering a silent Georgian default", () => {
    expect(() => renderToStaticMarkup(<Label />)).toThrow("I18nProvider");
  });
});
