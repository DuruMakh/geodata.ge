import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans_Georgian, Noto_Serif_Georgian } from "next/font/google";
import { JsonLd } from "../components/seo/json-ld";
import { resolveSiteUrl } from "../lib/siteUrl";
import { siteJsonLd } from "../lib/seo/structuredData";
import "./globals.css";

const notoSansGeorgian = Noto_Sans_Georgian({
  subsets: ["georgian", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans-georgian",
  display: "swap",
});

const notoSerifGeorgian = Noto_Serif_Georgian({
  subsets: ["georgian", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-serif-georgian",
  display: "swap",
  preload: false,
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(resolveSiteUrl()),
  title: { default: "Fiscal.ge", template: "%s" },
  description:
    "საქართველოს სახელმწიფო და მუნიციპალური ბიუჯეტების გადამოწმებული, მრავალწლიანი და ღია მონაცემები.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ka"
      className={`h-full antialiased ${notoSansGeorgian.variable} ${notoSerifGeorgian.variable} ${geistMono.variable}`}
    >
      <body className="min-h-full flex flex-col">
        <JsonLd data={siteJsonLd(resolveSiteUrl())} testId="site-json-ld" />
        {children}
      </body>
    </html>
  );
}
