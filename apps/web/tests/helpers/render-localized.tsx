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

/**
 * One drawing of a server-rendered chart. Before the browser measures, a chart
 * renders both its desktop and its phone geometry (CSS shows one), so markup
 * assertions about a single drawing scope themselves to it.
 */
export function chartGeometry(markup: string, geometry: "desktop" | "mobile"): string {
  const match = new RegExp(`<svg[^>]*data-geometry="${geometry}"[^>]*>[\\s\\S]*?</svg>`).exec(markup);
  if (!match) throw new Error(`No ${geometry} drawing in ${markup.slice(0, 200)}`);
  return match[0];
}
