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

  // The standalone Refugees/IDP ministry (its label uses "ლტოლვილთა"/"გადაადგილებულ", not the
  // modern merged-ministry "დევნილ") → Health & Social. Traced against 2019-2025: when the ministry
  // was absorbed, its core programs — resettlement-maintenance (successor "27 06 03 ...სოციალური"),
  // livelihood, and migration-policy — were consolidated into the IDPs/Labour/Health super-ministry
  // (institution 27), which classifies to Health & Social. (The separate Regional-Development
  // IDP-housing line "25 06" was always its own program, not part of this ministry.) It existed
  // standalone through 2018; from 2019 institution 27 is caught by the modern health rule below.
  if (row.year <= 2018 && textIncludesAny(institution, ["ლტოლვილთა", "გადაადგილებულ"])) {
    return "admin_spending.health_social_affairs";
  }

  // The 2005 Culture ministry's Youth Affairs Department is booked to Education/science/youth (owner
  // decision — youth sits in that category in the modern taxonomy). Keyed on the synthesized 2005
  // department label; requiring "დეპარტამენტი" avoids touching the 2014 sport-and-youth MINISTRY,
  // which keeps sport (matched later in the cascade).
  if (row.year <= 2016 && institution.includes("ახალგაზრდობის საქმეთა დეპარტამენტი")) {
    return "admin_spending.education_science_youth";
  }

  // The pre-2018 Environment & Natural Resources ministry ("გარემოსა და ბუნებრივი რესურსების დაცვის")
  // predates the modern "გარემოს დაცვის[ა]" wording (from 2018 it merged with agriculture and is
  // caught by the modern rule below). The phrase is unique to <=2017 so it never touches 2018+, and
  // it does not match the 2013 energy ministry ("ენერგეტიკისა და ბუნებრივი რესურსების").
  if (row.year <= 2017 && institution.includes("გარემოსა და ბუნებრივი რესურსების")) {
    return "admin_spending.environment_agriculture";
  }

  // Program-level split of the combined Culture+Sport ministry (2018, 2022-2024) and the 2019-2021
  // Education mega-ministry (Education+Science+Culture+Sport). Those years book sport — and, in the
  // mega-ministry, culture too — inside the parent category, which would otherwise leave the Sport
  // series empty for 2018-2024 and the Culture series empty for 2019-2021. Route the clearly
  // single-function PROGRAMS to Sport / Culture so all three series stay continuous across
  // 2005-2025. The separate Sport ministry of 2005-2017 and 2025 already classifies wholesale to
  // sport, so this is gated to 2018-2024 (the only years "სპორტ" appears in a *combined* ministry
  // name). The ministry apparatus and every general education/science program stay with the parent;
  // a program mixing culture and sport (with no education/science element) is booked to Culture, the
  // primary sector of these ministries.
  if (row.year >= 2018 && row.year <= 2024 && institution.includes("სპორტ")) {
    // Strip "ტრანსპორტ" (transport) first: it contains "სპორტ" as a substring, so the school-
    // student-transport program (32 02 10/11) would otherwise be mis-read as a sport program.
    const program = row.labelKa.replaceAll("ტრანსპორტ", "");
    const hasSport = program.includes("სპორტ"); // also matches "სასპორტო"
    const hasCulture =
      program.includes("კულტურ") || program.includes("ხელოვნებ") || program.includes("მემკვიდრეობ");
    const hasEducationOrScience = program.includes("განათლ") || program.includes("მეცნიერ");
    if (!hasEducationOrScience) {
      if (hasSport && !hasCulture) return "admin_spending.sport";
      if (hasCulture) return "admin_spending.culture"; // pure culture, or mixed culture+sport
    }
  }

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
  // "ეკონომიკური" catches the 2005 "ეკონომიკური განვითარების სამინისტრო" (Economic Development);
  // verified no-op for 2013 and 2017-2025 (their economy ministry uses "ეკონომიკის").
  if (textIncludesAny(institution, ["ეკონომიკის", "ეკონომიკური", "ენერგეტიკის"])) {
    return "admin_spending.economy_sustainable_development";
  }
  // "სასჯელაღსრულებ" is the stem shared by the pre-2014 spelling ("სასჯელაღსრულების") and the
  // 2014+ spelling ("სასჯელაღსრულებისა"), so the standalone Corrections/Penitentiary ministry
  // routes to justice in every year it existed (2009-2013 as well as 2014+).
  if (textIncludesAny(institution, ["იუსტიციის", "სასჯელაღსრულებ"])) return "admin_spending.justice";
  if (institution.includes("საგარეო საქმეთა")) return "admin_spending.foreign_affairs";
  if (institution.includes("ფინანსთა")) return "admin_spending.finance";
  if (institution.includes("კულტურის")) return "admin_spending.culture";
  if (institution.includes("სპორტის")) return "admin_spending.sport";

  return "admin_spending.other_costs";
}
