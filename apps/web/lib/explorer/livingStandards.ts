import { HOUSEHOLD_SECTIONS } from "./household";
import { POVERTY_SECTIONS } from "./poverty";

export const LIVING_STANDARDS_HUB_PATH = "/explorer/living-standards";
export const LIVING_STANDARDS_SECTIONS = [...HOUSEHOLD_SECTIONS, ...POVERTY_SECTIONS] as const;
