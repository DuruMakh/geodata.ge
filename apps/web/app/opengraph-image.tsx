import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Fiscal.ge — საქართველოს ბიუჯეტის მონაცემები";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const notoSansGeorgian = readFile(
  join(process.cwd(), "assets/fonts/NotoSansGeorgian-Regular.ttf"),
);
const horizontalLogo = readFile(
  join(process.cwd(), "public/brand/fiscal-logo-horizontal.svg"),
  "utf8",
);
const reversedMark = readFile(
  join(process.cwd(), "public/brand/fiscal-logo-mark-reversed.svg"),
  "utf8",
);

function svgDataUri(svg: string) {
  const renderableSvg = svg.replaceAll("ns0:", "").replace("xmlns:ns0=", "xmlns=");
  return `data:image/svg+xml;base64,${Buffer.from(renderableSvg).toString("base64")}`;
}

export default async function OpenGraphImage() {
  const [fontData, horizontalLogoSvg, reversedMarkSvg] = await Promise.all([
    notoSansGeorgian,
    horizontalLogo,
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
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse embeds this SVG data URI at build time. */}
        <img
          alt=""
          src={svgDataUri(horizontalLogoSvg)}
          width={400}
          height={136}
          style={{ objectFit: "contain", objectPosition: "left center" }}
        />
        <div style={{ display: "flex", maxWidth: 940, fontSize: 72, lineHeight: 1.12 }}>
          საქართველოს ბიუჯეტის მონაცემები
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
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse embeds this SVG data URI at build time. */}
        <img
          alt=""
          src={svgDataUri(reversedMarkSvg)}
          width={80}
          height={100}
          style={{ objectFit: "contain" }}
        />
        <span style={{ width: 72, height: 8, background: "#B3402A" }} />
        <div style={{ display: "flex", fontSize: 28 }}>
          გადამოწმებული · მრავალწლიანი · ღია
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
