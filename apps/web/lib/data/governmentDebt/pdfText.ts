import fs from "node:fs/promises";
import { PDFParse } from "pdf-parse";

export async function readPdfPages(
  filePath: string,
  pageNumbers: number[],
): Promise<Map<number, string>> {
  const parser = new PDFParse({ data: await fs.readFile(filePath) });
  try {
    const result = await parser.getText({ partial: pageNumbers });
    const pages = new Map(result.pages.map((page) => [page.num, page.text]));
    for (const pageNumber of pageNumbers) {
      if (!pages.has(pageNumber)) {
        throw new Error(`Missing PDF page ${pageNumber} in ${filePath}`);
      }
    }
    return pages;
  } finally {
    await parser.destroy();
  }
}

export function requirePageMarker(
  pages: Map<number, string>,
  pageNumber: number,
  marker: string,
): string {
  const text = pages.get(pageNumber);
  if (text === undefined) {
    throw new Error(`Missing PDF page ${pageNumber}`);
  }
  if (!text.includes(marker)) {
    throw new Error(`Missing marker "${marker}" on PDF page ${pageNumber}`);
  }
  return text;
}
