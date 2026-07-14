import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans_Georgian, Noto_Serif_Georgian } from "next/font/google";
import { resolveSiteUrl } from "../lib/siteUrl";
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
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(resolveSiteUrl()),
  title: "GeoData.ge Budget Explorer",
  description: "Georgian-first public budget explorer for Georgia.",
  openGraph: {
    type: "website",
    siteName: "GeoData.ge",
    locale: "ka_GE",
  },
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
