"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { formatAmount } from "../../lib/explorer/format";

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

type EntityPickerProps = {
  open: boolean;
  onClose: () => void;
  groups: EntityPickerGroup[];
  activeId: string;
  onSelectMunicipality: (code: string) => void;
  onSelectRegion: (regionId: string) => void;
};

type PickerOption =
  | { id: string; kind: "region"; regionId: string }
  | { id: string; kind: "municipality"; code: string };

// Module-level and parameterised (rather than closures inside the component)
// so they never need to appear in a useMemo/useEffect dependency array.
function regionOptionId(baseId: string, regionId: string): string {
  return `${baseId}-region-${regionId}`;
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

export function EntityPicker({ open, onClose, groups, activeId, onSelectMunicipality, onSelectRegion }: EntityPickerProps) {
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
  const filtered = useMemo(() => {
    const needle = query.trim();
    if (needle === "") return groups;

    return groups
      .map((group) => ({ ...group, members: group.members.filter((member) => member.nameKa.includes(needle)) }))
      .filter((group) => group.members.length > 0 || group.nameKa.includes(needle));
  }, [groups, query]);

  const flatOptions = useMemo<PickerOption[]>(() => {
    const list: PickerOption[] = [];
    for (const group of filtered) {
      list.push({ id: regionOptionId(baseId, group.regionId), kind: "region", regionId: group.regionId });
      for (const member of group.members) {
        list.push({ id: municipalityOptionId(baseId, member.code), kind: "municipality", code: member.code });
      }
    }
    return list;
  }, [filtered, baseId]);

  // The listbox is a capped, scrollable region (see max-h-[340px] below); with
  // up to 75 options, arrowing past the visible edge must carry the highlight
  // into view or the active option becomes invisible.
  useEffect(() => {
    if (activeOptionId === null) return;
    document.getElementById(activeOptionId)?.scrollIntoView({ block: "nearest" });
  }, [activeOptionId]);

  function selectOption(option: PickerOption) {
    onClose();
    if (option.kind === "region") onSelectRegion(option.regionId);
    else onSelectMunicipality(option.code);
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
        aria-label="აირჩიე მუნიციპალიტეტი ან რეგიონი"
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
              }
            }}
            placeholder="ძებნა — მუნიციპალიტეტი ან რეგიონი"
            aria-label="ძებნა"
            className="h-[34px] w-full rounded-[3px] border border-[var(--control)] bg-[var(--paper)] px-2.5 text-[13px] text-[var(--ink)] outline-none"
          />
        </div>
        <div id={listboxId} role="listbox" aria-label="შედეგები" className="max-h-[340px] overflow-y-auto">
          {filtered.map((group) => {
            const regionId = regionOptionId(baseId, group.regionId);
            const regionActive = regionId === activeOptionId;

            return (
              <div key={group.regionId}>
                <button
                  type="button"
                  id={regionId}
                  role="option"
                  aria-selected={regionActive}
                  aria-current={group.regionId === activeId ? "page" : undefined}
                  tabIndex={-1}
                  data-testid="picker-region"
                  onClick={() => selectOption({ id: regionId, kind: "region", regionId: group.regionId })}
                  className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2.5 border-b border-b-[var(--hairline-soft)] border-l-2 bg-[var(--tint)] px-3 py-2 text-left ${
                    regionActive ? "border-l-[var(--ink)]" : "border-l-transparent"
                  } ${group.regionId === activeId ? "text-[var(--accent)]" : "text-[var(--ink)]"}`}
                >
                  <span className="truncate text-[12px] font-semibold">{group.nameKa}</span>
                  <span className="font-[family-name:var(--font-numeric)] text-[10px] text-[var(--muted)]">
                    {formatAmount(group.valueGel)} · {group.members.length}
                  </span>
                </button>
                {group.members.map((member) => {
                  const memberId = municipalityOptionId(baseId, member.code);
                  const memberActive = memberId === activeOptionId;

                  return (
                    <button
                      key={member.code}
                      id={memberId}
                      type="button"
                      role="option"
                      aria-selected={memberActive}
                      aria-current={member.code === activeId ? "page" : undefined}
                      tabIndex={-1}
                      data-testid="picker-municipality"
                      onClick={() => selectOption({ id: memberId, kind: "municipality", code: member.code })}
                      className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2.5 border-b border-b-[var(--row-border)] border-l-2 py-[7px] pr-3 pl-[26px] text-left ${
                        memberActive ? "border-l-[var(--ink)] bg-[var(--tint)]" : "border-l-transparent"
                      } ${member.code === activeId ? "font-semibold text-[var(--accent)]" : "text-[var(--body)]"}`}
                    >
                      <span className="truncate text-[13px]">{member.nameKa}</span>
                      <span className="font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--faint)]">
                        {formatAmount(member.valueGel)}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="border-t border-[var(--hairline-soft)] px-3 py-2 text-[11px] text-[var(--faint)]">
          რეგიონის დაჭერა აჩვენებს მის ჯამურ მონაცემებს
        </div>
      </div>
    </div>
  );
}
