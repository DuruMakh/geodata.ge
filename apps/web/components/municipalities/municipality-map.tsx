"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { publicLabel } from "../../lib/i18n/labels";
import { pageHref } from "../../lib/i18n/routes";
import { municipalityHrefForCode } from "../../lib/explorer/municipalityRoutes";
import { useTouchPreview } from "../explorer-shell/use-touch-preview";
import { MUNICIPAL_PER_RESIDENT_YEAR } from "../../lib/explorer/municipalData";
import { MAP_NO_DATA_FILL, MAP_NO_DATA_STROKE, MAP_RAMP } from "../../lib/explorer/colors";
import { formatAmount, formatPerResidentGel } from "../../lib/explorer/format";
import type { MunicipalityMapModel } from "../../lib/explorer/municipalityMapData";
import municipalityMapDefinitions from "../../assets/municipality-map-definitions.svg";

type MunicipalityMapProps = Omit<MunicipalityMapModel, "legendMinPerResidentGel" | "legendMaxPerResidentGel"> & {
  legendMin: string;
  legendMax: string;
  activeCode: string | null;
  onActiveCodeChange: (code: string | null) => void;
  onOpenMunicipality: (code: string) => void;
  /** Replaces the per-resident budget wording; each place's own value text is `display` on the model. */
  wording?: { groupAria: string; legendCaption: string };
  /** Where the touch preview's link opens, by code; the Budget municipality page by default. */
  hrefForCode?: (code: string) => string;
};

function isActivationKey(key: string): boolean {
  return key === "Enter" || key === " ";
}


const HATCH_ID = "municipality-map-no-data-hatch";

export function MunicipalityMap({
  viewBox,
  shapes,
  markers,
  occupiedAreas,
  touchTargets,
  legendMin,
  legendMax,
  activeCode,
  onActiveCodeChange,
  onOpenMunicipality,
  wording,
  hrefForCode,
}: MunicipalityMapProps) {
  const { locale, messages, englishLabels } = useI18n();
  const accessibleName = (code: string, nameKa: string, budgetPerResidentGel: number, totalBudgetGel: number, display?: string) =>
    display !== undefined
      ? `${publicLabel(locale, code, nameKa, englishLabels)}, ${display}`
      : message(messages, "municipal.mapEntityAria", { name: publicLabel(locale, code, nameKa, englishLabels), perResident: formatPerResidentGel(budgetPerResidentGel, locale), total: formatAmount(totalBudgetGel, locale) });
  const svgRef = useRef<SVGSVGElement>(null);
  const [pointerCode, setPointerCode] = useState<string | null>(null);
  const [focusCode, setFocusCode] = useState<string | null>(null);
  const preview = useTouchPreview();
  const openOnClick = (code: string) => {
    if (preview.opens(code)) onOpenMunicipality(code);
  };
  const isActive = (code: string) => code === activeCode || code === preview.previewId;
  const previewTarget = preview.previewId === null
    ? null
    : markers.find((marker) => marker.code === preview.previewId) ?? shapes.find((shape) => shape.code === preview.previewId) ?? null;
  // Tbilisi (04) is the only entity the artifact carries as both a polygon and a
  // self-governing-city marker. The legend names the green dot
  // "თვითმმართველი ქალაქები", so the marker is the encoding that gets the
  // accessible name; its polygon stays drawn — removing it would leave a hole in
  // the map — but as decoration, not a second stop announcing the same
  // municipality twice.
  const markerCodes = useMemo(() => new Set(markers.map((marker) => marker.code)), [markers]);
  const decorativeShapes = useMemo(() => shapes.filter((shape) => markerCodes.has(shape.code)), [markerCodes, shapes]);
  const orderedTargets = useMemo(
    () =>
      [
        ...shapes
          .filter((shape) => !markerCodes.has(shape.code))
          .map((shape) => ({ kind: "shape" as const, nameKa: shape.nameKa, shape })),
        ...markers.map((marker) => ({ kind: "marker" as const, nameKa: marker.nameKa, marker })),
      ].toSorted(
        (left, right) =>
          left.nameKa.localeCompare(right.nameKa, "ka") ||
          (left.kind === right.kind ? 0 : left.kind === "shape" ? -1 : 1),
      ),
    [markerCodes, markers, shapes],
  );

  // Roving tabindex. Sixty-five independently focusable targets put the whole
  // map between the page and the ranked list with no way past it; the picker
  // already avoids exactly this. One stop enters the group, arrow keys move
  // inside it, and the last visited target keeps the stop.
  const [rovingIndex, setRovingIndex] = useState(0);

  const moveRoving = (from: number, key: string): number | null => {
    const last = orderedTargets.length - 1;
    if (key === "ArrowRight" || key === "ArrowDown") return Math.min(from + 1, last);
    if (key === "ArrowLeft" || key === "ArrowUp") return Math.max(from - 1, 0);
    if (key === "Home") return 0;
    if (key === "End") return last;
    return null;
  };

  const handleTargetKeyDown = (index: number, code: string, event: React.KeyboardEvent<SVGGraphicsElement>) => {
    if (isActivationKey(event.key)) {
      event.preventDefault();
      onOpenMunicipality(code);
      return;
    }

    const next = moveRoving(index, event.key);
    if (next === null) return;
    // preventDefault before the no-move check: at the group edges Home/End and
    // the arrows still resolve to the current index, and letting them through
    // there scrolls the page out from under the target that just kept focus.
    event.preventDefault();
    if (next === index) return;
    setRovingIndex(next);
    svgRef.current
      ?.querySelectorAll<SVGGraphicsElement>("[data-municipality-map-target]")
      [next]?.focus();
  };

  const activatePointerTarget = (code: string) => {
    setPointerCode(code);
    onActiveCodeChange(focusCode ?? code);
  };

  const clearPointerTarget = () => {
    setPointerCode(null);
    onActiveCodeChange(focusCode);
  };

  const activateFocusTarget = (code: string, index: number) => {
    // Keep the tab stop on whatever was focused last, however it got focus.
    // Tracking arrow keys alone sent Tab back to the last *arrow-key* target,
    // so clicking a municipality and tabbing away returned somewhere else.
    setRovingIndex(index);
    setFocusCode(code);
    onActiveCodeChange(code);
  };

  const clearFocusTarget = () => {
    setFocusCode(null);
    onActiveCodeChange(pointerCode);
  };

  return (
    <div data-testid="municipality-map">
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={viewBox}
          role="group"
          aria-label={wording?.groupAria ?? message(messages, "municipal.mapAria", { year: MUNICIPAL_PER_RESIDENT_YEAR })}
          className="block h-auto w-full"
          onPointerDown={preview.onPointerDown}
        >
          <defs>
            <pattern id={HATCH_ID} patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(35)">
              <rect width="7" height="7" fill={MAP_NO_DATA_FILL} />
              <path d="M 0 0 V 7" stroke={MAP_NO_DATA_STROKE} strokeWidth="1.2" />
            </pattern>
          </defs>

          {decorativeShapes.map((shape) => {
            const active = isActive(shape.code);

            return (
              <use
                key={`decorative:${shape.code}`}
                data-testid={`municipality-shape-${shape.code}`}
                data-municipality-shape=""
                data-municipality-code={shape.code}
                data-active={active ? "true" : undefined}
                // Pointer-interactive and co-highlighting with its marker, but
                // deliberately not a map target: no tab stop and no second
                // accessible name for the same municipality.
                aria-hidden
                href={`${municipalityMapDefinitions.src}#municipality-shape-${shape.code}`}
                fill={MAP_RAMP[shape.bucket]}
                fillRule="evenodd"
                clipRule="evenodd"
                stroke={active ? "var(--ink)" : "var(--hairline-soft)"}
                strokeWidth={active ? 2.2 : 0.7}
                strokeLinejoin="round"
                className="cursor-pointer"
                onMouseEnter={() => activatePointerTarget(shape.code)}
                onMouseLeave={clearPointerTarget}
                onClick={() => openOnClick(shape.code)}
              />
            );
          })}

          {orderedTargets.map((target, targetIndex) => {
            if (target.kind === "shape") {
              const { shape } = target;
              const active = isActive(shape.code);

              return (
                <use
                  key={`shape:${shape.code}`}
                  data-testid={`municipality-shape-${shape.code}`}
                  data-municipality-shape=""
                  data-municipality-map-target=""
                  data-municipality-code={shape.code}
                  data-active={active ? "true" : undefined}
                  href={`${municipalityMapDefinitions.src}#municipality-shape-${shape.code}`}
                  fill={MAP_RAMP[shape.bucket]}
                  fillRule="evenodd"
                  clipRule="evenodd"
                  stroke={active ? "var(--ink)" : "var(--hairline-soft)"}
                  strokeWidth={active ? 2.2 : 0.7}
                  strokeLinejoin="round"
                  tabIndex={targetIndex === rovingIndex ? 0 : -1}
                  role="link"
                  aria-label={accessibleName(shape.code, shape.nameKa, shape.budgetPerResidentGel, shape.totalBudgetGel, shape.display)}
                  className="cursor-pointer"
                  onMouseEnter={() => activatePointerTarget(shape.code)}
                  onMouseLeave={clearPointerTarget}
                  onFocus={() => activateFocusTarget(shape.code, targetIndex)}
                  onBlur={clearFocusTarget}
                  onClick={() => openOnClick(shape.code)}
                  onKeyDown={(event) => handleTargetKeyDown(targetIndex, shape.code, event)}
                />
              );
            }

            const { marker } = target;
            const active = isActive(marker.code);

            return (
              <circle
                key={`marker:${marker.code}`}
                data-testid={`municipality-marker-${marker.code}`}
                data-municipality-marker=""
                data-municipality-map-target=""
                data-municipality-code={marker.code}
                data-active={active ? "true" : undefined}
                cx={marker.x}
                cy={marker.y}
                r={active ? 9.5 : 7.5}
                fill="var(--positive)"
                stroke="var(--tile)"
                strokeWidth={active ? 2.2 : 1.2}
                vectorEffect="non-scaling-stroke"
                tabIndex={targetIndex === rovingIndex ? 0 : -1}
                role="link"
                aria-label={accessibleName(marker.code, marker.nameKa, marker.budgetPerResidentGel, marker.totalBudgetGel, marker.display)}
                className="cursor-pointer"
                onMouseEnter={() => activatePointerTarget(marker.code)}
                onMouseLeave={clearPointerTarget}
                onFocus={() => activateFocusTarget(marker.code, targetIndex)}
                onBlur={clearFocusTarget}
                onClick={() => openOnClick(marker.code)}
                onKeyDown={(event) => handleTargetKeyDown(targetIndex, marker.code, event)}
              />
            );
          })}

          {/* Fingertip-sized hit areas for municipalities and city markers under
              24px on a phone. Coarse pointers only, so mouse hover and clicks are
              unchanged; hidden from assistive technology, which reaches each
              municipality through its own target. */}
          {touchTargets.map((target) => (
            <circle
              key={`touch:${target.id}`}
              data-map-touch-target={target.id}
              cx={target.cx}
              cy={target.cy}
              r={target.r}
              fill="transparent"
              aria-hidden="true"
              className="pointer-events-none pointer-coarse:pointer-events-auto"
              onClick={() => openOnClick(target.id)}
            />
          ))}

          {occupiedAreas.map((area) => (
            <use
              key={area.key}
              data-testid={`occupied-overlay-${area.key}`}
              data-occupied-overlay=""
              href={`${municipalityMapDefinitions.src}#occupied-overlay-${area.key}`}
              fill={`url(#${HATCH_ID})`}
              fillRule="evenodd"
              clipRule="evenodd"
              stroke={MAP_NO_DATA_STROKE}
              strokeWidth="1.5"
              strokeDasharray="5 4"
              strokeLinejoin="round"
              pointerEvents="none"
              aria-hidden="true"
            />
          ))}
        </svg>

      </div>

      <div aria-live="polite">
        {previewTarget ? (
          <Link
            href={pageHref((hrefForCode ?? municipalityHrefForCode)(previewTarget.code), locale)}
            data-testid="map-touch-preview"
            className="mt-2 flex min-h-11 items-center justify-between gap-3 border-t border-[var(--hairline-soft)] text-[13px] text-[var(--ink)]"
          >
            <span className="min-w-0">
              <span className="font-semibold">{publicLabel(locale, previewTarget.code, previewTarget.nameKa, englishLabels)}</span>
              {" · "}
              <span className="font-[family-name:var(--font-numeric)]">{previewTarget.display ?? formatPerResidentGel(previewTarget.budgetPerResidentGel, locale)}</span>
              {" "}
              {wording?.legendCaption ?? message(messages, "municipal.perResident")}
            </span>
            <span aria-hidden className="text-[var(--accent)]">→</span>
          </Link>
        ) : null}
      </div>

      <div data-testid="municipality-map-legend" className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 border-t border-[var(--hairline-soft)] pt-2.5">
        {/* Minimum and maximum stay on one row at the ramp's two ends; the ramp
            narrows on a phone rather than pushing the maximum onto the next line. */}
        <span data-testid="municipality-map-legend-scale" className="flex min-w-0 items-center gap-3.5">
          <span className="font-[family-name:var(--font-numeric)] text-[11px] whitespace-nowrap text-[var(--faint)] min-[768px]:text-[10px]">{legendMin}</span>
          <span className="flex min-w-12 flex-[0_1_192px]">
            {MAP_RAMP.map((fill) => (
              <span key={fill} aria-hidden className="h-[9px] flex-1" style={{ backgroundColor: fill }} />
            ))}
          </span>
          <span className="font-[family-name:var(--font-numeric)] text-[11px] whitespace-nowrap text-[var(--faint)] min-[768px]:text-[10px]">{legendMax}</span>
        </span>
        <span className="text-[11px] text-[var(--faint)] min-[768px]:text-[10px]">{wording?.legendCaption ?? message(messages, "municipal.perResident")}</span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full border border-[var(--tile)] bg-[var(--positive)]" />
          <span className="text-[11px] text-[var(--faint)]">{message(messages, "municipal.cities")}</span>
        </span>
      </div>
    </div>
  );
}
