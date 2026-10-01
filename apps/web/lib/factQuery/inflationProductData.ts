import { buildProductIndex, packProductFacts, type ProductIndex } from "../explorer/inflationProducts";
import type { FactQuerySnapshot } from "./types";

const indexCache = new WeakMap<FactQuerySnapshot, ProductIndex>();

export function inflationProductIndex(snapshot: FactQuerySnapshot): ProductIndex {
  let index = indexCache.get(snapshot);
  if (index === undefined) {
    index = buildProductIndex(snapshot.inflationProducts.catalogue, packProductFacts(snapshot.inflationProducts.facts));
    indexCache.set(snapshot, index);
  }
  return index;
}
