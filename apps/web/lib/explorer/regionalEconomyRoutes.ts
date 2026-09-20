export function regionalEconomyHref(regionId: string) {
  if (!regionId.startsWith("region.")) throw new Error(`Invalid regional economy route ID ${regionId}`);
  return `/explorer/economy/regions/${regionId.slice("region.".length)}`;
}
