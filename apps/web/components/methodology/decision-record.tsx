import type { MethodologyDecision } from "../../lib/methodology/types";

function grouped(decisions: readonly MethodologyDecision[]) {
  const groups = new Map<string, MethodologyDecision[]>();
  for (const decision of decisions) {
    const entries = groups.get(decision.groupKa) ?? [];
    entries.push(decision);
    groups.set(decision.groupKa, entries);
  }
  return [...groups.entries()];
}

function DecisionDetails({ decision }: { decision: MethodologyDecision }) {
  return (
    <details data-testid="methodology-decision" className="group border-b border-[var(--hairline-soft)]">
      <summary className="grid cursor-pointer list-none gap-2 py-4 pr-1 marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(179,64,42,0.4)] min-[640px]:grid-cols-[minmax(0,1fr)_auto] min-[640px]:items-start min-[640px]:gap-6 [&::-webkit-details-marker]:hidden">
        <span className="font-[family-name:var(--font-display)] text-[15px] font-semibold leading-relaxed group-open:text-[var(--accent)]">
          {decision.titleKa}
        </span>
        <span className="font-[family-name:var(--font-numeric)] text-[9.5px] leading-6 text-[var(--muted)]">
          {decision.statusKa}
        </span>
      </summary>
      <div className="max-w-[760px] space-y-3 pb-5 text-[13px] leading-[1.75] text-[var(--body)]">
        <p>{decision.summaryKa}</p>
        {decision.detailKa.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </details>
  );
}

function DecisionGroups({ decisions }: { decisions: readonly MethodologyDecision[] }) {
  return grouped(decisions).map(([group, entries]) => (
    <section key={group} aria-labelledby={`decision-group-${entries[0].id}`} className="mt-8">
      <h3
        id={`decision-group-${entries[0].id}`}
        className="border-b border-[var(--ink)] pb-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--muted)]"
      >
        {group}
      </h3>
      {entries.map((decision) => (
        <DecisionDetails key={decision.id} decision={decision} />
      ))}
    </section>
  ));
}

export function DecisionRecord({
  decisions,
  technicalAppendix,
}: {
  decisions: readonly MethodologyDecision[];
  technicalAppendix: readonly MethodologyDecision[];
}) {
  return (
    <div data-testid="decision-record">
      <DecisionGroups decisions={decisions} />
      <section className="mt-12 border-t-2 border-[var(--ink)] pt-6" aria-labelledby="technical-appendix-title">
        <h3
          id="technical-appendix-title"
          className="font-[family-name:var(--font-display)] text-[22px] font-semibold"
        >
          ტექნიკური დანართი
        </h3>
        <p className="mt-3 max-w-[760px] text-[13px] leading-[1.75] text-[var(--body)]">
          ქვემოთ სრულად არის დატოვებული ისტორიული, ტექნიკური და შეზღუდვის ჩანაწერები, რომლებიც საჯარო შედეგის განმარტებისთვის საჭიროა.
        </p>
        <DecisionGroups decisions={technicalAppendix} />
      </section>
    </div>
  );
}
