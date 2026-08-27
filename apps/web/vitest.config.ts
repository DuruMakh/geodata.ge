import { defaultExclude, defineConfig } from "vitest/config";

// dataValidateGeometry appends a byte to the tracked geometry artifact and shells out to the
// validator to prove the check is wired, then restores it. prepareMunicipalGeometry compares
// that same file byte-for-byte, so the tamper must never overlap another test file. Keeping it
// in its own group — run alone, after everything else — lets the rest of the suite parallelize.
const EXCLUSIVE_TEST = "tests/data/municipalGeometry/dataValidateGeometry.test.ts";
// These suites repeatedly parse the largest preserved PDFs. Running them beside one another can
// push their 30-second checks past the timeout even with four workers, so they share one worker
// before the ordinary parallel group starts competing for CPU and memory.
const HEAVY_TESTS = [
  "tests/data/adminSpending/olderMinistryYears.test.ts",
  "tests/data/realExpenditurePdf/year2004StateBudget.test.ts",
] as const;

const shared = {
  environment: "node",
  pool: "forks",
  // Vitest's 5s default is a latency budget, and latency legitimately rises once files run
  // concurrently: the workbook and PDF parsers here take ~0.4-2s alone but several seconds when
  // a dozen forks compete for CPU. 30s matches the budget the heavy tests already declare
  // inline, so a real hang still fails the run rather than stalling it.
  testTimeout: 30_000,
} as const;

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          ...shared,
          name: "parallel",
          include: ["tests/**/*.test.ts"],
          exclude: [...defaultExclude, EXCLUSIVE_TEST, ...HEAVY_TESTS],
          sequence: { groupOrder: 1 },
        },
      },
      {
        test: {
          ...shared,
          name: "heavy",
          include: [...HEAVY_TESTS],
          fileParallelism: false,
          sequence: { groupOrder: 0 },
        },
      },
      {
        test: {
          ...shared,
          name: "exclusive",
          include: [EXCLUSIVE_TEST],
          fileParallelism: false,
          sequence: { groupOrder: 2 },
        },
      },
    ],
  },
});
