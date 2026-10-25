import { readFileSync } from "node:fs";
import { strFromU8, unzipSync } from "fflate";

const XML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

function decodeXmlEntities(text: string) {
  return text.replaceAll(/&(?:amp|lt|gt|quot|apos);/g, (entity) => XML_ENTITIES[entity]);
}

/** One cell: its text runs joined in order, entities decoded, whitespace collapsed and trimmed. */
function cellText(cellXml: string) {
  const text = [...cellXml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((match) => match[1]).join("");
  return decodeXmlEntities(text).replaceAll(/\s+/g, " ").trim();
}

/**
 * Reads every table of a .docx as tables -> rows -> trimmed cell text. Merged cells are
 * not expanded: a row has exactly the cells the file stores for it. Nested tables are not supported.
 */
export function readDocxTables(filePath: string): string[][][] {
  const documentXml = unzipSync(new Uint8Array(readFileSync(filePath)))["word/document.xml"];
  if (!documentXml) throw new Error(`Not a .docx file (no word/document.xml): ${filePath}`);
  const xml = strFromU8(documentXml);
  return [...xml.matchAll(/<w:tbl>([\s\S]*?)<\/w:tbl>/g)].map((table) =>
    [...table[1].matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)].map((row) =>
      [...row[0].matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)].map((cell) => cellText(cell[0])),
    ),
  );
}

/** Parses a thousand-GEL amount as printed in the law ("30,881,358.0" -> 30881358); empty text is 0. */
export function parseThousandGel(text: string): number {
  const cleaned = text.replaceAll(",", "").trim();
  if (cleaned === "") return 0;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) throw new Error(`Not a thousand-GEL amount: ${JSON.stringify(text)}`);
  return value;
}
