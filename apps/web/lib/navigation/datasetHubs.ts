import { NAV_TREE } from "./navTree";

/**
 * The dataset hubs the site header menu, the footer and the 404 page link to: every hub of the sidebar's navigation
 * tree, in its order (owner question Q3, 2026-10-12, recommended default). A new hub is one edit to `NAV_TREE`.
 */
export const DATASET_HUBS = NAV_TREE.map(({ href, labelKey }) => ({ href, labelKey }));
