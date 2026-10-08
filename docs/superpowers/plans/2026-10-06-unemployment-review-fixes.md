# Four approved review fixes

The user approved fixing the four Minor findings from the full worktree review. Preserve the existing mixed changes and source data; publishing remains separate.

1. Add regression checks for regional detail sidebar state, comparison instructions, Georgian child-label spacing and map focus after pointer movement. Run them against the current implementation to confirm the failures.
2. Apply the smallest corrections: permit wrapped labels to shrink, preserve independent map pointer/focus targets, recognize regional detail paths in the sidebar, and provide bilingual comparison instructions.
3. Run focused checks, then the required project check, static build and browser suite once final inputs are ready. Inspect the label and map behavior and obtain a read-only review of the bounded fixes.

## Verification ledger

- Before implementation, both detail-route sidebar cases failed for missing active state. The five browser regressions reproduced map highlight loss in Economy and Unemployment, misleading comparison instructions in both languages, and a five-pixel Georgian label overlap at 1440px.
- Focused verification: 36 unit checks passed; all five formerly failing browser cases passed against the rebuilt preview. The Georgian desktop screenshot was inspected, and the live Tbilisi page now marks Regions active.
- Bounded read-only review confirmed all four fixes, with no new Critical/Important findings. The installed Tailwind compiler also confirms the wrapping rules are generated correctly.
- Production build passed. `npm run check` passed with 3,011 unit tests, seven existing skips, valid data and translations. No data or database changes were made.
- Full `npm run test:browser` passed: all 705 scenarios, including both maps, both comparison languages, Georgian desktop spacing, regional sidebar states and existing charts/downloads. `git diff --check` passed.
- Complete locally: the rebuilt preview remains on port 3127. Existing mixed work is preserved; no commit, publication or live database import was performed.
