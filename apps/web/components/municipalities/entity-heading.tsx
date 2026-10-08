"use client";

import { useEffect, useState } from "react";
import { EntityPicker, type EntityPickerCountry, type EntityPickerGroup, type EntityPickerOverrides } from "./entity-picker";

export type EntityNavigation = { prev: { label: string; href: string }; next: { label: string; href: string } };

type EntityHeadingProps = {
  title: string;
  triggerLabel: string;
  metaLine: string;
  entityId: string;
  navigation?: EntityNavigation;
  pickerCountry: EntityPickerCountry;
  pickerGroups: EntityPickerGroup[];
  pickerOverrides?: EntityPickerOverrides;
};

/** The place page's heading: the title, the place picker (also on ⌘K), the meta line and, when given, previous/next. */
export function EntityHeading({ title, triggerLabel, metaLine, entityId, navigation, pickerCountry, pickerGroups, pickerOverrides }: EntityHeadingProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPickerOpen(true);
      }
    }

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="mt-[22px] flex flex-col gap-4 min-[768px]:flex-row min-[768px]:items-baseline min-[768px]:justify-between min-[768px]:gap-5">
      <div className="min-w-0 min-[768px]:flex-1">
        {/* The popover is a SIBLING of the heading, not a child: a role="dialog"
            and a fixed overlay nested inside an h1 is announced as part of the
            heading and is fragile to position. */}
        <h1 className="mb-2 font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.15] tracking-[-0.01em] min-[768px]:text-[36px]">
          {title}{" "}
          <button
            type="button"
            data-testid="entity-picker-trigger"
            aria-expanded={pickerOpen}
            aria-haspopup="dialog"
            onClick={() => setPickerOpen((current) => !current)}
            className="group inline-block max-w-full align-bottom break-words cursor-pointer border-b border-dashed border-[color:color-mix(in_srgb,var(--accent)_60%,transparent)] font-[family-name:var(--font-display)] text-[var(--accent)] transition-colors duration-100 hover:border-[var(--accent)]"
          >
            {triggerLabel}
            <span
              aria-hidden="true"
              className={`ml-1 inline-block h-0 w-0 border-x-[4px] border-x-transparent ${
                pickerOpen ? "border-b-[5px] border-b-current" : "border-t-[5px] border-t-current"
              }`}
            />
          </button>
        </h1>
        <EntityPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          country={pickerCountry}
          groups={pickerGroups}
          activeId={entityId}
          overrides={pickerOverrides}
        />
        <div className="text-[12.5px] text-[var(--muted)]">{metaLine}</div>
      </div>
      {navigation ? (
        <span
          data-testid="municipal-entity-navigation"
          className="grid w-full min-w-0 grid-cols-2 items-center gap-4 min-[768px]:flex min-[768px]:w-auto min-[768px]:max-w-[40%] min-[768px]:shrink"
        >
          {/* Plain <a> on purpose (full page load); 44px-tall targets below 768px,
              matching EntityNeighbourLinks on the other detail pages. */}
          <a href={navigation.prev.href} className="flex min-h-11 min-w-0 items-center font-[family-name:var(--font-numeric)] text-[11.5px] text-[var(--muted)] no-underline hover:text-[var(--ink)] min-[768px]:min-h-0">
            <span className="min-w-0 truncate">← {navigation.prev.label}</span>
          </a>
          <a href={navigation.next.href} className="flex min-h-11 min-w-0 items-center justify-end text-right font-[family-name:var(--font-numeric)] text-[11.5px] text-[var(--muted)] no-underline hover:text-[var(--ink)] min-[768px]:min-h-0">
            <span className="min-w-0 truncate">{navigation.next.label} →</span>
          </a>
        </span>
      ) : null}
    </div>
  );
}
