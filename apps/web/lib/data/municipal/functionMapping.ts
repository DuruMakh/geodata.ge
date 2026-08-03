
// The one definition of the official-code → semantic-id rename (spec §3).
// The generator and the validation gate both read it, so they cannot drift.
// Selected-detail codes (7.1.1, 7.4.5.1, 7.5.1, 7.8.1, 7.8.2, 7.9.1) are
// deliberately absent: only the ten main functions are served, and an unknown
// code must fail loudly rather than resolve to something plausible.
const CATEGORY_ID_BY_CODE: Record<string, string> = {
  "7.1": "municipal.general_public_services",
  "7.2": "municipal.defence",
  "7.3": "municipal.public_order_safety",
  "7.4": "municipal.economic_affairs",
  "7.5": "municipal.environment",
  "7.6": "municipal.housing_communal",
  "7.7": "municipal.health",
  "7.8": "municipal.recreation_culture",
  "7.9": "municipal.education",
  "7.10": "municipal.social_protection",
};

export const MUNICIPAL_FUNCTION_CODES: readonly string[] = Object.keys(CATEGORY_ID_BY_CODE);

export function municipalCategoryIdForCode(functionalCode: string): string {
  const categoryId = CATEGORY_ID_BY_CODE[functionalCode];

  if (categoryId === undefined) {
    throw new Error(
      `Unknown municipal functional code "${functionalCode}". Only the ten main functions ` +
        `(${MUNICIPAL_FUNCTION_CODES.join(", ")}) are served; selected details are not imported.`,
    );
  }

  return categoryId;
}
