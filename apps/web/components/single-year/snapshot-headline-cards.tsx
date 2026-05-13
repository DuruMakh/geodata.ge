import type { SnapshotHeadline } from "../../lib/explorer/types";

type SnapshotHeadlineCardsProps = {
  cards: SnapshotHeadline[];
};

export function SnapshotHeadlineCards({ cards }: SnapshotHeadlineCardsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.id} className="border border-cyan-400/20 bg-black/45 p-3 shadow-[0_0_18px_rgba(34,211,238,0.06)]">
          <p className="text-xs uppercase text-zinc-500">{card.label}</p>
          <p className="mt-2 text-base font-semibold text-white">{card.value}</p>
          <p className="mt-1 text-sm text-zinc-400">{card.detail}</p>
        </div>
      ))}
    </div>
  );
}
