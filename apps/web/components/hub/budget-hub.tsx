import Link from "next/link";
import type { HubCardModel } from "../../lib/explorer/hubCards";
import { withLari } from "../ui/lari";
import { Sparkline } from "../ui/sparkline";
import type { Locale } from "../../lib/i18n/types";
import { getCommonMessages } from "../../lib/i18n/common.server";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";

// Hub cards are the one card-framed block in the system (DESIGN.md §6.6):
// four peer destinations with no natural reading order need containment.

// A linked card's name is its title; its description and footer describe it. Read whole,
// index first, the card made a 100–250 character link name.
function cardIds(testId: string, card: HubCardModel) {
  const base = `${testId}-${card.index}`;
  return { title: `${base}-title`, description: `${base}-description`, footer: `${base}-footer` };
}

function CardBody({ card, locale, ids }: { card: HubCardModel; locale: Locale; ids: ReturnType<typeof cardIds> }) {
  return (
    <>
      <div className="flex items-baseline justify-between">
        <span aria-hidden className="font-[family-name:var(--font-numeric)] text-[11px] min-[768px]:text-[10.5px] text-[var(--accent)]">{card.index}</span>
        {card.comingSoon ? (
          <span className="rounded-[2px] border border-[var(--control)] px-1.5 py-px font-[family-name:var(--font-numeric)] text-[11px] min-[768px]:text-[9px] text-[var(--muted)]">
            {message(getCommonMessages(locale), "common.comingSoon")}
          </span>
        ) : (
          <span aria-hidden className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--faint)]">
            →
          </span>
        )}
      </div>
      <h2
        id={ids.title}
        className={`font-[family-name:var(--font-display)] text-[18px] font-semibold ${
          card.comingSoon ? "text-[var(--muted)]" : "text-[var(--ink)]"
        }`}
      >
        {card.title}
      </h2>
      <p id={ids.description} className="text-[11.5px] leading-normal text-[var(--muted)]">{card.description}</p>
      {card.series && card.seriesColor ? (
        <Sparkline values={card.series} color={card.seriesColor} width={200} height={34} fluidOnMobile />
      ) : (
        // A card without a graphic keeps the graphic's band, so every card in a
        // hub has the same rhythm and the footers line up.
        <div aria-hidden data-testid="hub-card-graphic-space" className="mt-1.5 h-[34px]" />
      )}
      {card.footer ? (
        // Muted while hovered: faint on the hover tint is below 4.5:1.
        <p id={ids.footer} className="mt-auto font-[family-name:var(--font-numeric)] text-[11px] min-[768px]:text-[10px] text-[var(--faint)] group-hover:text-[var(--muted)]">{withLari(card.footer)}</p>
      ) : null}
    </>
  );
}

export function BudgetHub({ cards, locale = "ka", testId = "budget-hub" }: { cards: HubCardModel[]; locale?: Locale; testId?: string }) {
  return (
    <div data-testid={testId} className="grid max-w-[860px] gap-4 min-[768px]:grid-cols-2">
      {cards.map((card) => {
        const ids = cardIds(testId, card);
        return card.href === null ? (
          <div
            key={card.index}
            data-testid="hub-card"
            aria-disabled="true"
            className="flex flex-col gap-2 border border-[var(--hairline)] bg-[var(--tile)] px-[18px] pt-[18px] pb-[15px]"
          >
            <CardBody card={card} locale={locale} ids={ids} />
          </div>
        ) : (
          <Link
            key={card.index}
            href={pageHref(card.href, locale)}
            prefetch={false}
            data-testid="hub-card"
            aria-labelledby={ids.title}
            aria-describedby={card.footer ? `${ids.description} ${ids.footer}` : ids.description}
            className="group flex flex-col gap-2 border border-[var(--hairline)] bg-[var(--tile)] px-[18px] pt-[18px] pb-[15px] no-underline transition-colors duration-150 hover:bg-[var(--tint)]"
          >
            <CardBody card={card} locale={locale} ids={ids} />
          </Link>
        );
      })}
    </div>
  );
}
