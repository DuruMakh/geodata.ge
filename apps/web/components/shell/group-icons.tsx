import { BriefcaseBusiness, Coins, Factory, HeartPulse, Landmark, Ship, Trees, UsersRound, type LucideIcon } from "lucide-react";
import type { GroupId } from "../../lib/navigation/navTree";

/** Each group's icon (spec 2026-10-24-explorer-regroup §3): its page heading and its sidebar row. */
export const GROUP_ICONS: Record<GroupId, LucideIcon> = {
  budget: Landmark,
  economy: Factory,
  prices: Coins,
  labour: BriefcaseBusiness,
  living: HeartPulse,
  external: Ship,
  demography: UsersRound,
  society: Trees,
};
