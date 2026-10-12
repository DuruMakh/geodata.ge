/**
 * The dataset hubs the site header menu, the footer and the 404 page link to, in sidebar order (owner decision D3,
 * 2026-10-07; Trade added with its hub). One list, so a new hub is one edit. The sidebar itself lists every hub with
 * its sub-pages and is not driven by this list.
 */
export const DATASET_HUBS = [
  { href: "/explorer", labelKey: "common.budget" },
  { href: "/explorer/economy", labelKey: "common.economy" },
  { href: "/explorer/inflation", labelKey: "common.inflation" },
  { href: "/explorer/unemployment", labelKey: "common.unemployment" },
  { href: "/explorer/trade", labelKey: "common.trade" },
] as const;
