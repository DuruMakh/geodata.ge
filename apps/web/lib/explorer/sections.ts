// The budget sections, in their one canonical order (DESIGN.md §6.7). The
// sidebar list and the hub cards both read this, so "identical in both places"
// holds by construction instead of by two hand-maintained copies that can only
// disagree. A null href marks a section with no data and no route yet.

export const BUDGET_SECTION_ORDER = ["expenditure", "revenue", "municipalities", "analysis", "debt", "deficit"] as const;

export type BudgetSectionId = (typeof BUDGET_SECTION_ORDER)[number];

export type BudgetSection = { label: string; href: string | null };

export const BUDGET_SECTIONS: Record<BudgetSectionId, BudgetSection> = {
  expenditure: { label: "ხარჯები", href: "/explorer/expenditure" },
  revenue: { label: "შემოსავლები", href: "/explorer/revenue" },
  municipalities: { label: "მუნიციპალიტეტები", href: "/explorer/municipalities" },
  analysis: { label: "ანალიზი", href: "/explorer/analysis" },
  debt: { label: "ვალი", href: "/explorer/debt" },
  deficit: { label: "დეფიციტი", href: "/explorer/deficit" },
};
