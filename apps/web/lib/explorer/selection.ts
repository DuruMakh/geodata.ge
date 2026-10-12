/** Removes `id` from a selection when it is there, otherwise appends it. Never mutates `ids`. */
export function toggleId<T extends string>(ids: readonly T[], id: T): T[] {
  return ids.includes(id) ? ids.filter((selected) => selected !== id) : [...ids, id];
}
