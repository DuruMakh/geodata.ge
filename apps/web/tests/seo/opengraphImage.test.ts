import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { GET as OpenGraphImage, dynamic as kaDynamic } from "../../app/opengraph-image/route";
import { GET as EnglishOpenGraphImage, dynamic as enDynamic } from "../../app/(en)/en/opengraph-image/route";

function countPixelsNear(
  data: Buffer,
  channels: number,
  target: readonly [number, number, number],
  tolerance = 3,
) {
  let count = 0;
  for (let offset = 0; offset < data.length; offset += channels) {
    if (
      Math.abs(data[offset] - target[0]) <= tolerance &&
      Math.abs(data[offset + 1] - target[1]) <= tolerance &&
      Math.abs(data[offset + 2] - target[2]) <= tolerance
    ) count += 1;
  }
  return count;
}

describe("OpenGraphImage", () => {
  it("prerenders both language resources and produces different images at the same dimensions", async () => {
    expect([kaDynamic, enDynamic]).toEqual(["force-static", "force-static"]);
    const ka = Buffer.from(await (await OpenGraphImage()).arrayBuffer());
    const en = Buffer.from(await (await EnglishOpenGraphImage()).arrayBuffer());
    expect(en.equals(ka)).toBe(false);
    expect(await sharp(en).metadata()).toMatchObject({ width: 1200, height: 630, format: "png" });
  });
  it("renders distinct Georgian glyph shapes instead of repeated missing-glyph boxes", async () => {
    const response = await OpenGraphImage();
    const png = Buffer.from(await response.arrayBuffer());
    const fullImage = await sharp(png)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const upperLockup = await sharp(png)
      .extract({ left: 70, top: 35, width: 500, height: 180 })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const lowerMark = await sharp(png)
      .extract({ left: 65, top: 480, width: 140, height: 140 })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
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
    expect(fullImage.info.width).toBe(1200);
    expect(fullImage.info.height).toBe(630);
    expect(countPixelsNear(fullImage.data, fullImage.info.channels, [179, 64, 42])).toBeGreaterThan(500);
    expect(countPixelsNear(fullImage.data, fullImage.info.channels, [31, 110, 86])).toBeGreaterThan(150);
    expect(countPixelsNear(fullImage.data, fullImage.info.channels, [144, 104, 69])).toBeGreaterThan(100);
    expect(countPixelsNear(upperLockup.data, upperLockup.info.channels, [179, 64, 42])).toBeGreaterThan(250);
    expect(countPixelsNear(upperLockup.data, upperLockup.info.channels, [31, 110, 86])).toBeGreaterThan(150);
    expect(countPixelsNear(upperLockup.data, upperLockup.info.channels, [144, 104, 69])).toBeGreaterThan(100);
    expect(countPixelsNear(lowerMark.data, lowerMark.info.channels, [179, 64, 42])).toBeGreaterThan(500);
    expect(countPixelsNear(lowerMark.data, lowerMark.info.channels, [31, 110, 86])).toBeGreaterThan(250);
    expect(countPixelsNear(lowerMark.data, lowerMark.info.channels, [144, 104, 69])).toBeGreaterThan(150);
    expect(glyphWidths.length).toBeGreaterThan(10);
    expect(new Set(glyphWidths).size).toBeGreaterThanOrEqual(5);
  }, 20_000);
});
