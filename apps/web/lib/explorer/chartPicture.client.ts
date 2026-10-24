// The chart share picture (DESIGN.md §7.17): a ShareCard drawn to a PNG in the reader's browser,
// then saved, copied or handed to the device's share sheet. modern-screenshot loads only here,
// on demand, so no page carries it on first load.

/** The card at double sharpness: a 1200px card becomes a 2400px picture. */
const PICTURE_SCALE = 2;

export async function renderPicture(node: HTMLElement): Promise<Blob> {
  await document.fonts.ready;
  const { domToBlob } = await import("modern-screenshot");
  const paper = getComputedStyle(document.documentElement).getPropertyValue("--paper").trim();
  return domToBlob(node, { scale: PICTURE_SCALE, backgroundColor: paper, type: "image/png" });
}

export function downloadPicture(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Takes the picture still being made: Safari only allows a clipboard write that starts inside the click. */
export async function copyPicture(blob: Promise<Blob>): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

/** The reader closing the share sheet is not an error. */
export async function sharePicture(blob: Blob, filename: string, title: string): Promise<"shared" | "cancelled"> {
  try {
    await navigator.share({ files: [new File([blob], filename, { type: "image/png" })], title });
    return "shared";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    throw error;
  }
}

export function canCopyPicture(): boolean {
  return typeof navigator.clipboard?.write === "function" && typeof window.ClipboardItem === "function";
}

export function canSharePicture(): boolean {
  return typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([""], "probe.png", { type: "image/png" })] });
}
