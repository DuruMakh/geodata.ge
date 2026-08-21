import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Fiscal.ge — საქართველოს ბიუჯეტის მონაცემები";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const notoSansGeorgian = readFile(
  join(process.cwd(), "assets/fonts/NotoSansGeorgian-Regular.ttf"),
);

export default async function OpenGraphImage() {
  const fontData = await notoSansGeorgian;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#F7F2E9",
        color: "#1E1B16",
        padding: "72px 82px",
        borderTop: "16px solid #1E1B16",
        fontFamily: "Noto Sans Georgian",
      }}
    >
      <div style={{ display: "flex", fontSize: 34, letterSpacing: "0.04em" }}>FISCAL.GE</div>
      <div style={{ display: "flex", maxWidth: 940, fontSize: 72, lineHeight: 1.12 }}>
        საქართველოს ბიუჯეტის მონაცემები
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 28, color: "#55503F" }}>
        <span style={{ width: 72, height: 8, background: "#B3402A" }} />
        გადამოწმებული · მრავალწლიანი · ღია
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
