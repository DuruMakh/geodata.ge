import sharp from "sharp";
import { describe, expect, it } from "vitest";
import OpenGraphImage from "../../app/opengraph-image";

describe("OpenGraphImage", () => {
  it("renders distinct Georgian glyph shapes instead of repeated missing-glyph boxes", async () => {
    const response = await OpenGraphImage();
    const png = Buffer.from(await response.arrayBuffer());
    const { data, info } = await sharp(png)
      .extract({ left: 82, top: 235, width: 940, height: 175 })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const activeColumns = Array.from({ length: info.width }, (_, x) => {
      for (let y = 0; y < info.height; y += 1) {
        const offset = (y * info.width + x) * info.channels;
        if (data[offset] < 100 && data[offset + 1] < 100 && data[offset + 2] < 100) {
          return true;
        }
      }
      return false;
    });
    const glyphWidths: number[] = [];
    for (let x = 0; x < activeColumns.length; x += 1) {
      if (!activeColumns[x]) continue;
      const start = x;
      while (x < activeColumns.length && activeColumns[x]) x += 1;
      glyphWidths.push(x - start);
    }

    expect(response.headers.get("content-type")).toContain("image/png");
    expect(glyphWidths.length).toBeGreaterThan(10);
    expect(new Set(glyphWidths).size).toBeGreaterThanOrEqual(5);
  }, 20_000);
});
