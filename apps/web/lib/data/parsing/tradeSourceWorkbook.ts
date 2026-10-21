import { unzipSync, strFromU8 } from "fflate";
import * as XLSX from "xlsx";
import path from "node:path";

const attribute = (tag: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];

/** Read display metadata and original XML numbers separately, without rounding money through doubles. */
export function readTradeSourceWorksheet(bytes: Buffer, sheetName: string): { sheet: XLSX.WorkSheet; storedValues: Map<string, string> } {
  const workbook = XLSX.read(bytes, { type: "buffer", sheets: sheetName, cellNF: true, sheetStubs: true });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Trade source worksheet missing: ${sheetName}`);
  const zip = unzipSync(bytes), workbookXml = strFromU8(zip["xl/workbook.xml"]), relationships = strFromU8(zip["xl/_rels/workbook.xml.rels"]);
  const sheetTag = [...workbookXml.matchAll(/<sheet\b([^>]+)\/?\s*>/g)].map(match => match[1]).find(tag => attribute(tag, "name") === sheetName);
  if (!sheetTag) throw new Error(`Trade source worksheet declaration missing: ${sheetName}`);
  const relationship = [...relationships.matchAll(/<Relationship\b([^>]+)\/?\s*>/g)].map(match => match[1]).find(tag => attribute(tag, "Id") === attribute(sheetTag, "r:id"));
  const target = relationship && attribute(relationship, "Target");
  if (!target) throw new Error(`Trade source worksheet relationship missing: ${sheetName}`);
  const sheetPath = target.startsWith("/") ? target.slice(1) : path.posix.normalize(path.posix.join("xl", target));
  const xml = strFromU8(zip[sheetPath]), storedValues = new Map<string, string>();
  for (const match of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const address = attribute(match[1], "r"), token = /<v>([^<]+)<\/v>/.exec(match[2] ?? "")?.[1];
    if (address && token) storedValues.set(address, token);
  }
  return { sheet, storedValues };
}

/**
 * Parsed trade research inputs keyed by file name and content hash. The preparation functions take one optionally:
 * a caller that runs them many times over mostly unchanged inputs (the tests' negative cases) parses each unchanged
 * file once, and a changed file has a new hash, so it is parsed again. Without one, every input is parsed as before.
 * Callers must treat what it returns as read-only, because later runs share it.
 */
export type TradeParseCache = Map<string, unknown>;

export function parseOnce<T>(cache: TradeParseCache | undefined, key: string, parse: () => T): T {
  if (!cache) return parse();
  if (!cache.has(key)) cache.set(key, parse());
  return cache.get(key) as T;
}
