// The one place that reads GEODATA_DATA_SOURCE.
//
// It lives in its own module, not in servedData.ts, because servedData.ts
// re-exports the debt, deficit and regional economy loaders; importing it from
// those loaders would close an import cycle.
//
// Single switch for where the site reads its data while pages are built.
// "db" reads the Supabase mirror populated by `npm run data:import` (the
// canonical serving store) and verifies it row-by-row against the reviewed
// CSVs in the checkout; "csv" (default) reads the reviewed files directly.
export type ServedDataSource = "csv" | "db";

export function resolveServedDataSource(): ServedDataSource {
  const raw = (process.env.GEODATA_DATA_SOURCE ?? "").trim().toLowerCase();

  if (raw === "" || raw === "csv") {
    return "csv";
  }

  if (raw === "db") {
    return "db";
  }

  throw new Error(`GEODATA_DATA_SOURCE must be "db" or "csv", got "${raw}"`);
}
