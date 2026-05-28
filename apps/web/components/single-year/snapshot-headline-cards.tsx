import type { SnapshotHeadline } from "../../lib/explorer/types";

type SnapshotHeadlineCardsProps = {
  cards: SnapshotHeadline[];
};

const gradientClasses = [
  "bg-[image:var(--apple-gradient-1)] border-[var(--apple-border-1)]",
  "bg-[image:var(--apple-gradient-2)] border-[var(--apple-border-2)]",
  "bg-[image:var(--apple-gradient-3)] border-[var(--apple-border-3)]",
  "bg-[image:var(--apple-gradient-4)] border-[var(--apple-border-4)]",
];

export function SnapshotHeadlineCards({ cards }: SnapshotHeadlineCardsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {cards.slice(0, 4).map((card, index) => (
        <div key={card.id} className={`rounded-[18px] border p-4 ${gradientClasses[index] ?? gradientClasses[0]}`}>
          <p className="text-xs font-semibold uppercase text-[var(--mute)]">{card.label}</p>
          <p className="mt-2 text-base font-semibold text-[var(--ink)]">{card.value}</p>
          <p className="mt-1 text-sm text-[var(--body)]">{card.detail}</p>
        </div>
      ))}
    </div>
  );
}
