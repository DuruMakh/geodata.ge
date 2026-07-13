# GeoData.ge Web App

Next.js app for GeoData.ge: the landing page at `/` (living-relief hero, three paths to the data) and the Budget Explorer at `/explorer` (multi-year explorer, single-year analysis, CSV export).

Product scope, agent rules, data rules, and the design system live at the repo root — read those before changing this app:

- `../../README.md` (setup and data foundation overview)
- `../../AGENTS.md` (operating rules)
- `../../Project_Definition.md` (canonical v1 scope)
- `../../DESIGN.md` (production design system)

## Setup

Dev and build need no `.env` by default (data comes from the reviewed CSVs). Create `apps/web/.env` from `.env.example` before running Prisma commands, `npm run data:import`, or builds with `GEODATA_DATA_SOURCE=db` (see `../../docs/data-methodology/database-import.md`).

```powershell
npm install
npm run dev
```

`npm install` generates the Prisma Client via the `postinstall` hook.

## Commands

```powershell
npm run dev            # dev server
npm run build          # production build
npm run lint           # eslint (zero warnings allowed)
npm run typecheck      # tsc --noEmit
npm run check          # lint + typecheck + unit tests + data validation
npm run test           # vitest unit tests
npm run test:browser   # Playwright browser tests
npm run prisma:generate
npm run prisma:migrate
```

## Data pipeline scripts

Data extraction, fact generation, validation, and import scripts are exposed as `data:*` npm scripts (see `package.json`). The extraction methodology is documented in `../../docs/data-methodology/`.
