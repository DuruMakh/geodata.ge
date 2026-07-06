// Editorial category colors (DESIGN.md §4.2). A category keeps the same color on
// every surface: chart lines, table swatches, series panel, treemap, Every 100 GEL,
// radar, budget field, ranking.

export const INK = "#1E1B16";

export const SERIES_COLORS: Record<string, string> = {
  "expenditure.total": INK,
  "revenue.total": INK,
  "admin_spending.total": INK,

  "spending.social_protection": "#B3402A",
  "spending.health": "#1F6E56",
  "spending.education": "#3D5A98",
  "spending.infrastructure_regional_development": "#B08A2E",
  "spending.defence": "#7A4E8C",
  "spending.public_order_safety": "#4A707A",
  "spending.economic_affairs": "#C26E4C",
  "spending.agriculture_environment": "#2F4B3A",
  "spending.culture": "#9C3D5E",
  "spending.sport": "#8A7B65",
  "spending.general_public_services": "#5B5347",
  "spending.debt_service": "#8C5A32",
  "spending.other_unclassified": "#A89C88",

  "revenue.vat": "#B3402A",
  "revenue.income_tax": "#3D5A98",
  "revenue.profit_tax": "#1F6E56",
  "revenue.excise_tax": "#B08A2E",
  "revenue.import_tax": "#C26E4C",
  "revenue.property_tax": "#7A4E8C",
  "revenue.other_taxes": "#8A7B65",
  "revenue.grants": "#4A707A",
  "revenue.other_revenue": "#9C3D5E",
  "revenue.asset_decrease": "#2F4B3A",
  "revenue.increase_liabilities": "#5B5347",

  "admin_spending.health_social_affairs": "#B3402A",
  "admin_spending.education_science_youth": "#3D5A98",
  "admin_spending.regional_development_infrastructure": "#B08A2E",
  "admin_spending.defence": "#7A4E8C",
  "admin_spending.internal_affairs": "#4A707A",
  "admin_spending.environment_agriculture": "#2F4B3A",
  "admin_spending.economy_sustainable_development": "#C26E4C",
  "admin_spending.justice": "#1F6E56",
  "admin_spending.foreign_affairs": "#5B5347",
  "admin_spending.finance": "#4E5D74",
  "admin_spending.culture": "#9C3D5E",
  "admin_spending.sport": "#8A7B65",
  "admin_spending.debt_service": "#8C5A32",
  "admin_spending.other_costs": "#A89C88",
};

// Open-ended sets (major programs, unlisted categories) cycle through the editorial
// palette by position so assignments stay stable for a given data ordering.
export const EDITORIAL_PALETTE = [
  "#B3402A",
  "#1F6E56",
  "#3D5A98",
  "#B08A2E",
  "#7A4E8C",
  "#4A707A",
  "#C26E4C",
  "#2F4B3A",
  "#9C3D5E",
  "#8A7B65",
  "#5B5347",
  "#8C5A32",
  "#4E5D74",
  "#A89C88",
];

export const OTHER_COLOR = "#A89C88";
export const POSITIVE = "#1F6E56";
export const NEGATIVE = "#B3402A";

export function colorForItem(itemId: string, index: number): string {
  return SERIES_COLORS[itemId] ?? EDITORIAL_PALETTE[index % EDITORIAL_PALETTE.length] ?? OTHER_COLOR;
}
