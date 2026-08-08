# Municipality Entity-Picker Affordance Design

Date: 2026-08-08  
Status: approved direction; awaiting written-spec review

## Goal

Make the municipality and region name in each entity-page heading unmistakably clickable while matching the approved municipality preview and the existing editorial design system.

## Visual Source

- Open-picker reference: `C:\Users\Mylaptop\AppData\Local\Temp\codex-clipboard-7c4803b6-7d9a-4856-a9b5-16c1dcda716b.png`
- Closed-trigger reference: `C:\Users\Mylaptop\AppData\Local\Temp\codex-clipboard-03312d30-57b1-41cb-bd9e-6fb95db7eee6.png`

The closed-trigger screenshot owns the intended resting treatment: terracotta entity name, subtle underline, and a small downward caret.

## Approved Interaction

The existing `entity-picker-trigger` remains the only interactive element in the heading.

- Resting state: the entity name is always `var(--accent)`, followed by a small `var(--control)` `▾` caret. The underline is a 1px dashed accent rule at 60% opacity rather than the current heavy solid rule.
- Hover state: the 1px dashed underline and caret strengthen to full `var(--accent)` using the project's 120ms color transition. Border width and style stay fixed, so the heading does not move, lift, resize, or gain a background.
- Open state: the name stays terracotta and the caret changes to `▴`. The popover behavior and placement remain unchanged.
- Keyboard focus: the existing global focus-visible treatment remains available and must not be suppressed.
- Reduced motion: the existing global `prefers-reduced-motion` rule continues to remove transition duration.

The project explicitly permits `▾/▴` caret glyphs as part of its control language. No new icon dependency or custom SVG is needed.

## Component and Data Flow

Only `apps/web/components/municipalities/municipal-explorer.tsx` changes. The trigger already receives `pickerOpen` and `triggerLabel`; it can render the appropriate caret directly from that state. `EntityPicker`, routing, focus management, search, active-row styling, and municipality/region data remain untouched.

## Responsive Behavior

The name and caret remain inline inside the existing responsive H1. The caret must not wrap onto its own line; it stays attached to the entity name without changing the heading's current wrapping behavior or causing horizontal overflow at 375, 768, or 900 CSS pixels.

## Accessibility

- Preserve the semantic `button`, `aria-expanded`, and `aria-haspopup="dialog"`.
- Keep the caret `aria-hidden` because `aria-expanded` already communicates state.
- Preserve keyboard activation and focus return from the picker.
- Do not rely on color alone: the underline and caret provide persistent non-color affordances.

## Verification

Add browser coverage that fails on the current trigger and verifies:

1. the closed trigger is terracotta and contains the down-caret;
2. hover strengthens the underline/caret without layout movement;
3. opening the picker changes the caret to the up-state while keeping `aria-expanded="true"`;
4. the same trigger treatment appears on municipality and region pages;
5. existing keyboard and responsive picker tests remain green.

Visual QA compares the supplied closed-trigger screenshot with the rendered closed state and checks the open state at the same viewport. No P0/P1/P2 mismatch may remain before handoff.

## Scope Boundaries

This change does not redesign the picker popover, rows, search field, heading copy, navigation, chart, or any data behavior. It does not address the separate `nanoid` audit failure; that remains a focused dependency follow-up requiring explicit approval.
