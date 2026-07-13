// Row-level equality check between two loads of the same served dataset
// (reviewed CSVs vs the database mirror). Order-insensitive: rows are matched
// by a caller-supplied natural key, then compared field by field.

function canonical(row: object): string {
  return JSON.stringify(row, Object.keys(row).sort());
}

export function assertSameServedRows<T extends object>(
  label: string,
  csvRows: T[],
  dbRows: T[],
  keyOf: (row: T) => string,
): void {
  const problems: string[] = [];

  if (csvRows.length !== dbRows.length) {
    problems.push(`row count differs: csv=${csvRows.length} db=${dbRows.length}`);
  }

  const csvByKey = new Map(csvRows.map((row) => [keyOf(row), row]));
  const dbByKey = new Map(dbRows.map((row) => [keyOf(row), row]));

  for (const [key, csvRow] of csvByKey) {
    const dbRow = dbByKey.get(key);
    if (dbRow === undefined) {
      problems.push(`row ${key} exists in csv but not in db`);
    } else if (canonical(csvRow) !== canonical(dbRow)) {
      problems.push(`row ${key} differs: csv=${canonical(csvRow)} db=${canonical(dbRow)}`);
    }
    if (problems.length >= 5) break;
  }

  if (problems.length < 5) {
    for (const key of dbByKey.keys()) {
      if (!csvByKey.has(key)) {
        problems.push(`row ${key} exists in db but not in csv`);
        if (problems.length >= 5) break;
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Database does not match the reviewed CSVs for ${label} (first ${problems.length} problem(s)):\n` +
        problems.map((problem) => `  - ${problem}`).join("\n") +
        "\nThe reviewed CSVs are the source of truth — run `npm run data:import` to refresh the mirror, " +
        "or build with GEODATA_DATA_SOURCE=csv.",
    );
  }
}
