// apps/web/lib/factQuery/caveats/index.ts
import type { CaveatRule } from "./engine";
import { MINISTRIES_CAVEAT_RULES } from "./rules.ministries";
import { MUNICIPAL_CAVEAT_RULES } from "./rules.municipal";
import { NATIONAL_CAVEAT_RULES } from "./rules.national";

/** The single ordered rule list; spec section 9.2 is the contract (22 codes). */
export const CAVEAT_RULES: readonly CaveatRule[] = [
  ...NATIONAL_CAVEAT_RULES,
  ...MUNICIPAL_CAVEAT_RULES,
  ...MINISTRIES_CAVEAT_RULES,
];

export { evaluateCaveats } from "./engine";
export type { CaveatContext, CaveatRule } from "./engine";
