import type {
  ServedAdminFact,
  ServedBudgetFact,
  ServedNationalGdpFact,
} from "../servedRows";

export type ClientBudgetFact = Omit<ServedBudgetFact, "sourceId">;
export type ClientAdminFact = Omit<
  ServedAdminFact,
  "sourceId" | "officialInstitutionLabelKa"
>;
export type ClientNationalGdpFact = Omit<ServedNationalGdpFact, "sourceId">;

export function projectBudgetFact(fact: ServedBudgetFact): ClientBudgetFact {
  return {
    year: fact.year,
    side: fact.side,
    itemId: fact.itemId,
    amountGel: fact.amountGel,
    basis: fact.basis,
  };
}

export function projectAdminFact(fact: ServedAdminFact): ClientAdminFact {
  return {
    year: fact.year,
    itemId: fact.itemId,
    parentItemId: fact.parentItemId,
    level: fact.level,
    amountGel: fact.amountGel,
    basis: fact.basis,
    officialLabelKa: fact.level === "major_program" ? fact.officialLabelKa : null,
  };
}

export function projectGdpFact(fact: ServedNationalGdpFact): ClientNationalGdpFact {
  return {
    year: fact.year,
    gdpCurrentPricesGel: fact.gdpCurrentPricesGel,
    accountingStandard: fact.accountingStandard,
    status: fact.status,
  };
}
