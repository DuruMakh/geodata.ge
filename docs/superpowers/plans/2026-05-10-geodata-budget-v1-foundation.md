# GeoData.ge Budget V1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the repository, app scaffold, data schema, taxonomy files, mapping workflow, import validation report, and sample-data path needed before any public dashboard UI is implemented.

**Architecture:** Use a Next.js app in `apps/web` and keep durable project data files in root-level `data/*` directories. The foundation centers on stable IDs, reviewed mapping files, Prisma models, import validation, and testable data utilities so charts later read validated facts instead of ad-hoc mock data.

**Tech Stack:** Next.js App Router, TypeScript, npm, Prisma, Supabase Postgres, Vitest, Zod, csv-parse, Tailwind/shadcn later.

---

## Scope

This plan implements foundation only. It intentionally does not build the final explorer UI.

Included:

- Local git/GitHub setup.
- Repository hygiene rules for existing local planning/source/prototype files.
- App scaffold under `apps/web`.
- Root data directories for taxonomy, glossary, mappings, sources, sample imports, and import reports.
- Prisma schema for budget facts, public categories, source documents, mappings, and import runs.
- TypeScript validation utilities for taxonomy, glossary, mappings, CSV rows, and import reports.
- Sample data import path for 2025-2026.
- Verification commands.
- UTF-8 and Georgian label render checks for seed data.

Excluded from this plan:

- Final charts.
- Full production data for 2016-2026.
- Supabase production project provisioning.
- Public deployment.
- Auth/admin UI.
- Public API.

Follow-up plans:

- Plan 2: Main Explorer UI.
- Plan 3: Single-Year Snapshot UI.
- Plan 4: Production data ingestion and deployment.

## Data Content Safety

This plan creates seed taxonomy and glossary files so implementation can begin with stable IDs and validation. Georgian labels in these seed files are implementation seed labels, not final production-certified translations.

Before production data ingestion:

- Confirm Georgian labels against official source terminology.
- Verify UTF-8 rendering in source files, browser UI, import reports, and CSV exports.
- Keep stable IDs even if labels are corrected.
- Update glossary labels rather than hard-coding labels inside components.

## Repository Hygiene Decision

Before implementation starts, treat the current workspace files this way:

- Commit: `AGENTS.md`, `Project_Definition.md`, `docs/superpowers/specs/*`, `docs/superpowers/plans/*`, and the new app/data foundation files from this plan.
- Leave local-only/ignored for now: `.superpowers/`, `.tmp/`, `tools/`, `design.md`, `docs/Budget Data 2025/`, and `docs/Prototpy variatints experiments/`.
- Reason: those local files are useful planning/source/prototype material, but they are not yet curated product source. Committing Word/PDF/prototype artifacts now would make the repo noisy before we decide whether to use Git LFS, a separate source archive, or a cleaned data package.
- Revisit later: production data ingestion plan should decide which source files, reviewed workbooks, and derived datasets become tracked repo assets.

## Source Documents

Read before executing:

- `AGENTS.md`
- `Project_Definition.md`
- `docs/superpowers/specs/2026-05-10-geodata-budget-v1-design.md`

## File Structure

Create or modify these paths:

```text
.
|-- .editorconfig
|-- .env.example
|-- .gitignore
|-- README.md
|-- AGENTS.md
|-- Project_Definition.md
|-- data/
|   |-- glossary/
|   |   `-- category-glossary.csv
|   |-- imports/
|   |   `-- sample-budget-facts.csv
|   |-- mappings/
|   |   `-- spending-field-mapping.csv
|   |-- reports/
|   |   `-- .gitkeep
|   |-- sources/
|   |   `-- source-documents.csv
|   `-- taxonomy/
|       |-- revenue-categories.json
|       `-- spending-fields.json
`-- apps/
    `-- web/
        |-- app/
        |   |-- layout.tsx
        |   `-- page.tsx
        |-- lib/
        |   |-- data/
        |   |   |-- activeFacts.ts
        |   |   |-- csv.ts
        |   |   |-- glossary.ts
        |   |   |-- importBudgetFacts.ts
        |   |   |-- importReport.ts
        |   |   |-- mappings.ts
        |   |   |-- taxonomy.ts
        |   |   `-- validation.ts
        |   `-- db/
        |       `-- prisma.ts
        |-- prisma/
        |   `-- schema.prisma
        |-- scripts/
        |   |-- import-budget-facts.ts
        |   `-- validate-data-files.ts
        |-- tests/
        |   `-- data/
        |       |-- activeFacts.test.ts
        |       |-- glossary.test.ts
        |       |-- importBudgetFacts.test.ts
        |       |-- importReport.test.ts
        |       |-- mappings.test.ts
        |       `-- taxonomy.test.ts
        |-- package.json
        |-- tsconfig.json
        `-- vitest.config.ts
```

Responsibilities:

- `data/taxonomy/*`: stable public category IDs and labels.
- `data/glossary/category-glossary.csv`: Georgian-first public terminology.
- `data/mappings/spending-field-mapping.csv`: reviewed official row to public spending-field mapping.
- `data/imports/sample-budget-facts.csv`: small realistic sample import for tests and local development.
- `data/sources/source-documents.csv`: source metadata used by facts and CSV exports.
- `apps/web/lib/data/*`: pure validation/import/query logic. Keep these independent of React components.
- `apps/web/prisma/schema.prisma`: database schema.
- `apps/web/scripts/*`: CLI wrappers around tested library functions.

---

### Task 1: Initialize Repository Baseline and Hygiene

**Files:**

- Create: `.gitignore`
- Create: `.editorconfig`
- Create: `.env.example`
- Create: `README.md`
- Modify: existing planning docs only if links need correction.

- [ ] **Step 1: Confirm current git state**

Run:

```powershell
git status --short
```

Expected:

```text
fatal: not a git repository (or any of the parent directories): .git
```

- [ ] **Step 2: Initialize git**

Run:

```powershell
git init
```

Expected:

```text
Initialized empty Git repository
```

- [ ] **Step 3: Create `.gitignore`**

Create `.gitignore` with:

```gitignore
# dependencies
node_modules/
.pnpm-store/

# Next.js
.next/
out/
build/

# production
dist/

# environment
.env
.env.*
!.env.example

# logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# OS/editor
.DS_Store
Thumbs.db
.idea/
.vscode/

# generated reports
data/reports/*.json
data/reports/*.txt

# local-only planning/source/prototype material
.superpowers/
.tmp/
tools/
design.md
docs/Budget Data 2025/
docs/Prototpy variatints experiments/
```

- [ ] **Step 4: Create `.editorconfig`**

Create `.editorconfig` with:

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 5: Create `.env.example`**

Create `.env.example` with:

```ini
# App
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Supabase/Prisma Postgres
# Runtime pooled connection for serverless app queries.
DATABASE_URL=postgresql://USER:PASSWORD@HOST:6543/postgres?pgbouncer=true

# Direct/session connection for Prisma migrations.
DIRECT_URL=postgresql://USER:PASSWORD@HOST:5432/postgres

# Optional public Supabase client values for future read-only client features.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

- [ ] **Step 6: Create `README.md`**

Create `README.md` with:

```markdown
# GeoData.ge

GeoData.ge v1 is a Georgian-first Georgia Budget Explorer.

Read first:

- `AGENTS.md`
- `Project_Definition.md`
- `docs/superpowers/specs/2026-05-10-geodata-budget-v1-design.md`

V1 focuses on annual national budget data for 2016-2026, reviewed data ingestion, public spending-field taxonomy, revenue categories, CSV export, and clear budget visualizations.

## Development

The Next.js app lives in `apps/web`.

```powershell
cd apps/web
npm install
npm run dev
```

## Data Foundation

Root data files live under `data/`.

- `data/taxonomy`: stable public category IDs.
- `data/glossary`: Georgian-first labels.
- `data/mappings`: reviewed mappings from official rows to public spending fields.
- `data/imports`: reviewed import files and sample imports.
- `data/sources`: source document metadata.
- `data/reports`: generated internal import validation reports.
```

- [ ] **Step 7: Commit repository baseline**

Run:

```powershell
git status --short --ignored
```

Expected ignored entries include:

```text
!! .superpowers/
!! .tmp/
!! docs/Budget Data 2025/
!! docs/Prototpy variatints experiments/
!! tools/
!! design.md
```

Run:

```powershell
git add .gitignore .editorconfig .env.example README.md AGENTS.md Project_Definition.md docs/superpowers/specs/2026-05-10-geodata-budget-v1-design.md docs/superpowers/plans/2026-05-10-geodata-budget-v1-foundation.md
git commit -m "docs: establish geodata v1 project baseline"
```

Expected:

```text
[main (root-commit)
```

- [ ] **Step 8: Decide GitHub repository name and visibility**

Ask the user to confirm:

```text
Repository name: geodata.ge
Visibility: private
```

Expected user decision:

```text
Use geodata.ge as a private GitHub repository
```

If the user chooses a different name or public visibility, use that decision in the next step.

- [ ] **Step 9: Create GitHub repository**

Run:

```powershell
gh auth status
```

Expected:

```text
Logged in to github.com
```

Run:

```powershell
gh repo create geodata.ge --private --source=. --remote=origin --push
```

Expected:

```text
✓ Created repository
✓ Added remote
✓ Pushed commits to
```

If `gh auth status` fails, stop and ask the user to authenticate GitHub CLI before continuing.

---

### Task 2: Scaffold Next.js App in `apps/web`

**Files:**

- Create: `apps/web/*`
- Modify: `apps/web/package.json`
- Create: `apps/web/vitest.config.ts`

- [ ] **Step 1: Create the app scaffold**

Run:

```powershell
New-Item -ItemType Directory -Path apps -Force
npx create-next-app@latest apps/web --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --yes
```

Expected:

```text
Success! Created web
```

Context7 basis:

- Next.js current docs recommend `create-next-app@latest` for new projects and note that the default setup enables TypeScript, Tailwind, ESLint, App Router, Turbopack, and import alias support.

- [ ] **Step 2: Install foundation dependencies**

Run:

```powershell
cd apps/web
npm install @prisma/client zod csv-parse decimal.js
npm install -D prisma vitest tsx
```

Expected:

```text
added
found 0 vulnerabilities
```

- [ ] **Step 3: Update `apps/web/package.json` scripts**

Modify `apps/web/package.json` scripts to include:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "data:validate": "tsx scripts/validate-data-files.ts",
    "data:import": "tsx scripts/import-budget-facts.ts",
    "prisma:generate": "prisma generate --schema prisma/schema.prisma",
    "prisma:migrate": "prisma migrate dev"
  }
}
```

Preserve any additional scripts created by `create-next-app`. Do not force `next lint` if the generated app uses a different current lint command.

- [ ] **Step 4: Create `apps/web/vitest.config.ts`**

Create `apps/web/vitest.config.ts` with:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 5: Verify scaffold**

Before editing further, inspect generated `apps/web/package.json`.

Run:

```powershell
Get-Content apps/web/package.json
```

Expected:

```text
"dev"
"build"
"start"
```

If the generated script names or app structure differ substantially from this plan, stop and update the plan before continuing.

Run:

```powershell
cd apps/web
npm run build
```

Expected:

```text
Compiled successfully
```

- [ ] **Step 6: Commit scaffold**

Run:

```powershell
git add apps/web
git commit -m "chore: scaffold next app"
```

Expected:

```text
[main
```

---

### Task 3: Add Taxonomy, Glossary, Source, Mapping, and Sample Import Files

**Files:**

- Create: `data/taxonomy/revenue-categories.json`
- Create: `data/taxonomy/spending-fields.json`
- Create: `data/glossary/category-glossary.csv`
- Create: `data/mappings/spending-field-mapping.csv`
- Create: `data/sources/source-documents.csv`
- Create: `data/imports/sample-budget-facts.csv`
- Create: `data/reports/.gitkeep`

- [ ] **Step 0: Treat seed labels as provisional**

Use the JSON and CSV content in this task to create a working seed dataset. Do not treat these Georgian labels as final production source-confirmed terminology.

Expected implementation note:

```text
Stable IDs are authoritative. Seed Georgian labels must be verified before production data ingestion.
```

- [ ] **Step 1: Create data directories**

Run:

```powershell
New-Item -ItemType Directory -Path data\taxonomy,data\glossary,data\mappings,data\sources,data\imports,data\reports -Force
New-Item -ItemType File -Path data\reports\.gitkeep -Force
```

Expected:

```text
Directory:
```

- [ ] **Step 2: Create `data/taxonomy/revenue-categories.json`**

Create:

```json
[
  {
    "id": "revenue.vat",
    "side": "revenue",
    "level": "revenue_category",
    "kaLabel": "დამატებული ღირებულების გადასახადი",
    "enLabel": "VAT",
    "sortOrder": 10
  },
  {
    "id": "revenue.income_tax",
    "side": "revenue",
    "level": "revenue_category",
    "kaLabel": "საშემოსავლო გადასახადი",
    "enLabel": "Income tax",
    "sortOrder": 20
  },
  {
    "id": "revenue.profit_tax",
    "side": "revenue",
    "level": "revenue_category",
    "kaLabel": "მოგების გადასახადი",
    "enLabel": "Profit tax",
    "sortOrder": 30
  },
  {
    "id": "revenue.excise_tax",
    "side": "revenue",
    "level": "revenue_category",
    "kaLabel": "აქციზის გადასახადი",
    "enLabel": "Excise tax",
    "sortOrder": 40
  },
  {
    "id": "revenue.import_tax",
    "side": "revenue",
    "level": "revenue_category",
    "kaLabel": "იმპორტის გადასახადი",
    "enLabel": "Import tax",
    "sortOrder": 50
  },
  {
    "id": "revenue.property_tax",
    "side": "revenue",
    "level": "revenue_category",
    "kaLabel": "ქონების გადასახადი",
    "enLabel": "Property tax",
    "sortOrder": 60
  },
  {
    "id": "revenue.other_taxes",
    "side": "revenue",
    "level": "revenue_category",
    "kaLabel": "სხვა გადასახადები",
    "enLabel": "Other taxes",
    "sortOrder": 70
  },
  {
    "id": "revenue.grants",
    "side": "revenue",
    "level": "revenue_category",
    "kaLabel": "გრანტები",
    "enLabel": "Grants",
    "sortOrder": 80
  },
  {
    "id": "revenue.other_revenue",
    "side": "revenue",
    "level": "revenue_category",
    "kaLabel": "სხვა შემოსავლები",
    "enLabel": "Other revenue",
    "sortOrder": 90
  },
  {
    "id": "revenue.decrease_non_financial_assets",
    "side": "revenue",
    "level": "revenue_category",
    "kaLabel": "არაფინანსური აქტივების კლება",
    "enLabel": "Decrease in non-financial assets",
    "sortOrder": 100
  },
  {
    "id": "revenue.decrease_financial_assets",
    "side": "revenue",
    "level": "revenue_category",
    "kaLabel": "ფინანსური აქტივების კლება",
    "enLabel": "Decrease in financial assets",
    "sortOrder": 110
  },
  {
    "id": "revenue.increase_liabilities",
    "side": "revenue",
    "level": "revenue_category",
    "kaLabel": "ვალდებულებების ზრდა",
    "enLabel": "Increase in liabilities",
    "sortOrder": 120
  }
]
```

- [ ] **Step 3: Create `data/taxonomy/spending-fields.json`**

Create:

```json
[
  {
    "id": "spending.social_protection",
    "side": "expenditure",
    "level": "public_spending_field",
    "kaLabel": "სოციალური დაცვა",
    "enLabel": "Social protection",
    "sortOrder": 10
  },
  {
    "id": "spending.health",
    "side": "expenditure",
    "level": "public_spending_field",
    "kaLabel": "ჯანდაცვა",
    "enLabel": "Health",
    "sortOrder": 20
  },
  {
    "id": "spending.education",
    "side": "expenditure",
    "level": "public_spending_field",
    "kaLabel": "განათლება",
    "enLabel": "Education",
    "sortOrder": 30
  },
  {
    "id": "spending.defence",
    "side": "expenditure",
    "level": "public_spending_field",
    "kaLabel": "თავდაცვა",
    "enLabel": "Defence",
    "sortOrder": 40
  },
  {
    "id": "spending.public_order_safety",
    "side": "expenditure",
    "level": "public_spending_field",
    "kaLabel": "საზოგადოებრივი წესრიგი და უსაფრთხოება",
    "enLabel": "Public order and safety",
    "sortOrder": 50
  },
  {
    "id": "spending.infrastructure_regional_development",
    "side": "expenditure",
    "level": "public_spending_field",
    "kaLabel": "ინფრასტრუქტურა და რეგიონული განვითარება",
    "enLabel": "Infrastructure and regional development",
    "sortOrder": 60
  },
  {
    "id": "spending.economic_affairs",
    "side": "expenditure",
    "level": "public_spending_field",
    "kaLabel": "ეკონომიკური საქმიანობა",
    "enLabel": "Economic affairs",
    "sortOrder": 70
  },
  {
    "id": "spending.agriculture_environment",
    "side": "expenditure",
    "level": "public_spending_field",
    "kaLabel": "სოფლის მეურნეობა და გარემო",
    "enLabel": "Agriculture and environment",
    "sortOrder": 80
  },
  {
    "id": "spending.culture",
    "side": "expenditure",
    "level": "public_spending_field",
    "kaLabel": "კულტურა",
    "enLabel": "Culture",
    "sortOrder": 90
  },
  {
    "id": "spending.sport",
    "side": "expenditure",
    "level": "public_spending_field",
    "kaLabel": "სპორტი",
    "enLabel": "Sport",
    "sortOrder": 100
  },
  {
    "id": "spending.general_public_services",
    "side": "expenditure",
    "level": "public_spending_field",
    "kaLabel": "საერთო სახელმწიფო მომსახურება",
    "enLabel": "General public services",
    "sortOrder": 110
  },
  {
    "id": "spending.debt_service",
    "side": "expenditure",
    "level": "public_spending_field",
    "kaLabel": "ვალის მომსახურება",
    "enLabel": "Debt service",
    "sortOrder": 120
  },
  {
    "id": "spending.other_unclassified",
    "side": "expenditure",
    "level": "public_spending_field",
    "kaLabel": "სხვა / დაუკლასიფიცირებელი",
    "enLabel": "Other / unclassified",
    "sortOrder": 999
  }
]
```

- [ ] **Step 4: Create `data/glossary/category-glossary.csv`**

Create:

```csv
id,ka_label,en_label,description,notes
spending.social_protection,სოციალური დაცვა,Social protection,Public spending field for social protection and welfare programs,Review mappings against official program rows
spending.health,ჯანდაცვა,Health,Public spending field for health-related spending,Review mixed health/social programs carefully
spending.education,განათლება,Education,Public spending field for education-related spending,Use for education programs and institutions
spending.defence,თავდაცვა,Defence,Public spending field for defence-related spending,Use for defence budget rows
spending.public_order_safety,საზოგადოებრივი წესრიგი და უსაფრთხოება,Public order and safety,Public spending field for public order and safety,Use for police/security/justice rows where appropriate
spending.infrastructure_regional_development,ინფრასტრუქტურა და რეგიონული განვითარება,Infrastructure and regional development,Public spending field for infrastructure and regional development,Review municipal-transfer boundary before future versions
spending.economic_affairs,ეკონომიკური საქმიანობა,Economic affairs,Public spending field for economic affairs,Use for economy/business/support programs
spending.agriculture_environment,სოფლის მეურნეობა და გარემო,Agriculture and environment,Public spending field for agriculture and environment,User-approved combined category
spending.culture,კულტურა,Culture,Public spending field for culture,Separated from sport by user decision
spending.sport,სპორტი,Sport,Public spending field for sport,Separated from culture by user decision
spending.general_public_services,საერთო სახელმწიფო მომსახურება,General public services,Public spending field for general public services,Review debt rows separately
spending.debt_service,ვალის მომსახურება,Debt service,Public spending field for debt service expenditure,Separate field; not a debt explorer
spending.other_unclassified,სხვა / დაუკლასიფიცირებელი,Other / unclassified,Explicit bucket for rows not confidently mapped,No rows may disappear silently
revenue.vat,დამატებული ღირებულების გადასახადი,VAT,Top-level revenue category,Source-confirmed label
revenue.income_tax,საშემოსავლო გადასახადი,Income tax,Top-level revenue category,Source-confirmed label
revenue.profit_tax,მოგების გადასახადი,Profit tax,Top-level revenue category,Source-confirmed label
revenue.excise_tax,აქციზის გადასახადი,Excise tax,Top-level revenue category,Source-confirmed label
revenue.import_tax,იმპორტის გადასახადი,Import tax,Top-level revenue category,Source-confirmed label
revenue.property_tax,ქონების გადასახადი,Property tax,Top-level revenue category,Source-confirmed label
revenue.other_taxes,სხვა გადასახადები,Other taxes,Top-level revenue category,Source-confirmed label
revenue.grants,გრანტები,Grants,Top-level revenue category,Source-confirmed label
revenue.other_revenue,სხვა შემოსავლები,Other revenue,Top-level revenue category,Source-confirmed label
revenue.decrease_non_financial_assets,არაფინანსური აქტივების კლება,Decrease in non-financial assets,Top-level revenue category,Confirm against source before production
revenue.decrease_financial_assets,ფინანსური აქტივების კლება,Decrease in financial assets,Top-level revenue category,Confirm against source before production
revenue.increase_liabilities,ვალდებულებების ზრდა,Increase in liabilities,Top-level revenue category,Confirm against source before production
```

- [ ] **Step 5: Create `data/sources/source-documents.csv`**

Create:

```csv
source_id,source_name,source_url_or_file,last_reviewed_at
source.mof_2025_execution,Reviewed official 2025 budget execution documents,docs/Budget Data 2025,2026-05-10
source.mof_2026_plan,Reviewed official 2026 planned budget documents,docs/Budget Data 2025,2026-05-10
```

- [ ] **Step 6: Verify UTF-8 rendering of seed Georgian labels**

Run:

```powershell
Get-Content -Path data\taxonomy\revenue-categories.json -Encoding UTF8 | Select-String -Pattern "აქციზის გადასახადი"
Get-Content -Path data\taxonomy\spending-fields.json -Encoding UTF8 | Select-String -Pattern "ჯანდაცვა"
Get-Content -Path data\glossary\category-glossary.csv -Encoding UTF8 | Select-String -Pattern "სოფლის მეურნეობა"
```

Expected:

```text
აქციზის გადასახადი
ჯანდაცვა
სოფლის მეურნეობა
```

If the output shows mojibake such as `áƒ`, stop and fix file encoding before continuing.

- [ ] **Step 7: Create `data/mappings/spending-field-mapping.csv`**

Create:

```csv
year,official_institution,official_program,official_subprogram,public_spending_field_id,mapping_confidence,mapping_notes
2025,Ministry of Internally Displaced Persons Labour Health and Social Affairs,Healthcare program,,spending.health,high,Sample row for foundation validation
2025,Ministry of Education Science and Youth,General education program,,spending.education,high,Sample row for foundation validation
2026,Ministry of Internally Displaced Persons Labour Health and Social Affairs,Social protection program,,spending.social_protection,medium,Sample row; review final source mapping
```

- [ ] **Step 8: Create `data/imports/sample-budget-facts.csv`**

Create:

```csv
year,side,item_id,amount_gel,basis,source_id,official_institution,official_program,official_subprogram,public_spending_field_id,mapping_confidence,mapping_notes
2025,expenditure,spending.health,5200000000,actual,source.mof_2025_execution,Ministry of Internally Displaced Persons Labour Health and Social Affairs,Healthcare program,,spending.health,high,Sample expenditure row
2025,expenditure,spending.education,4500000000,actual,source.mof_2025_execution,Ministry of Education Science and Youth,General education program,,spending.education,high,Sample expenditure row
2025,revenue,revenue.vat,7800000000,actual,source.mof_2025_execution,,,,,,Sample revenue row
2025,revenue,revenue.income_tax,6200000000,actual,source.mof_2025_execution,,,,,,Sample revenue row
2026,expenditure,spending.social_protection,8100000000,planned,source.mof_2026_plan,Ministry of Internally Displaced Persons Labour Health and Social Affairs,Social protection program,,spending.social_protection,medium,Sample planned row
2026,revenue,revenue.vat,8500000000,planned,source.mof_2026_plan,,,,,,Sample planned revenue row
```

- [ ] **Step 9: Commit data foundation files**

Run:

```powershell
git add data
git commit -m "data: add v1 taxonomy and sample import files"
```

Expected:

```text
[main
```

---

### Task 4: Add Prisma Schema and Database Client

**Files:**

- Create: `apps/web/prisma/schema.prisma`
- Create: `apps/web/lib/db/prisma.ts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Initialize Prisma**

Run:

```powershell
cd apps/web
npx prisma init
```

Expected:

```text
✔ Your Prisma schema was created
```

- [ ] **Step 2: Replace `apps/web/prisma/schema.prisma`**

Use this schema:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

enum BudgetSide {
  revenue
  expenditure
}

enum BudgetBasis {
  actual
  planned
}

enum BudgetItemLevel {
  total
  revenue_category
  public_spending_field
  institution
  program
  subprogram
}

enum MappingConfidence {
  high
  medium
  low
  unclassified
}

model BudgetItem {
  id          String          @id
  side        BudgetSide
  level       BudgetItemLevel
  parentId    String?
  parent      BudgetItem?     @relation("BudgetItemHierarchy", fields: [parentId], references: [id])
  children    BudgetItem[]    @relation("BudgetItemHierarchy")
  kaLabel     String
  enLabel     String
  sortOrder   Int             @default(999)
  active      Boolean         @default(true)
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
  facts       BudgetFact[]
  mappings    BudgetMapping[] @relation("PublicSpendingField")

  @@index([side, level])
  @@index([parentId])
}

model SourceDocument {
  id              String       @id
  sourceName      String
  sourceUrlOrFile String
  lastReviewedAt  DateTime
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  facts           BudgetFact[]
}

model ImportRun {
  id                       String          @id @default(cuid())
  importLabel              String
  importedAt               DateTime        @default(now())
  rowsRead                 Int
  rowsImported             Int
  totalRevenueGel          Decimal         @db.Decimal(18, 2)
  totalExpenditureGel      Decimal         @db.Decimal(18, 2)
  unclassifiedAmountGel    Decimal         @db.Decimal(18, 2)
  unclassifiedShare        Decimal         @db.Decimal(9, 6)
  plannedRows              Int
  actualRows               Int
  reconciliationStatus     String
  warningsJson             Json
  facts                    BudgetFact[]
}

model BudgetMapping {
  id                    String            @id @default(cuid())
  year                  Int
  officialInstitution   String
  officialProgram       String?
  officialSubprogram    String?
  publicSpendingFieldId String
  publicSpendingField   BudgetItem        @relation("PublicSpendingField", fields: [publicSpendingFieldId], references: [id])
  confidence            MappingConfidence
  notes                 String
  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt

  @@index([year])
  @@index([publicSpendingFieldId])
}

model BudgetFact {
  id                    String             @id @default(cuid())
  year                  Int
  side                  BudgetSide
  itemId                String
  item                  BudgetItem         @relation(fields: [itemId], references: [id])
  amountGel             Decimal            @db.Decimal(18, 2)
  basis                 BudgetBasis
  sourceDocumentId      String
  sourceDocument        SourceDocument     @relation(fields: [sourceDocumentId], references: [id])
  importRunId           String?
  importRun             ImportRun?         @relation(fields: [importRunId], references: [id])
  officialInstitution   String?
  officialProgram       String?
  officialSubprogram    String?
  publicSpendingFieldId String?
  mappingConfidence     MappingConfidence?
  mappingNotes          String?
  activePublicValue     Boolean            @default(true)
  createdAt             DateTime           @default(now())
  updatedAt             DateTime           @updatedAt

  @@index([year, side])
  @@index([itemId])
  @@index([basis])
  @@index([activePublicValue])
}
```

Context7 basis:

- Prisma docs show `datasource db { provider = "postgresql"; url = env("DATABASE_URL") }`.
- Supabase docs recommend `DATABASE_URL` for pooled runtime connections and `DIRECT_URL` for Prisma migrations.

- [ ] **Step 3: Create `apps/web/.env` for local Prisma generate only**

Create `apps/web/.env` with temporary local development values:

```ini
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/geodata"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/geodata"
```

This file is ignored by root `.gitignore`. These values are temporary for client generation and local development only. Real Supabase credentials must not be committed.

- [ ] **Step 4: Create `apps/web/lib/db/prisma.ts`**

Create:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 5: Generate Prisma Client**

Run:

```powershell
cd apps/web
npx prisma generate
```

Expected:

```text
Generated Prisma Client
```

- [ ] **Step 6: Commit Prisma foundation**

Run:

```powershell
git add apps/web/prisma apps/web/lib/db apps/web/package.json apps/web/package-lock.json
git commit -m "feat: add prisma budget schema"
```

Expected:

```text
[main
```

---

### Task 5: Implement Taxonomy and Glossary Validation

**Files:**

- Create: `apps/web/lib/data/validation.ts`
- Create: `apps/web/lib/data/csv.ts`
- Create: `apps/web/lib/data/taxonomy.ts`
- Create: `apps/web/lib/data/glossary.ts`
- Create: `apps/web/tests/data/taxonomy.test.ts`
- Create: `apps/web/tests/data/glossary.test.ts`

- [ ] **Step 1: Write failing taxonomy tests**

Create `apps/web/tests/data/taxonomy.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { loadTaxonomyFiles, validateStableId } from "../../lib/data/taxonomy";

describe("taxonomy validation", () => {
  it("loads v1 revenue and spending taxonomy files", async () => {
    const taxonomy = await loadTaxonomyFiles("../../data/taxonomy");

    expect(taxonomy.map((item) => item.id)).toContain("revenue.vat");
    expect(taxonomy.map((item) => item.id)).toContain("spending.health");
  });

  it("accepts stable dot-namespaced ASCII IDs", () => {
    expect(validateStableId("revenue.excise_tax")).toBe(true);
    expect(validateStableId("spending.social_protection")).toBe(true);
  });

  it("rejects labels or invalid IDs as identifiers", () => {
    expect(validateStableId("ჯანდაცვა")).toBe(false);
    expect(validateStableId("Revenue VAT")).toBe(false);
    expect(validateStableId("revenue-vat")).toBe(false);
  });
});
```

- [ ] **Step 2: Write failing glossary tests**

Create `apps/web/tests/data/glossary.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { loadGlossary } from "../../lib/data/glossary";

describe("glossary validation", () => {
  it("loads Georgian-first labels for public categories", async () => {
    const glossary = await loadGlossary("../../data/glossary/category-glossary.csv");

    expect(glossary.get("revenue.excise_tax")?.kaLabel).toBe("აქციზის გადასახადი");
    expect(glossary.get("spending.agriculture_environment")?.enLabel).toBe(
      "Agriculture and environment",
    );
  });

  it("keeps labels separate from stable IDs", async () => {
    const glossary = await loadGlossary("../../data/glossary/category-glossary.csv");
    const health = glossary.get("spending.health");

    expect(health?.id).toBe("spending.health");
    expect(health?.kaLabel).toBe("ჯანდაცვა");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```powershell
cd apps/web
npm test -- tests/data/taxonomy.test.ts tests/data/glossary.test.ts
```

Expected:

```text
Cannot find module '../../lib/data/taxonomy'
```

- [ ] **Step 4: Implement shared validation helpers**

Create `apps/web/lib/data/validation.ts`:

```typescript
import { z } from "zod";

export const stableIdSchema = z
  .string()
  .regex(/^[a-z]+(\.[a-z0-9_]+)+$/, "Use lowercase ASCII dot-namespaced IDs");

export function isStableId(value: string): boolean {
  return stableIdSchema.safeParse(value).success;
}

export function requireStableId(value: string): string {
  return stableIdSchema.parse(value);
}

export function requireNonEmpty(value: string, fieldName: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new Error(`${fieldName} is required`);
  }

  return trimmed;
}
```

- [ ] **Step 5: Implement CSV loader**

Create `apps/web/lib/data/csv.ts`:

```typescript
import { parse } from "csv-parse/sync";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type CsvRecord = Record<string, string>;

export async function readCsvRecords(relativePath: string): Promise<CsvRecord[]> {
  const filePath = path.resolve(process.cwd(), relativePath);
  const content = await readFile(filePath, "utf8");

  return parse(content, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRecord[];
}
```

- [ ] **Step 6: Implement taxonomy loader**

Create `apps/web/lib/data/taxonomy.ts`:

```typescript
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { isStableId, stableIdSchema } from "./validation";

const taxonomyItemSchema = z.object({
  id: stableIdSchema,
  side: z.enum(["revenue", "expenditure"]),
  level: z.enum(["revenue_category", "public_spending_field"]),
  kaLabel: z.string().min(1),
  enLabel: z.string().min(1),
  sortOrder: z.number().int().positive(),
});

export type TaxonomyItem = z.infer<typeof taxonomyItemSchema>;

export function validateStableId(value: string): boolean {
  return isStableId(value);
}

async function readTaxonomyFile(filePath: string): Promise<TaxonomyItem[]> {
  const content = await readFile(filePath, "utf8");
  const parsed = JSON.parse(content) as unknown;

  return z.array(taxonomyItemSchema).parse(parsed);
}

export async function loadTaxonomyFiles(relativeDirectory: string): Promise<TaxonomyItem[]> {
  const directory = path.resolve(process.cwd(), relativeDirectory);
  const revenue = await readTaxonomyFile(path.join(directory, "revenue-categories.json"));
  const spending = await readTaxonomyFile(path.join(directory, "spending-fields.json"));
  const combined = [...revenue, ...spending];
  const ids = new Set<string>();

  for (const item of combined) {
    if (ids.has(item.id)) {
      throw new Error(`Duplicate taxonomy ID: ${item.id}`);
    }
    ids.add(item.id);
  }

  return combined.sort((a, b) => a.sortOrder - b.sortOrder);
}
```

- [ ] **Step 7: Implement glossary loader**

Create `apps/web/lib/data/glossary.ts`:

```typescript
import { z } from "zod";
import { readCsvRecords } from "./csv";
import { stableIdSchema } from "./validation";

const glossaryRowSchema = z.object({
  id: stableIdSchema,
  ka_label: z.string().min(1),
  en_label: z.string().min(1),
  description: z.string().min(1),
  notes: z.string(),
});

export type GlossaryEntry = {
  id: string;
  kaLabel: string;
  enLabel: string;
  description: string;
  notes: string;
};

export async function loadGlossary(relativePath: string): Promise<Map<string, GlossaryEntry>> {
  const records = await readCsvRecords(relativePath);
  const glossary = new Map<string, GlossaryEntry>();

  for (const record of records) {
    const row = glossaryRowSchema.parse(record);

    if (glossary.has(row.id)) {
      throw new Error(`Duplicate glossary ID: ${row.id}`);
    }

    glossary.set(row.id, {
      id: row.id,
      kaLabel: row.ka_label,
      enLabel: row.en_label,
      description: row.description,
      notes: row.notes,
    });
  }

  return glossary;
}
```

- [ ] **Step 8: Run tests**

Run:

```powershell
cd apps/web
npm test -- tests/data/taxonomy.test.ts tests/data/glossary.test.ts
```

Expected:

```text
2 passed
```

- [ ] **Step 9: Commit taxonomy/glossary validation**

Run:

```powershell
git add apps/web/lib/data apps/web/tests/data
git commit -m "test: validate taxonomy and glossary files"
```

Expected:

```text
[main
```

---

### Task 6: Implement Mapping Validation

**Files:**

- Create: `apps/web/lib/data/mappings.ts`
- Create: `apps/web/tests/data/mappings.test.ts`

- [ ] **Step 1: Write failing mapping tests**

Create `apps/web/tests/data/mappings.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { loadSpendingMappings } from "../../lib/data/mappings";

describe("spending mapping validation", () => {
  it("loads reviewed mappings with confidence and notes", async () => {
    const mappings = await loadSpendingMappings("../../data/mappings/spending-field-mapping.csv");

    expect(mappings[0]).toMatchObject({
      year: 2025,
      publicSpendingFieldId: "spending.health",
      mappingConfidence: "high",
    });
  });

  it("requires rows to map to spending.* IDs", async () => {
    await expect(
      loadSpendingMappings("../../data/mappings/spending-field-mapping.csv"),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ publicSpendingFieldId: "spending.education" }),
      ]),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
cd apps/web
npm test -- tests/data/mappings.test.ts
```

Expected:

```text
Cannot find module '../../lib/data/mappings'
```

- [ ] **Step 3: Implement mapping loader**

Create `apps/web/lib/data/mappings.ts`:

```typescript
import { z } from "zod";
import { readCsvRecords } from "./csv";
import { requireNonEmpty, stableIdSchema } from "./validation";

const mappingConfidenceSchema = z.enum(["high", "medium", "low", "unclassified"]);

const mappingRowSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  official_institution: z.string().min(1),
  official_program: z.string(),
  official_subprogram: z.string(),
  public_spending_field_id: stableIdSchema.refine((value) => value.startsWith("spending."), {
    message: "Spending mappings must use spending.* IDs",
  }),
  mapping_confidence: mappingConfidenceSchema,
  mapping_notes: z.string(),
});

export type SpendingMapping = {
  year: number;
  officialInstitution: string;
  officialProgram: string | null;
  officialSubprogram: string | null;
  publicSpendingFieldId: string;
  mappingConfidence: z.infer<typeof mappingConfidenceSchema>;
  mappingNotes: string;
};

export async function loadSpendingMappings(relativePath: string): Promise<SpendingMapping[]> {
  const records = await readCsvRecords(relativePath);

  return records.map((record) => {
    const row = mappingRowSchema.parse(record);

    return {
      year: row.year,
      officialInstitution: requireNonEmpty(row.official_institution, "official_institution"),
      officialProgram: row.official_program.trim() || null,
      officialSubprogram: row.official_subprogram.trim() || null,
      publicSpendingFieldId: row.public_spending_field_id,
      mappingConfidence: row.mapping_confidence,
      mappingNotes: row.mapping_notes,
    };
  });
}
```

- [ ] **Step 4: Run mapping tests**

Run:

```powershell
cd apps/web
npm test -- tests/data/mappings.test.ts
```

Expected:

```text
1 passed
```

- [ ] **Step 5: Commit mapping validation**

Run:

```powershell
git add apps/web/lib/data/mappings.ts apps/web/tests/data/mappings.test.ts
git commit -m "test: validate spending mappings"
```

Expected:

```text
[main
```

---

### Task 7: Implement Import Validation and Report Generation

**Files:**

- Create: `apps/web/lib/data/importBudgetFacts.ts`
- Create: `apps/web/lib/data/importReport.ts`
- Create: `apps/web/tests/data/importBudgetFacts.test.ts`
- Create: `apps/web/tests/data/importReport.test.ts`

- [ ] **Step 1: Write failing import tests**

Create `apps/web/tests/data/importBudgetFacts.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { loadBudgetFactRows } from "../../lib/data/importBudgetFacts";

describe("budget fact import validation", () => {
  it("loads sample budget facts with actual and planned basis", async () => {
    const rows = await loadBudgetFactRows("../../data/imports/sample-budget-facts.csv");

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          year: 2025,
          side: "expenditure",
          itemId: "spending.health",
          basis: "actual",
        }),
        expect.objectContaining({
          year: 2026,
          side: "revenue",
          itemId: "revenue.vat",
          basis: "planned",
        }),
      ]),
    );
  });

  it("keeps unmapped expenditure visible through explicit public field IDs", async () => {
    const rows = await loadBudgetFactRows("../../data/imports/sample-budget-facts.csv");
    const expenditureRows = rows.filter((row) => row.side === "expenditure");

    expect(expenditureRows.every((row) => row.publicSpendingFieldId)).toBe(true);
  });
});
```

- [ ] **Step 2: Write failing report tests**

Create `apps/web/tests/data/importReport.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { buildImportReport } from "../../lib/data/importReport";
import { loadBudgetFactRows } from "../../lib/data/importBudgetFacts";

describe("import validation report", () => {
  it("summarizes rows, basis counts, and totals", async () => {
    const rows = await loadBudgetFactRows("../../data/imports/sample-budget-facts.csv");
    const report = buildImportReport("sample import", rows);

    expect(report.rowsRead).toBe(6);
    expect(report.rowsImported).toBe(6);
    expect(report.actualRows).toBe(4);
    expect(report.plannedRows).toBe(2);
    expect(report.totalRevenueGel).toBe(22500000000);
    expect(report.totalExpenditureGel).toBe(17800000000);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```powershell
cd apps/web
npm test -- tests/data/importBudgetFacts.test.ts tests/data/importReport.test.ts
```

Expected:

```text
Cannot find module '../../lib/data/importBudgetFacts'
```

- [ ] **Step 4: Implement import row loader**

Create `apps/web/lib/data/importBudgetFacts.ts`:

```typescript
import Decimal from "decimal.js";
import { z } from "zod";
import { readCsvRecords } from "./csv";
import { stableIdSchema } from "./validation";

const basisSchema = z.enum(["actual", "planned"]);
const sideSchema = z.enum(["revenue", "expenditure"]);
const confidenceSchema = z.enum(["high", "medium", "low", "unclassified"]).or(z.literal(""));

const importRowSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  side: sideSchema,
  item_id: stableIdSchema,
  amount_gel: z.string().min(1),
  basis: basisSchema,
  source_id: stableIdSchema,
  official_institution: z.string(),
  official_program: z.string(),
  official_subprogram: z.string(),
  public_spending_field_id: z.string(),
  mapping_confidence: confidenceSchema,
  mapping_notes: z.string(),
});

export type BudgetFactImportRow = {
  year: number;
  side: "revenue" | "expenditure";
  itemId: string;
  amountGel: number;
  basis: "actual" | "planned";
  sourceId: string;
  officialInstitution: string | null;
  officialProgram: string | null;
  officialSubprogram: string | null;
  publicSpendingFieldId: string | null;
  mappingConfidence: "high" | "medium" | "low" | "unclassified" | null;
  mappingNotes: string;
};

function parseAmountGel(value: string): number {
  const amount = new Decimal(value);

  if (amount.isNegative()) {
    throw new Error(`amount_gel must not be negative: ${value}`);
  }

  return amount.toNumber();
}

export async function loadBudgetFactRows(relativePath: string): Promise<BudgetFactImportRow[]> {
  const records = await readCsvRecords(relativePath);

  return records.map((record) => {
    const row = importRowSchema.parse(record);
    const publicSpendingFieldId = row.public_spending_field_id.trim() || null;

    if (row.side === "expenditure" && !publicSpendingFieldId) {
      throw new Error(`Expenditure row ${row.item_id} must have a public_spending_field_id`);
    }

    if (row.side === "revenue" && !row.item_id.startsWith("revenue.")) {
      throw new Error(`Revenue row must use revenue.* item_id: ${row.item_id}`);
    }

    if (row.side === "expenditure" && !row.item_id.startsWith("spending.")) {
      throw new Error(`Expenditure row must use spending.* item_id: ${row.item_id}`);
    }

    return {
      year: row.year,
      side: row.side,
      itemId: row.item_id,
      amountGel: parseAmountGel(row.amount_gel),
      basis: row.basis,
      sourceId: row.source_id,
      officialInstitution: row.official_institution.trim() || null,
      officialProgram: row.official_program.trim() || null,
      officialSubprogram: row.official_subprogram.trim() || null,
      publicSpendingFieldId,
      mappingConfidence: row.mapping_confidence === "" ? null : row.mapping_confidence,
      mappingNotes: row.mapping_notes,
    };
  });
}
```

- [ ] **Step 5: Implement import report**

Create `apps/web/lib/data/importReport.ts`:

```typescript
import type { BudgetFactImportRow } from "./importBudgetFacts";

export type ImportReport = {
  importLabel: string;
  rowsRead: number;
  rowsImported: number;
  totalRevenueGel: number;
  totalExpenditureGel: number;
  unclassifiedAmountGel: number;
  unclassifiedShare: number;
  plannedRows: number;
  actualRows: number;
  reconciliationStatus: "passed" | "warning";
  warnings: string[];
};

export function buildImportReport(
  importLabel: string,
  rows: BudgetFactImportRow[],
): ImportReport {
  const totalRevenueGel = rows
    .filter((row) => row.side === "revenue")
    .reduce((sum, row) => sum + row.amountGel, 0);
  const totalExpenditureGel = rows
    .filter((row) => row.side === "expenditure")
    .reduce((sum, row) => sum + row.amountGel, 0);
  const unclassifiedAmountGel = rows
    .filter((row) => row.publicSpendingFieldId === "spending.other_unclassified")
    .reduce((sum, row) => sum + row.amountGel, 0);
  const plannedRows = rows.filter((row) => row.basis === "planned").length;
  const actualRows = rows.filter((row) => row.basis === "actual").length;
  const warnings: string[] = [];

  if (unclassifiedAmountGel > 0) {
    warnings.push(`${unclassifiedAmountGel} GEL assigned to Other / unclassified`);
  }

  return {
    importLabel,
    rowsRead: rows.length,
    rowsImported: rows.length,
    totalRevenueGel,
    totalExpenditureGel,
    unclassifiedAmountGel,
    unclassifiedShare:
      totalExpenditureGel === 0 ? 0 : unclassifiedAmountGel / totalExpenditureGel,
    plannedRows,
    actualRows,
    reconciliationStatus: warnings.length === 0 ? "passed" : "warning",
    warnings,
  };
}
```

- [ ] **Step 6: Run import tests**

Run:

```powershell
cd apps/web
npm test -- tests/data/importBudgetFacts.test.ts tests/data/importReport.test.ts
```

Expected:

```text
2 passed
```

- [ ] **Step 7: Commit import validation**

Run:

```powershell
git add apps/web/lib/data/importBudgetFacts.ts apps/web/lib/data/importReport.ts apps/web/tests/data/importBudgetFacts.test.ts apps/web/tests/data/importReport.test.ts
git commit -m "test: validate budget fact imports"
```

Expected:

```text
[main
```

---

### Task 8: Add Data Validation and Import Scripts

**Files:**

- Create: `apps/web/scripts/validate-data-files.ts`
- Create: `apps/web/scripts/import-budget-facts.ts`

- [ ] **Step 1: Create validation script**

Create `apps/web/scripts/validate-data-files.ts`:

```typescript
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { loadGlossary } from "../lib/data/glossary";
import { loadBudgetFactRows } from "../lib/data/importBudgetFacts";
import { buildImportReport } from "../lib/data/importReport";
import { loadSpendingMappings } from "../lib/data/mappings";
import { loadTaxonomyFiles } from "../lib/data/taxonomy";

async function main() {
  const taxonomy = await loadTaxonomyFiles("../../data/taxonomy");
  const glossary = await loadGlossary("../../data/glossary/category-glossary.csv");
  const mappings = await loadSpendingMappings("../../data/mappings/spending-field-mapping.csv");
  const facts = await loadBudgetFactRows("../../data/imports/sample-budget-facts.csv");
  const report = buildImportReport("sample-budget-facts", facts);
  const missingGlossary = taxonomy.filter((item) => !glossary.has(item.id));

  if (missingGlossary.length > 0) {
    throw new Error(`Missing glossary rows: ${missingGlossary.map((item) => item.id).join(", ")}`);
  }

  const reportPath = path.resolve(
    process.cwd(),
    "../../data/reports/sample-budget-facts-report.json",
  );

  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log(`Validated taxonomy rows: ${taxonomy.length}`);
  console.log(`Validated glossary rows: ${glossary.size}`);
  console.log(`Validated mapping rows: ${mappings.length}`);
  console.log(`Validated fact rows: ${facts.length}`);
  console.log(`Report written: ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Create import script stub**

Create `apps/web/scripts/import-budget-facts.ts`:

```typescript
import { loadBudgetFactRows } from "../lib/data/importBudgetFacts";
import { buildImportReport } from "../lib/data/importReport";

async function main() {
  const rows = await loadBudgetFactRows("../../data/imports/sample-budget-facts.csv");
  const report = buildImportReport("sample-budget-facts", rows);

  console.log(JSON.stringify(report, null, 2));
  console.log("Database insert is intentionally deferred until Supabase DATABASE_URL is configured.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 3: Run validation script**

Run:

```powershell
cd apps/web
npm run data:validate
```

Expected:

```text
Validated taxonomy rows: 25
Validated glossary rows: 25
Validated mapping rows: 3
Validated fact rows: 6
Report written:
```

- [ ] **Step 4: Run import script stub**

Run:

```powershell
cd apps/web
npm run data:import
```

Expected:

```text
"rowsRead": 6
"rowsImported": 6
Database insert is intentionally deferred until Supabase DATABASE_URL is configured.
```

- [ ] **Step 5: Commit scripts**

Run:

```powershell
git add apps/web/scripts data/reports/.gitkeep
git commit -m "feat: add data validation scripts"
```

Expected:

```text
[main
```

---

### Task 9: Add Active Public Fact Selection Logic

**Files:**

- Create: `apps/web/lib/data/activeFacts.ts`
- Create: `apps/web/tests/data/activeFacts.test.ts`

- [ ] **Step 1: Write failing tests for planned vs actual**

Create `apps/web/tests/data/activeFacts.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { chooseActivePublicFacts } from "../../lib/data/activeFacts";
import type { BudgetFactImportRow } from "../../lib/data/importBudgetFacts";

describe("active public fact selection", () => {
  it("uses actual when planned and actual exist for the same item and year", () => {
    const rows: BudgetFactImportRow[] = [
      {
        year: 2026,
        side: "revenue",
        itemId: "revenue.vat",
        amountGel: 800,
        basis: "planned",
        sourceId: "source.mof_2026_plan",
        officialInstitution: null,
        officialProgram: null,
        officialSubprogram: null,
        publicSpendingFieldId: null,
        mappingConfidence: null,
        mappingNotes: "",
      },
      {
        year: 2026,
        side: "revenue",
        itemId: "revenue.vat",
        amountGel: 900,
        basis: "actual",
        sourceId: "source.mof_2026_actual",
        officialInstitution: null,
        officialProgram: null,
        officialSubprogram: null,
        publicSpendingFieldId: null,
        mappingConfidence: null,
        mappingNotes: "",
      },
    ];

    const active = chooseActivePublicFacts(rows);

    expect(active).toHaveLength(1);
    expect(active[0]?.basis).toBe("actual");
    expect(active[0]?.amountGel).toBe(900);
  });

  it("keeps planned when no actual exists", () => {
    const rows: BudgetFactImportRow[] = [
      {
        year: 2026,
        side: "expenditure",
        itemId: "spending.health",
        amountGel: 500,
        basis: "planned",
        sourceId: "source.mof_2026_plan",
        officialInstitution: "Health institution",
        officialProgram: "Health program",
        officialSubprogram: null,
        publicSpendingFieldId: "spending.health",
        mappingConfidence: "high",
        mappingNotes: "",
      },
    ];

    expect(chooseActivePublicFacts(rows)[0]?.basis).toBe("planned");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
cd apps/web
npm test -- tests/data/activeFacts.test.ts
```

Expected:

```text
Cannot find module '../../lib/data/activeFacts'
```

- [ ] **Step 3: Implement active fact selection**

Create `apps/web/lib/data/activeFacts.ts`:

```typescript
import type { BudgetFactImportRow } from "./importBudgetFacts";

function keyFor(row: BudgetFactImportRow): string {
  return `${row.year}:${row.side}:${row.itemId}`;
}

export function chooseActivePublicFacts(
  rows: BudgetFactImportRow[],
): BudgetFactImportRow[] {
  const byKey = new Map<string, BudgetFactImportRow>();

  for (const row of rows) {
    const key = keyFor(row);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, row);
      continue;
    }

    if (existing.basis === "planned" && row.basis === "actual") {
      byKey.set(key, row);
    }
  }

  return Array.from(byKey.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.itemId.localeCompare(b.itemId);
  });
}
```

- [ ] **Step 4: Run tests**

Run:

```powershell
cd apps/web
npm test -- tests/data/activeFacts.test.ts
```

Expected:

```text
2 passed
```

- [ ] **Step 5: Commit active fact selection**

Run:

```powershell
git add apps/web/lib/data/activeFacts.ts apps/web/tests/data/activeFacts.test.ts
git commit -m "test: select active planned and actual facts"
```

Expected:

```text
[main
```

---

### Task 10: Verify UTF-8 Georgian Labels and Full Foundation

**Files:**

- Modify: `README.md`
- Verify: `data/glossary/category-glossary.csv`
- Verify: `data/taxonomy/revenue-categories.json`
- Verify: `data/taxonomy/spending-fields.json`

- [ ] **Step 1: Add UTF-8 verification note to README**

Append to `README.md`:

```markdown
## Encoding

All source files containing Georgian text must be UTF-8.

Before importing or exporting data, verify Georgian labels render correctly in:

- source files under `data/`
- import reports under `data/reports/`
- browser UI
- CSV exports opened in spreadsheet software
```

- [ ] **Step 2: Run all foundation tests**

Run:

```powershell
cd apps/web
npm test
```

Expected:

```text
passed
```

- [ ] **Step 3: Run data validation**

Run:

```powershell
cd apps/web
npm run data:validate
```

Expected:

```text
Validated taxonomy rows: 25
Validated glossary rows: 25
Validated mapping rows: 3
Validated fact rows: 6
Report written:
```

- [ ] **Step 4: Run app build**

Run:

```powershell
cd apps/web
npm run build
```

Expected:

```text
Compiled successfully
```

- [ ] **Step 5: Commit final foundation verification**

Run:

```powershell
git add README.md data/reports/.gitkeep apps/web
git commit -m "docs: document georgian encoding verification"
```

Expected:

```text
[main
```

- [ ] **Step 6: Push foundation branch**

Run:

```powershell
git push origin main
```

Expected:

```text
main -> main
```

---

## Self-Review

### Spec Coverage

Covered by this plan:

- Git/GitHub setup before coding.
- Next.js/TypeScript scaffold.
- Data-first implementation sequence.
- Stable category IDs.
- Public spending taxonomy.
- Revenue taxonomy.
- Georgian glossary.
- Mapping layer with confidence and notes.
- No silent dropped rows.
- Planned vs actual active-value rule.
- Minimal source metadata files.
- Import validation report.
- UTF-8 Georgian verification.

Not covered because they belong in follow-up UI/data plans:

- Main explorer charts.
- Single-year page visuals.
- Stacked mode UI.
- Budget Field scatter.
- Share of GDP source and calculation.
- Full 2016-2026 production data loading.
- Deployment to Vercel.

### Red-Flag Scan

This plan avoids open implementation gaps. The only deferred items are explicitly out of scope for this foundation plan and listed as follow-up plans.

### Type Consistency

Shared names are consistent across tasks:

- `BudgetFactImportRow`
- `loadBudgetFactRows`
- `buildImportReport`
- `chooseActivePublicFacts`
- `loadTaxonomyFiles`
- `loadGlossary`
- `loadSpendingMappings`
- `basis = actual | planned`
- `mappingConfidence = high | medium | low | unclassified`
