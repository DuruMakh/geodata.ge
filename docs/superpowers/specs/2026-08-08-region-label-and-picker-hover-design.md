# Region Label and Entity-Picker Hover Design

## Goal

Make region pages easier to scan and make every entity-picker option visibly interactive.

## Approved behavior

- Region page headings keep the existing `როგორ იხარჯება` title and use only the taxonomy label as the clickable trigger: `აჭარა`, `იმერეთი`, and the other canonical region names.
- Municipality page heading wording remains unchanged.
- Region picker rows retain their grouped tint at rest. On hover they transition in 100ms to terracotta text with a terracotta left rule.
- Municipality picker rows transition in 100ms to the existing pale tint, terracotta text, and terracotta left rule.
- All picker options use the pointer cursor.
- Keyboard active state, current-page state, routing, focus handling, search, layout, and values remain unchanged.
- No movement, transforms, new icons, or popover redesign.

## Implementation boundary

- Change the region route's `triggerLabel` to `region.kaLabel`.
- Change only option-row classes in `EntityPicker`.
- Protect the region heading and both row hover states with browser tests.

## Verification

- Confirm the new region heading text at desktop and narrow widths.
- Confirm both region and municipality option rows react on hover without layout movement.
- Run focused browser tests, repository checks, build, and the complete browser suite.
