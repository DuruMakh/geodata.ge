// apps/web/lib/factQuery/caveats/index.ts
import type { CaveatRule } from "./engine";
import { MINISTRIES_CAVEAT_RULES } from "./rules.ministries";
import { MUNICIPAL_CAVEAT_RULES } from "./rules.municipal";
import { NATIONAL_CAVEAT_RULES } from "./rules.national";

/**
 * The single ordered rule list; spec section 9.2 is the contract (22 codes), plus two
 * approved splits of codes that section names: admin_category_not_yet_established
 * carries the admin_category half of program_coverage_partial's missing-cell case, and
 * program_parent_category_modern_grouping carries the parent-attribution half of
 * program_historical_join's. 24 codes.
 */
export const CAVEAT_RULES: readonly CaveatRule[] = [
  ...NATIONAL_CAVEAT_RULES,
  ...MUNICIPAL_CAVEAT_RULES,
  ...MINISTRIES_CAVEAT_RULES,
];

export { evaluateCaveats } from "./engine";
export type { CaveatContext, CaveatRule } from "./engine";
