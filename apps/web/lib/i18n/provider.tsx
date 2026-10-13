"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Presentation } from "./types";

type LanguageContext = Presentation;
const I18nContext = createContext<LanguageContext | null>(null);
const EMPTY_LABELS: Readonly<Record<string, string>> = {};

/**
 * A provider inside another of the same language adds to it: the layouts provide `common` and `controls`, so a page's
 * provider ships only its own namespaces (lib/i18n/presentation.server.ts) and its components still read all three.
 */
export function I18nProvider({ locale, messages, englishLabels = EMPTY_LABELS, children }: Omit<LanguageContext, "englishLabels"> & { englishLabels?: Presentation["englishLabels"]; children: ReactNode }) {
  const parent = useContext(I18nContext);
  const value = useMemo(() => parent?.locale === locale
    ? { locale, messages: { ...parent.messages, ...messages }, englishLabels: { ...parent.englishLabels, ...englishLabels } }
    : { locale, messages, englishLabels }, [parent, locale, messages, englishLabels]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): LanguageContext {
  const context = useContext(I18nContext);
  if (!context) throw new Error("Localized content requires an I18nProvider");
  return context;
}
