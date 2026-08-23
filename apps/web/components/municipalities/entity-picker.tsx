"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { MUNICIPAL_COUNTRY_ID } from "../../lib/data/municipal/types";
import { formatAmount } from "../../lib/explorer/format";
import { municipalEntityHref } from "../../lib/seo/internalLinks";

// Entity picker for the 64 municipality and 11 region pages. A plain popover
// with focus return, not a command palette: ⌘K is a shortcut onto the same
// control the heading click opens. With 64 entities, prev/next and a trip back
// to the index are not enough navigation.
//
// Built as an ARIA combobox+listbox (WAI-ARIA "Combobox with List Autocomplete"):
// real DOM focus stays on the search input the whole time the popover is open,
// arrow keys move a virtual "active option" that is exposed via
// aria-activedescendant/aria-selected, and Enter activates it. Options carry
// tabIndex={-1} deliberately: Tab must not stop at all ~75 of them one by one,
// and this is not a focus trap (Tab is free to leave the popover, same as the
// existing mobile nav sheet in data-sidebar.tsx).

export type EntityPickerGroup = {
  regionId: string;
  nameKa: string;
  valueGel: number;
  members: Array<{ code: string; nameKa: string; valueGel: number }>;
};

export type EntityPickerCountry = {
  id: typeof MUNICIPAL_COUNTRY_ID;
  nameKa: "საქართველო";
  valueGel: number;
  budgetCount: 69;
};

type EntityPickerProps = {
  open: boolean;
  onClose: () => void;
  country: EntityPickerCountry;
  groups: EntityPickerGroup[];
  activeId: string;
};

type PickerOption =
  | { id: string; kind: "country" }
  | { id: string; kind: "region"; regionId: string }
  | { id: string; kind: "municipality"; code: string };

// Module-level and parameterised (rather than closures inside the component)
// so they never need to appear in a useMemo/useEffect dependency array.
function regionOptionId(baseId: string, regionId: string): string {
  return `${baseId}-region-${regionId}`;
}

function countryOptionId(baseId: string): string {
  return `${baseId}-country`;
}

function municipalityOptionId(baseId: string, code: string): string {
  return `${baseId}-muni-${code}`;
}

// The parent renders the trigger inside its <h1> (see the module comment in
// the plan: a role="dialog" nested inside a heading is announced as part of
// the heading). This component only ever finds it by testid, never by ref.
function focusTrigger() {
  document.querySelector<HTMLButtonElement>("[data-testid='entity-picker-trigger']")?.focus();
}

export function EntityPicker({ open, onClose, country, groups, activeId }: EntityPickerProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeOptionId, setActiveOptionId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;

  // Reset the search and the keyboard highlight when the popover opens, and
  // clear the highlight whenever the query changes under it (a filtered-out
  // option must not stay the aria-activedescendant). This adjusts state
  // during render — React's documented pattern for "state that depends on a
  // changed prop" — rather than in an effect, so reopening the popover after
  // a previous search never paints last time's stale results for one frame
  // before an effect clears them.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setQuery("");
      setActiveOptionId(null);
    }
  }

  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setActiveOptionId(null);
  }

  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        // Focus returns to the trigger, which the parent renders in its <h1>.
        focusTrigger();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Moving focus is a genuine external-system side effect (unlike the state
  // resets above), so it stays in an effect: the input has to actually be in
  // the DOM before it can be focused.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Every hook above this line must run on every render, open or not: a
  // conditional early return may not sit between hook calls (Rules of Hooks).
  // groups/members are still small (11 regions, 64 municipalities total) even
  // while closed, so computing them unconditionally costs nothing measurable.
  const filteredGroups = useMemo(() => {
    const needle = query.trim();
    if (needle === "") return groups;

    return groups
      .map((group) => ({ ...group, members: group.members.filter((member) => member.nameKa.includes(needle)) }))
      .filter((group) => group.members.length > 0 || group.nameKa.includes(needle));
  }, [groups, query]);

  const filteredCountry = useMemo(() => (country.nameKa.includes(query.trim()) ? country : null), [country, query]);

  const flatOptions = useMemo<PickerOption[]>(() => {
    const list: PickerOption[] = [];
    if (filteredCountry) list.push({ id: countryOptionId(baseId), kind: "country" });
    for (const group of filteredGroups) {
      list.push({ id: regionOptionId(baseId, group.regionId), kind: "region", regionId: group.regionId });
      for (const member of group.members) {
        list.push({ id: municipalityOptionId(baseId, member.code), kind: "municipality", code: member.code });
      }
    }
    return list;
  }, [filteredCountry, filteredGroups, baseId]);

  // The listbox is a capped, scrollable region (see max-h-[340px] below); with
  // up to 75 options, arrowing past the visible edge must carry the highlight
  // into view or the active option becomes invisible.
  useEffect(() => {
    if (activeOptionId === null) return;
    document.getElementById(activeOptionId)?.scrollIntoView({ block: "nearest" });
  }, [activeOptionId]);

  function selectOption(option: PickerOption) {
    onClose();
    if (option.kind === "country") router.push(municipalEntityHref("country", country.id));
    else if (option.kind === "region") router.push(municipalEntityHref("region", option.regionId));
    else router.push(municipalEntityHref("municipality", option.code));
  }

  function moveActive(delta: 1 | -1) {
    if (flatOptions.length === 0) return;
    const currentIndex = flatOptions.findIndex((option) => option.id === activeOptionId);
    const nextIndex =
      currentIndex === -1 ? (delta === 1 ? 0 : flatOptions.length - 1) : (currentIndex + delta + flatOptions.length) % flatOptions.length;
    setActiveOptionId(flatOptions[nextIndex].id);
  }

  function selectActive() {
    const option = flatOptions.find((candidate) => candidate.id === activeOptionId);
    if (option) selectOption(option);
  }

  if (!open) return null;

  return (
    <div className="relative">
      <div
        className="fixed inset-0 z-30"
        onClick={() => {
          onClose();
          focusTrigger();
        }}
        aria-hidden
      />
      <div
        role="dialog"
        aria-label="აირჩიე საქართველო, მუნიციპალიტეტი ან რეგიონი"
        data-testid="entity-picker"
        className="absolute top-1 left-0 z-40 w-[430px] max-w-[92vw] border border-[var(--control)] bg-[var(--tile)]"
      >
        <div className="border-b border-[var(--hairline-soft)] p-3">
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeOptionId ?? undefined}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                moveActive(1);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                moveActive(-1);
              } else if (event.key === "Enter") {
                event.preventDefault();
                selectActive();
              } else if (event.key === "Tab" && (flatOptions.length > 0 || event.shiftKey)) {
                // This is not a focus trap. Let the browser advance focus,
                // but keep an empty picker mounted for one forward Tab so its
                // visible clear-search action is keyboard reachable.
                onClose();
              }
            }}
            placeholder="ძებნა — საქართველო, მუნიციპალიტეტი ან რეგიონი"
            aria-label="ძებნა საქართველოში, მუნიციპალიტეტებში ან რეგიონებში"
            className="h-[34px] w-full rounded-[3px] border border-[var(--control)] bg-[var(--paper)] px-2.5 text-[13px] text-[var(--ink)] outline-none"
          />
        </div>
        <div id={listboxId} role="listbox" aria-label="საქართველოს, მუნიციპალიტეტებისა და რეგიონების შედეგები" className="max-h-[340px] overflow-y-auto">
          {filteredCountry ? (
            <Link
              href={municipalEntityHref("country", country.id)}
              id={countryOptionId(baseId)}
              role="option"
              aria-selected={countryOptionId(baseId) === activeOptionId}
              aria-current={country.id === activeId ? "page" : undefined}
              tabIndex={-1}
              data-testid="picker-country"
              onClick={onClose}
              className={`grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2.5 border-b border-b-[var(--hairline-soft)] border-l-2 bg-[var(--tint)] px-3 py-2 text-left transition-colors duration-100 hover:border-l-[var(--accent)] hover:text-[var(--accent)] ${
                countryOptionId(baseId) === activeOptionId ? "border-l-[var(--ink)]" : "border-l-transparent"
              } ${country.id === activeId ? "text-[var(--accent)]" : "text-[var(--ink)]"}`}
            >
              <span className="truncate text-[12px] font-semibold">{country.nameKa}</span>
              <span className="font-[family-name:var(--font-numeric)] text-[10px] text-[var(--muted)]">
                {formatAmount(country.valueGel)} · {country.budgetCount} მუნიციპალური ბიუჯეტი
              </span>
            </Link>
          ) : null}
          {filteredGroups.map((group) => {
            const regionId = regionOptionId(baseId, group.regionId);
            const regionActive = regionId === activeOptionId;

            return (
              <div key={group.regionId}>
                <Link
                  href={municipalEntityHref("region", group.regionId)}
                  id={regionId}
                  role="option"
                  aria-selected={regionActive}
                  aria-current={group.regionId === activeId ? "page" : undefined}
                  tabIndex={-1}
                  data-testid="picker-region"
                  onClick={onClose}
                  className={`grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2.5 border-b border-b-[var(--hairline-soft)] border-l-2 bg-[var(--tint)] px-3 py-2 text-left transition-colors duration-100 hover:border-l-[var(--accent)] hover:text-[var(--accent)] ${
                    regionActive ? "border-l-[var(--ink)]" : "border-l-transparent"
                  } ${group.regionId === activeId ? "text-[var(--accent)]" : "text-[var(--ink)]"}`}
                >
                  <span className="truncate text-[12px] font-semibold">{group.nameKa}</span>
                  <span className="font-[family-name:var(--font-numeric)] text-[10px] text-[var(--muted)]">
                    {formatAmount(group.valueGel)} · {group.members.length}
                  </span>
                </Link>
                {group.members.map((member) => {
                  const memberId = municipalityOptionId(baseId, member.code);
                  const memberActive = memberId === activeOptionId;

                  return (
                    <Link
                      key={member.code}
                      href={municipalEntityHref("municipality", member.code)}
                      id={memberId}
                      role="option"
                      aria-selected={memberActive}
                      aria-current={member.code === activeId ? "page" : undefined}
                      tabIndex={-1}
                      data-testid="picker-municipality"
                      onClick={onClose}
                      className={`grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2.5 border-b border-b-[var(--row-border)] border-l-2 py-[7px] pr-3 pl-[26px] text-left transition-colors duration-100 hover:border-l-[var(--accent)] hover:bg-[var(--tint)] hover:text-[var(--accent)] ${
                        memberActive ? "border-l-[var(--ink)] bg-[var(--tint)]" : "border-l-transparent"
                      } ${member.code === activeId ? "font-semibold text-[var(--accent)]" : "text-[var(--body)]"}`}
                    >
                      <span className="truncate text-[13px]">{member.nameKa}</span>
                      <span className="font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--faint)]">
                        {formatAmount(member.valueGel)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
        {/* Outside the listbox on purpose: a listbox may own only option/group
            children. With no options the listbox is simply empty, and one
            forward Tab from the combobox reaches this sibling action. */}
        {flatOptions.length === 0 ? (
          <div data-testid="picker-empty" className="px-3 py-[26px] text-center">
            <div role="status" className="text-[13px] text-[var(--body)]">ვერაფერი მოიძებნა</div>
            <button
              type="button"
              onKeyDown={(event) => {
                if (event.key === "Tab" && !event.shiftKey) onClose();
              }}
              onClick={() => {
                setQuery("");
                // The button unmounts with the empty state; without this, focus
                // falls to <body> and the next keystroke misses the picker.
                inputRef.current?.focus();
              }}
              className="mt-3 inline-flex h-[30px] cursor-pointer items-center rounded-[3px] border border-[var(--control)] px-3 text-[12px] text-[var(--accent)]"
            >
              ძებნის გასუფთავება
            </button>
          </div>
        ) : null}
        <div className="border-t border-[var(--hairline-soft)] px-3 py-2 text-[11px] text-[var(--faint)]">
          საქართველოს ან რეგიონის დაჭერა აჩვენებს მის ჯამურ მონაცემებს
        </div>
      </div>
    </div>
  );
}
