/**
 * Removes `id` from a selection when it is there, otherwise appends it. With `order`, an added id
 * takes its place in that list instead, and ids outside `order` are dropped. Never mutates `ids`.
 */
export function toggleId<T extends string>(ids: readonly T[], id: T, order?: readonly T[]): T[] {
  if (ids.includes(id)) return ids.filter((selected) => selected !== id);
  return order ? order.filter((item) => item === id || ids.includes(item)) : [...ids, id];
}
