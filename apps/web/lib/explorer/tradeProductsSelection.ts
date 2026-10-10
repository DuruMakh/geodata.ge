import type { ClientTradeProductsData } from "../data/tradeProducts/importTradeProducts";

export const TRADE_PRODUCT_TOTAL_ID = "goods.total";
export function tradeProductsBulkSelection(data: ClientTradeProductsData): string[] {
  return [TRADE_PRODUCT_TOTAL_ID, ...data.entities.map(entity => entity.id)];
}
export function encodeTradeProductsSelection(selectedIds: readonly string[], data: ClientTradeProductsData): string {
  const ids = tradeProductsBulkSelection(data), selected = new Set(selectedIds), bytes = new Uint8Array(Math.ceil(ids.length / 8));
  ids.forEach((id, index) => { if (selected.has(id)) bytes[Math.floor(index / 8)] |= 1 << (index % 8); });
  const encoded = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  return `v1.${data.catalogueFingerprint}.${encoded}`;
}
export function decodeTradeProductsSelection(token: string, data: ClientTradeProductsData): { selectedIds: string[]; invalid: boolean } {
  const invalid = { selectedIds: [TRADE_PRODUCT_TOTAL_ID], invalid: true };
  const parts = token.split("."), ids = tradeProductsBulkSelection(data), size = Math.ceil(ids.length / 8);
  if (parts.length !== 3 || parts[0] !== "v1" || parts[1] !== data.catalogueFingerprint || parts[2].length !== Math.ceil(size * 8 / 6) || !/^[A-Za-z0-9_-]+$/.test(parts[2])) return invalid;
  try {
    const base64 = parts[2].replaceAll("-", "+").replaceAll("_", "/"), decoded = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    const bytes = Uint8Array.from(decoded, letter => letter.charCodeAt(0));
    const canonical = btoa(decoded).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
    const remainder = ids.length % 8;
    if (bytes.length !== size || canonical !== parts[2] || (remainder && (bytes.at(-1)! & ~((1 << remainder) - 1)))) return invalid;
    return { selectedIds: ids.filter((_id, index) => Boolean(bytes[Math.floor(index / 8)] & (1 << (index % 8)))), invalid: false };
  } catch { return invalid; }
}
