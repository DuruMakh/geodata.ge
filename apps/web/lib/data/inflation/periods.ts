// Months are integers (year × 12 + month − 1) everywhere below the CSV, so the
// chart, range strip and table keep plain integer arithmetic: +1 is one month.

const PERIOD_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function makePeriod(year: number, month: number): number {
  return year * 12 + month - 1;
}

export function periodYear(period: number): number {
  return Math.floor(period / 12);
}

export function periodMonth(period: number): number {
  return (period % 12) + 1;
}

export function periodFromKey(key: string): number {
  const match = PERIOD_KEY.exec(key);
  if (!match) throw new Error(`Invalid period ${key}`);
  return makePeriod(Number(match[1]), Number(match[2]));
}

export function periodKey(period: number): string {
  return `${periodYear(period)}-${String(periodMonth(period)).padStart(2, "0")}`;
}
