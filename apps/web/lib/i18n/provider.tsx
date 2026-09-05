"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Locale, Messages } from "./types";

type LanguageContext = { locale: Locale; messages: Messages };
const I18nContext = createContext<LanguageContext | null>(null);

export function I18nProvider({ locale, messages, children }: LanguageContext & { children: ReactNode }) {
  return <I18nContext.Provider value={{ locale, messages }}>{children}</I18nContext.Provider>;
}

export function useI18n(): LanguageContext {
  const context = useContext(I18nContext);
  if (!context) throw new Error("Localized content requires an I18nProvider");
  return context;
}
