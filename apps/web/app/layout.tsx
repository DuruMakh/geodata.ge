import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GeoData.ge Budget Explorer",
  description: "Georgian-first public budget explorer for Georgia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ka" className="h-full antialiased">
      <body data-theme="light" className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
