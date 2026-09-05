"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Presentation } from "./types";

type LanguageContext = Presentation;
const I18nContext = createContext<LanguageContext | null>(null);
const EMPTY_LABELS: Readonly<Record<string, string>> = {};

export function I18nProvider({ locale, messages, englishLabels = EMPTY_LABELS, children }: Omit<LanguageContext, "englishLabels"> & { englishLabels?: Presentation["englishLabels"]; children: ReactNode }) {
  return <I18nContext.Provider value={{ locale, messages, englishLabels }}>{children}</I18nContext.Provider>;
}

export function useI18n(): LanguageContext {
  const context = useContext(I18nContext);
  if (!context) throw new Error("Localized content requires an I18nProvider");
  return context;
}
