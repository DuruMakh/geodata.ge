"use client";

import { ChevronDown } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";
import { useRefocusAfterPick } from "../regional-economies/region-picker";
import { EntityNeighbourLinks } from "./entity-neighbour-links";

type Neighbour = { href: string; label: string };

/**
 * `{lead} {place} ▾` above a region or city page: the place opens its picker, and
 * previous/next links sit on the right when given. The heading and its picker share
 * one column, so the dialog opens under the heading and the links stay the row's
 * second flex child. The popover is a sibling of the h1, not a child; `picker` gives the
 * dialog `popupId`, which the trigger's `aria-controls` names while it is open.
 */
export function PlaceHeading({
  lead,
  placeLabel,
  triggerTestId,
  picker,
  neighbours,
}: {
  lead: string;
  placeLabel: string;
  triggerTestId: string;
  picker: (open: boolean, close: () => void, popupId: string) => ReactNode;
  neighbours?: { testId: string; previous: Neighbour; next: Neighbour };
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const popupId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  useRefocusAfterPick(trigger, triggerTestId);
  return (
    <div className="relative mt-[34px] mb-3 flex flex-col gap-3 min-[768px]:flex-row min-[768px]:items-end min-[768px]:justify-between">
      <div className="min-w-0 min-[768px]:flex-1">
        <h1 className="font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.15] tracking-[-0.01em] min-[768px]:text-[40px]">
          {lead}{" "}
          <button
            ref={trigger}
            data-testid={triggerTestId}
            type="button"
            aria-expanded={pickerOpen}
            aria-haspopup="dialog"
            aria-controls={pickerOpen ? popupId : undefined}
            onClick={() => setPickerOpen((open) => !open)}
            className="group inline-flex max-w-full cursor-pointer items-center gap-2 border-b border-dashed border-[color:color-mix(in_srgb,var(--accent)_60%,transparent)] align-bottom text-left text-[var(--accent)] transition-colors duration-100 hover:border-[var(--accent)]"
          >
            {placeLabel}<ChevronDown aria-hidden size={20} strokeWidth={1.5} />
          </button>
        </h1>
        {picker(pickerOpen, () => setPickerOpen(false), popupId)}
      </div>
      {neighbours ? <EntityNeighbourLinks testId={neighbours.testId} previous={neighbours.previous} next={neighbours.next} /> : null}
    </div>
  );
}
