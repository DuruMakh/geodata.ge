import type { OfficialExpenditureRow } from "../realExpenditure/types";
import type { AdminSpendingCategory } from "./types";

export const ADMIN_SPENDING_CATEGORIES: AdminSpendingCategory[] = [
  {
    id: "admin_spending.health_social_affairs",
    kaLabel: "ჯანმრთელობა, შრომა და სოციალური დაცვა",
    enLabel: "Health, labour and social affairs",
    sortOrder: 10,
  },
  {
    id: "admin_spending.education_science_youth",
    kaLabel: "განათლება, მეცნიერება და ახალგაზრდობა",
    enLabel: "Education, science and youth",
    sortOrder: 20,
  },
  {
    id: "admin_spending.regional_development_infrastructure",
    kaLabel: "რეგიონული განვითარება და ინფრასტრუქტურა",
    enLabel: "Regional development and infrastructure",
    sortOrder: 30,
  },
  {
    id: "admin_spending.defence",
    kaLabel: "თავდაცვა",
    enLabel: "Defence",
    sortOrder: 40,
  },
  {
    id: "admin_spending.internal_affairs",
    kaLabel: "შინაგან საქმეთა სამინისტრო",
    enLabel: "Internal affairs",
    sortOrder: 50,
  },
  {
    id: "admin_spending.environment_agriculture",
    kaLabel: "გარემოს დაცვა და სოფლის მეურნეობა",
    enLabel: "Environment and agriculture",
    sortOrder: 60,
  },
  {
    id: "admin_spending.economy_sustainable_development",
    kaLabel: "ეკონომიკა და მდგრადი განვითარება",
    enLabel: "Economy and sustainable development",
    sortOrder: 70,
  },
  {
    id: "admin_spending.justice",
    kaLabel: "იუსტიცია",
    enLabel: "Justice",
    sortOrder: 80,
  },
  {
    id: "admin_spending.foreign_affairs",
    kaLabel: "საგარეო საქმეთა სამინისტრო",
    enLabel: "Foreign affairs",
    sortOrder: 90,
  },
  {
    id: "admin_spending.finance",
    kaLabel: "ფინანსთა სამინისტრო",
    enLabel: "Finance",
    sortOrder: 100,
  },
  {
    id: "admin_spending.culture",
    kaLabel: "კულტურა",
    enLabel: "Culture",
    sortOrder: 110,
  },
  {
    id: "admin_spending.sport",
    kaLabel: "სპორტი",
    enLabel: "Sport",
    sortOrder: 120,
  },
  {
    id: "admin_spending.debt_service",
    kaLabel: "ვალის მომსახურება",
    enLabel: "Debt service",
    sortOrder: 130,
  },
  {
    id: "admin_spending.other_costs",
    kaLabel: "სხვა ხარჯები",
    enLabel: "Other costs",
    sortOrder: 999,
  },
];

function textIncludesAny(value: string, fragments: string[]): boolean {
  return fragments.some((fragment) => value.includes(fragment));
}

function isStateWidePayment(row: OfficialExpenditureRow): boolean {
  const institution = row.institutionLabelKa ?? row.labelKa;
  return institution.includes("საერთო") && institution.includes("მნიშვნელობის გადასახდელები");
}

function isDebtService(row: OfficialExpenditureRow): boolean {
  return isStateWidePayment(row) && row.labelKa.includes("ვალდებულებების მომსახურება და დაფარვა");
}

export function classifyAdminSpendingCategory(row: OfficialExpenditureRow): string {
  if (isDebtService(row)) return "admin_spending.debt_service";
  if (isStateWidePayment(row)) return "admin_spending.other_costs";

  const institution = row.institutionLabelKa ?? "";

  if (textIncludesAny(institution, ["ჯანმრთელობის", "შრომის", "დევნილ"])) {
    return "admin_spending.health_social_affairs";
  }
  if (institution.includes("განათლების")) return "admin_spending.education_science_youth";
  if (institution.includes("რეგიონული განვითარებისა")) {
    return "admin_spending.regional_development_infrastructure";
  }
  if (institution.includes("თავდაცვის")) return "admin_spending.defence";
  if (institution.includes("შინაგან საქმეთა")) return "admin_spending.internal_affairs";
  if (textIncludesAny(institution, ["გარემოს დაცვის", "სოფლის მეურნეობის"])) {
    return "admin_spending.environment_agriculture";
  }
  if (textIncludesAny(institution, ["ეკონომიკის", "ენერგეტიკის"])) {
    return "admin_spending.economy_sustainable_development";
  }
  if (textIncludesAny(institution, ["იუსტიციის", "სასჯელაღსრულებისა"])) return "admin_spending.justice";
  if (institution.includes("საგარეო საქმეთა")) return "admin_spending.foreign_affairs";
  if (institution.includes("ფინანსთა")) return "admin_spending.finance";
  if (institution.includes("კულტურის")) return "admin_spending.culture";
  if (institution.includes("სპორტის")) return "admin_spending.sport";

  return "admin_spending.other_costs";
}
