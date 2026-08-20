# 2004 National Revenue Design

## Goal

Extend the national revenue explorer to 2004 using the reviewed Ministry of Finance annual execution report already preserved in the repository.

## Source and scope

- Source: `docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2004-annual-execution-report.pdf`, page 19.
- The table reports consolidated-budget revenue and grants for 2004.
- Publish the seven tax categories, grants, other revenue, and decrease in assets.
- The ten published facts must sum to the official revenue-and-grants total of `2,283,035,800` GEL.
- Do not publish `revenue.increase_liabilities` for 2004. The report does not provide the comparable consolidated Form #1 amount, and no value may be estimated or represented as zero.

## Public behavior

- Revenue coverage becomes 2004–2025.
- Existing 2005–2025 values remain unchanged.
- The 2004 total is derived from the ten available official categories.
- The liabilities series has no 2004 point and begins in 2005.
- The revenue explorer source note and methodology page state that the comparable 2004 liabilities amount is unavailable and excluded from the 2004 total.
- The original 2004 annual report is available in the revenue methodology source archive as well as the expenditure archive.

## Validation

- Assert every exact 2004 category amount and the `2,283,035,800` GEL sum.
- Assert the 2004 panel contains no liabilities fact.
- Assert all 2005–2025 revenue facts remain unchanged after deterministic regeneration.
- Keep the existing 11-category completeness rule for 2005–2025; apply a documented ten-category rule only to 2004.

