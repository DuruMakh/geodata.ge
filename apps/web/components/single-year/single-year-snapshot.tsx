import type { SingleYearSnapshotModel } from "../../lib/explorer/types";
import { Every100Gel } from "./every-100-gel";
import { SnapshotHeadlineCards } from "./snapshot-headline-cards";
import { SnapshotTreemap } from "./snapshot-treemap";

type SingleYearSnapshotProps = {
  model: SingleYearSnapshotModel;
};

export function SingleYearSnapshot({ model }: SingleYearSnapshotProps) {
  if (model.emptyReason) {
    return <div className="border border-amber-300/30 bg-amber-300/10 p-6 text-sm text-amber-100">{model.emptyReason}</div>;
  }

  const subtitle = model.side === "expenditure" ? "სად მიდის საჯარო ფული" : "საიდან მოდის საჯარო ფული";

  return (
    <section data-testid="single-year-snapshot" className="border border-cyan-400/20 bg-zinc-950/80 p-4">
      <header className="mb-4">
        <p className="font-mono text-xs uppercase text-cyan-200">Single-year snapshot</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-semibold text-white">{model.year} წლის ბიუჯეტის სურათი</h2>
          {model.hasPlannedValues ? (
            <span className="border border-amber-300/30 bg-amber-300/10 px-2 py-1 font-mono text-xs uppercase text-amber-100">
              გეგმური ბიუჯეტი
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>
      </header>

      <SnapshotHeadlineCards cards={model.headlineCards} />
      <SnapshotTreemap items={model.items} />
      <Every100Gel items={model.every100} side={model.side} />
    </section>
  );
}
