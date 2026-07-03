# GeoData.ge Web App

Next.js app for the GeoData.ge Budget Explorer (multi-year explorer, single-year snapshot, CSV export).

Product scope, agent rules, data rules, and the design system live at the repo root — read those before changing this app:

- `../../README.md` (setup and data foundation overview)
- `../../AGENTS.md` (operating rules)
- `../../Project_Definition.md` (canonical v1 scope)
- `../../DESIGN.md` (production design system)

## Setup

Create `apps/web/.env` from `.env.example` before running Prisma, dev, or build commands (see the root README for the expected shape).

```powershell
npm install
npm run dev
```

`npm run dev` and `npm run build` run Prisma Client generation first via `predev`/`prebuild` hooks.

## Commands

```powershell
npm run dev            # dev server
npm run build          # production build
npm run lint           # eslint
npm run test           # vitest unit tests
npm run test:browser   # Playwright browser tests
npm run prisma:generate
npm run prisma:migrate
```

## Data pipeline scripts

Data extraction, fact generation, validation, and import scripts are exposed as `data:*` npm scripts (see `package.json`). The extraction methodology is documented in `../../docs/data-methodology/`.
