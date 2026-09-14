// apps/web/lib/factQuery/caveats/index.ts
import type { CaveatRule } from "./engine";
import { DEBT_CAVEAT_RULES } from "./rules.debt";
import { DEFICIT_CAVEAT_RULES } from "./rules.deficit";
import { GDP_CAVEAT_RULES } from "./rules.gdp";
import { MINISTRIES_CAVEAT_RULES } from "./rules.ministries";
import { MUNICIPAL_CAVEAT_RULES } from "./rules.municipal";
import { NATIONAL_CAVEAT_RULES } from "./rules.national";
import { SECTORS_CAVEAT_RULES } from "./rules.sectors";

/**
 * The single ordered rule list. Spec section 9.2 is the contract (22 codes),
 * plus two approved splits of codes that section names:
 * admin_category_not_yet_established carries the admin_category half of
 * program_coverage_partial's missing-cell case, and
 * program_parent_category_modern_grouping carries the parent-attribution half
 * of program_historical_join's. nominal_gel was retired on 2026-09-04 (see
 * rules.national.ts), and the debt and general-government-balance datasets add
 * four and two codes of their own. The GDP overview and economic sectors add
 * two and one, registered on 2026-09-14 after shipping inline; the GDP
 * overview's preliminary cells share gdp_preliminary. The count is asserted
 * against ai-grounding-and-caveats.md rather than written here.
 */
export const CAVEAT_RULES: readonly CaveatRule[] = [
  ...NATIONAL_CAVEAT_RULES,
  ...MUNICIPAL_CAVEAT_RULES,
  ...MINISTRIES_CAVEAT_RULES,
  ...DEBT_CAVEAT_RULES,
  ...DEFICIT_CAVEAT_RULES,
  ...GDP_CAVEAT_RULES,
  ...SECTORS_CAVEAT_RULES,
];

export { evaluateCaveats } from "./engine";
export type { CaveatContext, CaveatRule } from "./engine";
