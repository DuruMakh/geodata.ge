// apps/web/lib/factQuery/caveats/index.ts
import type { CaveatRule } from "./engine";

/** The single ordered rule list. Tasks 8-10 fill it; spec section 9.2 is the contract. */
export const CAVEAT_RULES: readonly CaveatRule[] = [];

export { evaluateCaveats } from "./engine";
export type { CaveatContext, CaveatRule } from "./engine";
