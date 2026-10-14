"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent, type RefObject } from "react";
import { mapTouchTargets, nearestCircle, type MapTargetBounds } from "../../lib/explorer/mapTouchTargets";

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

/**
 * The fingertip disks for a map's small targets, sized at the SVG's measured
 * width (the 350px phone default until it has been measured), and the disk a
 * tap on one of them belongs to: where two city markers' disks overlap, the
 * nearer marker's.
 */
export function useMapTouchDisks(svgRef: RefObject<SVGSVGElement | null>, targets: readonly MapTargetBounds[], viewBox: string) {
  const [widthPx, setWidthPx] = useState<number>();
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const measure = () => {
      const width = Math.round(svg.getBoundingClientRect().width);
      if (width > 0) setWidthPx(width);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [svgRef]);
  const [minX, minY, viewBoxWidth, viewBoxHeight] = viewBox.split(" ").map(Number) as [number, number, number, number];
  const disks = useMemo(() => mapTouchTargets(targets, viewBoxWidth, widthPx), [targets, viewBoxWidth, widthPx]);

  return {
    disks,
    /** The id of the disk a click on a disk lands on. */
    diskIdAt(event: MouseEvent, fallbackId: string): string {
      const box = svgRef.current?.getBoundingClientRect();
      if (!box || box.width === 0 || box.height === 0) return fallbackId;
      const x = minX + ((event.clientX - box.left) / box.width) * viewBoxWidth;
      const y = minY + ((event.clientY - box.top) / box.height) * viewBoxHeight;
      return nearestCircle(disks, x, y)?.id ?? fallbackId;
    },
  };
}
