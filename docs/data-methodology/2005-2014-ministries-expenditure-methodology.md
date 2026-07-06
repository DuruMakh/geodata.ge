# Ministries expenditure — 2005 and 2014 backfill methodology

> **This is a detailed per-year appendix.** The authoritative full methodology is
> [`ministries-expenditure-methodology.md`](ministries-expenditure-methodology.md). Some
> classification claims below (the "< 2017" gating of the IDP and Environment rules, the Prosecutor
> and 2017-Environment "left in other_costs" notes, and the "36 03 kept merged" drill-down line)
> were **superseded by the 2026-07-06 owner-approved review** — see the master doc §6 and §7.4 and
> `categories.ts` / `generateAdminSpendingFacts.ts` for the current behavior. The 2005/2014
> extraction facts and SHA-256 table below remain accurate.

Extends the ministries (organizational / "tavi 6") expenditure dataset
(`ADMIN_SPENDING_YEARS`) backwards to **2005** and **2014**. These two are the "Group B"
years: the actuals exist in the repo but need bounded, deterministic handling before the
standard aggregation reconciles. Baseline years 2017–2025 (and the 2013 drop-in) are
unchanged.

## Sources

| Year | File | SHA-256 |
|---|---|---|
| 2005 | `docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2005-fact.xlsx` | `b0039981526ea083f59704fe27bd670784b3b67512b07cc3307366d09f71c8f4` |
| 2014 | `docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2015-fact.xlsx` (column `col_4`) | `47f9c22fffcae56faecb79bc0cfe84bcddb42db265ff4da7089ba84abdb0906e` |
| 2005 Finance split reference | `docs/Raw Data/Expenditure/treasury.ge/2005-12-month-state-budget-functional-expenditure.pdf` | `bfc38acbd91515a224ac9148635537c163662d4bb36e2ad28c963d33fa4f9622` |
| 2005 Culture/Sport split reference | `docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2005-annual-execution-report.pdf` | `3cde917addd4cf2f689639e386ab706bc2f4a9bae9f01f21aab1994273fd5de8` |

Extraction: `apps/web/lib/data/adminSpending/extractOlderMinistryYears.ts`.

## 2014

The repo's `2014-fact.xlsx` is the budget **law** (plan), not actuals. The 2014 **actuals**
live in `2015-fact.xlsx` column `col_4` (headers: `col_3` = 2013 fact, `col_4` = 2014 fact,
`col_5` = 2015 plan). That table carries full leaf detail, so 2014 aggregates at leaf level
exactly like 2017–2025:

- Grand total `00 00` = **9,009,812.2k GEL** (the official 2014 payments total); category sum
  reconciles within the 1,000-GEL tolerance.
- Debt service splits automatically out of the `58 00` state-wide-payments line
  (`58 01` + `58 02` = **779,134.4k**).
- All ministries map as in 2017–2025 except the two handled by the shared rules below.

## 2005

The 2005 workbook stores labels in the **AcadNusx** legacy font (Latin characters encoding
Georgian glyphs) and prints only ministry **totals** — sub-program detail is incomplete
(only 15 of 34 institutions have any child row, and those are "apparatus" lines). So 2005 is
a **ministry-total** year: no drill-down programs, aggregated at the institution level.

- **Transliteration**: `transliterateAcadNusx.ts` converts labels back to Mkhedruli with a
  verified 1:1 map (`saqarTvelos finansTa saministro` → `საქართველოს ფინანსთა სამინისტრო`).
- **Institution-level rows**: only subtree-root coded rows are kept — the 34 `NN 00`
  institutions plus the orphan Patriarchate subtree-top `43 03` (its `43 00` parent is not
  printed). Grand total is synthesized (`00 00` = **2,609,022.9k**), since the source has none.
- **Finance line split (owner-approved)**: institution `25 00` "Ministry of Finance" =
  **574,203.3k** is a single line with no children and bundles debt + transfers + finance.
  The organizational file cannot split it, so we borrow the split from the 2005 **functional**
  report's block 14:
  - Debt service (`14 01 01`, operations on state debt obligations) = **282,040.4k** → `debt_service`
  - Transfers to local governments (`14 02 02`, subventions) + other (`14 03`) = **178,800.8k** → `other_costs`
  - Residual (MoF own operations + reserves) = **113,362.1k** → `finance`
  - Identity: 574,203.3 − 282,040.4 − 178,800.8 = 113,362.1 (finance-proper, comparable to
    2014's 94.5k). Without this, 2005 would show a misleading 6× Finance spike and no debt.
- **Culture / Sport / Youth split (owner-approved)**: `33 00` was one ministry (Culture,
  Monuments **and** Sport) = **34,433.2k**. The workbook has no sub-program detail, but the 2005
  **annual execution report** breaks the ministry into departments whose actuals sum to that exact
  total. We split it accordingly:
  - Sport Department = **6,915.1k** → `sport`
  - Youth Affairs Department = **2,887.9k** → `education_science_youth` (owner decision — youth
    sits in that category in the modern taxonomy)
  - Culture/monuments remainder = **24,630.2k** → `culture`
  - The split rows carry code `33 00` with department-specific labels so the classifier routes
    each part; the year total is unchanged.

## Shared classifier rules

In `apps/web/lib/data/adminSpending/categories.ts`:

- **`ეკონომიკური` → economy**: catches the 2005 "Economic Development" ministry
  (`ეკონომიკური განვითარების`). Verified no-op for 2013 and 2017–2025.
- **Refugees / IDP ministry → Health & Social, backfill only**: the standalone
  Refugees/IDP ministry (pre-2017 labels use `ლტოლვილთა` / `გადაადგილებულ`, not the modern
  `დევნილ`) maps to `health_social_affairs` — matching where the displaced-persons function
  sits in 2017–2025 after it merged into that ministry. **Gated to years < 2017** so the
  shipped 2017/2018 classification (other_costs) is unchanged (owner directive: no changes to
  2017–2025 data or taxonomy).
- **Environment & Natural Resources ministry → Environment & Agriculture, backfill only**:
  2014's `გარემოსა და ბუნებრივი რესურსების დაცვის` doesn't match the modern `გარემოს დაცვის`
  keyword. **Gated to years < 2017** so the identically-named 2017 ministry stays as shipped
  (other_costs). The fragment `გარემოსა და ბუნებრივი რესურსების` does not match the 2013 Energy
  ministry (`ენერგეტიკისა და ბუნებრივი რესურსების`), which stays in economy.
- **Youth Affairs Department → Education/science/youth, backfill only**: the 2005 Culture
  ministry's Youth Affairs Department is booked to `education_science_youth`. Keyed on the
  synthesized department label (`ახალგაზრდობის საქმეთა დეპარტამენტი`); requiring `დეპარტამენტი`
  leaves the 2014 sport-and-youth *ministry* on sport.

## Drill-down program identities (pre-2017 code reuse)

Following the rule *"the drill-down shows only programs that exist in 2017–2025; merge slight
renames, drop reused/abolished codes"* (`PROGRAM_SEMANTIC_ERAS` + the modern-presence filter
in `generateAdminSpendingFacts.ts`), the pre-2017 code reuses split off (and drop, since the
old program is not in 2017–2025):

- `24 06` (aviation-treaty obligations), `24 07` (France commodity assistance),
  `25 05` (IDP support), `29 05` (defence scientific research),
  `32 05` (educational-institution infrastructure), `27 02` (criminal-justice-system reform).

Kept merged as renames (same program, evolved name): `24 01` (economic policy),
`29 01` (defence readiness → management), `29 02` (military education), `32 02` (general
education), `32 04` (higher education), `35 02` (social protection), `35 03` (health),
`36 03` (energy → electricity-transmission lineage), `27 01` (penitentiary-system management).

## Known limitations / not applied (avoid touching 2017–2025)

- **Prosecutor's Office**: kept in `other_costs` (constitutionally independent since 2018), so
  2005's `პროკურატურა` stays in Other, consistent with 2019–2025.
- **2017 Environment ministry**: the 2017 ministry shares the 2014 name and currently sits in
  `other_costs`. The environment backfill fix is gated to pre-2017, so this pre-existing 2017
  classification is left untouched per the owner directive; revisit only if 2017–2025 changes
  are later authorized.
