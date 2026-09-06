/* eslint-disable @next/next/no-img-element -- ImageResponse renders embedded SVGs, not browser images. */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { Locale } from "../i18n/types";
import { seoMessage } from "./strings";

const size = { width: 1200, height: 630 };

const notoSansGeorgian = readFile(
  join(process.cwd(), "assets/fonts/NotoSansGeorgian-Regular.ttf"),
);
const reversedMark = readFile(
  join(process.cwd(), "public/brand/fiscal-logo-mark-reversed.svg"),
  "utf8",
);

function svgDataUri(svg: string) {
  const renderableSvg = svg.replaceAll("ns0:", "").replace("xmlns:ns0=", "xmlns=");
  return `data:image/svg+xml;base64,${Buffer.from(renderableSvg).toString("base64")}`;
}

export async function renderSocialImage(locale: Locale) {
  const [fontData, horizontalLogoSvg, reversedMarkSvg] = await Promise.all([
    notoSansGeorgian,
    readFile(join(process.cwd(), `public/brand/fiscal-logo-horizontal${locale === "en" ? "-en" : ""}.svg`), "utf8"),
    reversedMark,
  ]);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#F7F2E9",
        color: "#1E1B16",
        borderTop: "16px solid #1E1B16",
        fontFamily: "Noto Sans Georgian",
      }}
    >
      <div
        style={{
          width: "100%",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "40px 82px 42px",
        }}
      >
        <img
          alt=""
          src={svgDataUri(horizontalLogoSvg)}
          width={400}
          height={136}
          style={{ objectFit: "contain", objectPosition: "left center" }}
        />
        <div style={{ display: "flex", maxWidth: 940, fontSize: 72, lineHeight: 1.12 }}>
          {seoMessage(locale, "seo.socialHeadline")}
        </div>
      </div>
      <div
        style={{
          width: "100%",
          height: 155,
          display: "flex",
          alignItems: "center",
          gap: 30,
          background: "#1E1B16",
          color: "#F7F2E9",
          padding: "24px 82px",
        }}
      >
        <img
          alt=""
          src={svgDataUri(reversedMarkSvg)}
          width={80}
          height={100}
          style={{ objectFit: "contain" }}
        />
        <span style={{ width: 72, height: 8, background: "#B3402A" }} />
        <div style={{ display: "flex", fontSize: 28 }}>
          {seoMessage(locale, "seo.socialTagline")}
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        {
          name: "Noto Sans Georgian",
          data: fontData,
          style: "normal",
          weight: 400,
        },
      ],
    },
  );
}
