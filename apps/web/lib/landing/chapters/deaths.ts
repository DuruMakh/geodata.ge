import type { HealthFact } from "../../data/health/types";
import { message } from "../../i18n/messages";
import type { Messages } from "../../i18n/types";
import type { DeathGroupKind, DeathsChapter } from "./types";

// Chapter 10: what Georgians die of. Pure reading of the served health facts for
// Georgia in the latest year with a registered-deaths total. The five largest
// causes stand alone; everything else is one remainder group.

const PREFIX = "health.deaths.";
const GROUP_LIMIT = 5;
const UNKNOWN = "ill_defined";

/** "One in N": round(1 / share) when it lands within 2..10, otherwise null (say it as a percentage). */
export function oneInN(share: number): number | null {
  const n = Math.round(1 / share);
  return n >= 2 && n <= 10 ? n : null;
}

export function buildDeathsChapter(facts: HealthFact[], messages: Messages): DeathsChapter {
  const georgia = facts.filter((fact) => fact.areaId === "georgia" && fact.indicatorId.startsWith(PREFIX));
  const totalYears = georgia.filter((fact) => fact.indicatorId === `${PREFIX}total`).map((fact) => fact.year);
  if (!totalYears.length) throw new Error("Deaths chapter: no data for registered deaths total");
  const year = Math.max(...totalYears);

  const counts = new Map<string, number>();
  for (const fact of georgia) if (fact.year === year) counts.set(fact.indicatorId.slice(PREFIX.length), Number(fact.value));
  const total = counts.get("total")!;
  counts.delete("total");

  const ranked = [...counts].filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]).slice(0, GROUP_LIMIT);
  const label = (id: string) => message(messages, `health.series.${PREFIX}${id}`);
  const topId = ranked.find(([id]) => id !== UNKNOWN)?.[0];
  if (topId === undefined) throw new Error(`Deaths chapter: no established cause of death for ${year}`);

  const kind = (id: string): DeathGroupKind => (id === topId ? "top" : id === UNKNOWN ? "unknown" : "established");
  const groups = ranked.map(([id, count]) => ({ id, label: label(id), count, kind: kind(id) }));
  groups.push({ id: "other", label: message(messages, "landing.deaths.other"), count: total - ranked.reduce((sum, [, count]) => sum + count, 0), kind: "other" });

  return {
    year,
    total,
    groups,
    top: { id: topId, label: label(topId), share: counts.get(topId)! / total },
    unknownShare: (counts.get(UNKNOWN) ?? 0) / total,
  };
}
