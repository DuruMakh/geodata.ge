import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { JsonLd } from "../seo/json-ld";
import { SiteAnalytics } from "./site-analytics";
import { resolveSiteUrl } from "../../lib/siteUrl";
import { siteJsonLd } from "../../lib/seo/structuredData";
import type { Locale } from "../../lib/i18n/types";

// Stored in the repository rather than loaded from next/font/google, so builds never download
// fonts; see assets/fonts/README.md.
const notoSansGeorgian = localFont({
  src: "../../assets/fonts/NotoSansGeorgian-Variable.woff2",
  weight: "400 700",
  variable: "--font-noto-sans-georgian",
  display: "swap",
});
const notoSerifGeorgian = localFont({
  src: "../../assets/fonts/NotoSerifGeorgian-Variable.woff2",
  weight: "400 700",
  variable: "--font-noto-serif-georgian",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});
const geistMono = localFont({
  src: "../../assets/fonts/GeistMono-Variable.woff2",
  weight: "400 600",
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
});

export function rootMetadata(locale: Locale): Metadata {
  return {
    metadataBase: new URL(resolveSiteUrl()),
    title: { default: "Fiscal.ge", template: "%s" },
    description: locale === "ka"
      ? "საქართველოს სახელმწიფო და მუნიციპალური ბიუჯეტების გადამოწმებული, მრავალწლიანი და ღია მონაცემები."
      : "Reviewed, multi-year open data on Georgia’s state and municipal budgets.",
  };
}

export function RootDocument({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <html lang={locale} className={`h-full antialiased ${notoSansGeorgian.variable} ${notoSerifGeorgian.variable} ${geistMono.variable}`}>
      <body className="min-h-full flex flex-col">
        <JsonLd data={siteJsonLd(resolveSiteUrl(), locale)} testId="site-json-ld" />
        {children}
        <SiteAnalytics />
        {process.env.VERCEL === "1" && <SpeedInsights />}
      </body>
    </html>
  );
}
