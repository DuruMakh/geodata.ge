import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { I18nProvider, useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";

function Label() {
  const { locale, messages } = useI18n();
  return <span lang={locale}>{message(messages, "common.home")}</span>;
}

function Title() {
  return <span>{message(useI18n().messages, "debt.title")}</span>;
}

describe("explicit language context", () => {
  it("renders the supplied language and scoped dictionary", () => {
    expect(renderToStaticMarkup(
      <I18nProvider locale="en" messages={{ "common.home": "Home" }}><Label /></I18nProvider>,
    )).toBe('<span lang="en">Home</span>');
  });

  // Task 31 (X1-12): a page's provider ships only its own namespaces and reads the layout's through the context.
  it("adds a page's messages to the layout's provider of the same language", () => {
    expect(renderToStaticMarkup(
      <I18nProvider locale="en" messages={{ "common.home": "Home" }}>
        <I18nProvider locale="en" messages={{ "debt.title": "Debt" }}><Label /><Title /></I18nProvider>
      </I18nProvider>,
    )).toBe('<span lang="en">Home</span><span>Debt</span>');
  });

  it("does not read another language's layout messages", () => {
    expect(() => renderToStaticMarkup(
      <I18nProvider locale="ka" messages={{ "common.home": "მთავარი" }}>
        <I18nProvider locale="en" messages={{ "debt.title": "Debt" }}><Label /></I18nProvider>
      </I18nProvider>,
    )).toThrow("Missing translation: common.home");
  });

  it("rejects a missing provider instead of rendering a silent Georgian default", () => {
    expect(() => renderToStaticMarkup(<Label />)).toThrow("I18nProvider");
  });
});
