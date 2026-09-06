import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "../../lib/i18n/provider";
import type { Messages } from "../../lib/i18n/types";
import controls from "../../lib/i18n/messages/ka/controls.json";
import common from "../../lib/i18n/messages/ka/common.json";

// Match the explicit language provider supplied by the real Georgian root.
export function renderGeorgianMarkup(children: ReactNode, extraMessages: Messages = {}): string {
  return renderToStaticMarkup(<I18nProvider locale="ka" messages={{ ...common, ...controls, ...extraMessages }}>{children}</I18nProvider>);
}
