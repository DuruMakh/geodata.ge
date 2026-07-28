import Link from "next/link";
import type { HubCardModel } from "../../lib/explorer/hubCards";
import { Sparkline } from "../ui/sparkline";

// Hub cards are the one card-framed block in the system (DESIGN.md §6.6):
// four peer destinations with no natural reading order need containment.

function CardBody({ card }: { card: HubCardModel }) {
  return (
    <>
      <div className="flex items-baseline justify-between">
        <span className="font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--accent)]">{card.index}</span>
        {card.comingSoon ? (
          <span className="rounded-[2px] border border-[var(--control)] px-1.5 py-px font-[family-name:var(--font-numeric)] text-[9px] text-[var(--muted)]">
            მალე
          </span>
        ) : (
          <span aria-hidden className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--faint)]">
            →
          </span>
        )}
      </div>
      <p
        className={`font-[family-name:var(--font-display)] text-[18px] font-semibold ${
          card.comingSoon ? "text-[var(--muted)]" : "text-[var(--ink)]"
        }`}
      >
        {card.title}
      </p>
      <p className="text-[11.5px] leading-normal text-[var(--muted)]">{card.description}</p>
      {card.series && card.seriesColor ? (
        <Sparkline values={card.series} color={card.seriesColor} width={200} height={34} />
      ) : null}
      {card.footer ? (
        <p className="font-[family-name:var(--font-numeric)] text-[10px] text-[var(--faint)]">{card.footer}</p>
      ) : null}
    </>
  );
}

export function BudgetHub({ cards }: { cards: HubCardModel[] }) {
  return (
    <div data-testid="budget-hub" className="grid max-w-[860px] gap-4 min-[768px]:grid-cols-2">
      {cards.map((card) =>
        card.href === null ? (
          <div
            key={card.index}
            data-testid="hub-card"
            aria-disabled="true"
            className="flex flex-col gap-2 border border-[var(--hairline)] bg-[var(--tile)] px-[18px] pt-[18px] pb-[15px]"
          >
            <CardBody card={card} />
          </div>
        ) : (
          <Link
            key={card.index}
            href={card.href}
            data-testid="hub-card"
            className="flex flex-col gap-2 border border-[var(--hairline)] bg-[var(--tile)] px-[18px] pt-[18px] pb-[15px] no-underline transition-colors duration-150 hover:bg-[var(--tint)]"
          >
            <CardBody card={card} />
          </Link>
        ),
      )}
    </div>
  );
}
