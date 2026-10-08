"use client";

import { useRef, useState, type PointerEvent } from "react";

// Map taps on touch screens (owner decision D7, 2026-10-07): the first tap on a
// place selects it and shows a one-line strip under the map; a second tap on the
// same place, or the strip's link, opens its page. Mouse, pen and keyboard keep
// opening the place on the first click.
export function useTouchPreview() {
  const lastPointerType = useRef("");
  const [previewId, setPreviewId] = useState<string | null>(null);

  return {
    previewId,
    /** Attach to the map's SVG: records how the coming click was made. */
    onPointerDown(event: PointerEvent) {
      lastPointerType.current = event.pointerType;
    },
    /** Call from a target's click handler; false means the tap only previewed the place. */
    opens(id: string): boolean {
      const touch = lastPointerType.current === "touch";
      // A later keyboard click (Enter on a focused link) has no pointerdown.
      lastPointerType.current = "";
      if (!touch || previewId === id) return true;
      setPreviewId(id);
      return false;
    },
  };
}
