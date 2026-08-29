// apps/web/lib/factQuery/caveats/index.ts
import type { CaveatRule } from "./engine";
import { MUNICIPAL_CAVEAT_RULES } from "./rules.municipal";
import { NATIONAL_CAVEAT_RULES } from "./rules.national";

/** The single ordered rule list. Tasks 8-10 fill it; spec section 9.2 is the contract. */
export const CAVEAT_RULES: readonly CaveatRule[] = [...NATIONAL_CAVEAT_RULES, ...MUNICIPAL_CAVEAT_RULES];

export { evaluateCaveats } from "./engine";
export type { CaveatContext, CaveatRule } from "./engine";
