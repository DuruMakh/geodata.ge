import { NAV_GROUPS } from "./navTree";

/**
 * The groups the site header menu, the footer and the 404 page link to: every group of the sidebar's navigation
 * config, in its order. A new group is one edit to `NAV_GROUPS`.
 */
export const DATASET_HUBS = NAV_GROUPS.map(({ href, labelKey }) => ({ href, labelKey }));
