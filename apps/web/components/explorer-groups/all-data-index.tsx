import { Map as MapIcon } from "lucide-react";
import Link from "next/link";
import { GROUP_ICONS } from "../shell/group-icons";
import { Sparkline } from "../ui/sparkline";
import { azAlphabet, azColumns, azGroups } from "../../lib/explorer/allDataIndex";
import { pagesLabel } from "../../lib/explorer/pagesLabel";
import { rowLabel, valueNote, type SearchPage } from "../../lib/explorer/search/searchExplorer";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import type { Locale, Messages } from "../../lib/i18n/types";

// Every page A to Z on the All data page (spec 2026-10-24-explorer-regroup §6.4, prototype `dx-idx`, `dx-az`, `dx-ix`): a letter
// bar that stays on screen, then the letters in two balanced columns, one on phones. Rendered on the server, so the whole list is
// in the page's HTML.
//
// The Georgian bar needs about 920px for its 33 letters. Where the column is narrower (beside the sidebar up to about 1260px, or
// without it from 768px) the letters wrap onto a second row of the same grid, so every letter stays in reach of the mouse; one row
// spans the column as in the prototype. Phones scroll the one row sideways, as the prototype does.

const NUMERIC = "font-[family-name:var(--font-numeric)]";

function IndexRow({ page, locale, preliminary }: { page: SearchPage; locale: Locale; preliminary: string }) {
  const Icon = GROUP_ICONS[page.group];
  return (
    <li>
      <Link
        href={pageHref(page.href, locale)}
        prefetch={false}
        data-testid="az-row"
        className="group grid min-h-[54px] grid-cols-[minmax(0,1fr)_44px_minmax(84px,auto)] items-center gap-3.5 border-b border-[var(--row-border)] py-2 text-[var(--ink)] no-underline max-[768px]:min-h-[52px] max-[768px]:grid-cols-[minmax(0,1fr)_auto] max-[768px]:gap-3 max-[768px]:py-[7px]"
      >
        <span className="min-w-0">
          <span className="block text-[14px] leading-[1.35] font-semibold group-hover:text-[var(--accent)] group-hover:underline group-hover:underline-offset-[3px]">{rowLabel(page, locale)}</span>
          <span className={`mt-[3px] flex items-center gap-1.5 ${NUMERIC} text-[10.5px] leading-[1.3] text-[var(--faint)] max-[768px]:text-[11px]`}>
            <Icon aria-hidden strokeWidth={1.75} className="size-3 flex-none" />
            <span>{page.groupName[locale]}</span>
          </span>
        </span>
        <span aria-hidden className="flex justify-center text-[var(--faint)] max-[768px]:hidden [&>svg]:mt-0">
          {page.spark
            ? <Sparkline values={page.spark} color="var(--control)" width={44} height={14} />
            : page.href.endsWith("/regions") ? <MapIcon strokeWidth={1.75} className="size-3.5" /> : null}
        </span>
        <span className={`max-w-[124px] justify-self-end text-right ${NUMERIC} text-[12px] leading-[1.3] font-semibold`}>
          {page.value}
          {page.value ? <em className="block text-[10.5px] font-normal text-[var(--faint)] not-italic max-[768px]:text-[11px]">{valueNote(page, preliminary)}</em> : null}
        </span>
      </Link>
    </li>
  );
}

/** The A to Z list. `messages` holds `common` and `allData`. */
export function AllDataIndex({ locale, messages, pages }: { locale: Locale; messages: Messages; pages: SearchPage[] }) {
  const groups = azGroups(pages, locale);
  const present = new Map(groups.map((group) => [group.letter, group]));
  return (
    <section data-testid="az-index" aria-labelledby="az-title" className="mt-11 max-[768px]:mt-8">
      <h2 id="az-title" className="sr-only">{message(messages, "allData.indexTitle")}</h2>
      <nav
        aria-label={message(messages, "allData.alphabetLabel")}
        className="sticky top-14 z-[6] border-t-[1.5px] border-b border-t-[var(--ink)] border-b-[var(--hairline)] bg-[var(--paper)] py-2 [scrollbar-width:none] min-[900px]:top-0 max-[768px]:-mx-5 max-[768px]:overflow-x-auto max-[768px]:px-3.5 max-[768px]:py-1.5"
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(26px,1fr))] gap-0.5 max-[768px]:flex max-[768px]:justify-start">
          {[...azAlphabet(locale)].map((letter) => {
            const group = present.get(letter);
            const letterClass = "inline-flex h-8 min-w-[26px] items-center justify-center px-[3px] text-[14px] leading-none max-[768px]:h-11 max-[768px]:min-w-11 max-[768px]:flex-none";
            return group ? (
              <a
                key={letter}
                href={`#${group.id}`}
                aria-label={`${letter} — ${pagesLabel(messages, group.rows.length)}`}
                data-testid="az-letter"
                className={`${letterClass} font-semibold text-[var(--ink)] no-underline hover:bg-[var(--tint)] hover:text-[var(--accent)]`}
              >
                {letter}
              </a>
            ) : (
              <span key={letter} aria-hidden className={`${letterClass} font-normal text-[var(--hairline)]`}>{letter}</span>
            );
          })}
        </div>
      </nav>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(420px,100%),1fr))] items-start gap-x-12">
        {azColumns(groups).map((column, index) => (
          <div key={index}>
            {column.map((group) => (
              <section
                key={group.id}
                id={group.id}
                aria-labelledby={`${group.id}-h`}
                tabIndex={-1}
                className="scroll-mt-[146px] pt-6 focus:outline-none max-[768px]:scroll-mt-[116px] max-[768px]:pt-[18px] min-[900px]:scroll-mt-[96px]"
              >
                <h3 id={`${group.id}-h`} className="flex items-baseline gap-3 border-b border-[var(--ink)] pb-1.5">
                  <span className="font-[family-name:var(--font-display)] text-[30px] leading-[1.05] font-semibold max-[768px]:text-[24px]">{group.letter}</span>
                  <span className={`${NUMERIC} text-[11px] font-normal text-[var(--muted)]`}>{pagesLabel(messages, group.rows.length)}</span>
                </h3>
                <ul>
                  {group.rows.map((page) => <IndexRow key={page.href} page={page} locale={locale} preliminary={message(messages, "allData.preliminary")} />)}
                </ul>
              </section>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
