# Approved temporary security exception

The owner approved option three on 2026-10-03: a narrow documented exception for
GHSA-vfj7-8cjw-p6xm, after verifying its input path. The policy is accepted risk,
not remediation. `docs/deployment.md` owns the scope, exact versions, expiry
(2026-11-02 00:00 UTC), reassessment and removal procedure.

The installed Next ESLint helper obtains glob patterns only from trusted
repository settings; no `next.rootDir` setting exists here, so it uses the
working directory. The lockfile marks the five reviewed packages development-only.
The actual built MCP trace contains none of braces/micromatch/fast-glob. No
external request/data input supplies a pattern to this path. No dependency,
source fact, public route, transport limit or production environment changed.

The audit command still includes development dependencies and prints npm's
unfiltered JSON. Recursive causes accept only this exact advisory and the
reviewed package paths/versions; other high/critical advisories, mixed causes,
production use, changed paths/versions, expiry, invalid reports and registry
failures remain blocking. The existing three attempts remain.

Independent review initially identified two Important scope gaps: ancestor
versions were not checked, and a malformed audit could understate a direct
advisory's severity. Both were reproduced and repaired, with specific regression
tests. The re-review approved the policy with no remaining Critical/Important/Minor
finding. It declined to judge deployment/exposure evidence and full gates, which
the controller verifies separately.

Final focused verification: **25 tests passed**, typecheck and scoped lint passed,
and the real npm audit passed while explicitly logging accepted risk for only
the advisory's five packages. The Windows subprocess deprecation warning concerns
fixed arguments, with no interpolated request input; it does not change the
policy outcome.

The broad local check overlapped the review tightening and loaded an earlier
synthetic critical fixture. It recorded **2,737 passed / one failed / seven
database skips**; that one fixture contradicted the newly enforced parent-severity
consistency rule. The final fixture uses a consistent critical chain and remains
blocking; all 25 final policy tests passed. No economic numeric expectation was
changed. This supports **2,738 passing unit tests plus seven skips** when combined
with the final affected-file check, rather than a successful combined-run claim.
The remaining data/localization stages passed separately before push.

Release must still pass fresh required CI on the final immutable commit, followed
by the existing Actions import/parity/database-build pipeline and actual deployed
commit/live proof. Earlier local implementation and browser evidence retain their
original artifact identities.

## Subsequent CI scheduling repair

GitHub CI at `7082c7ec` passed the approved audit and browser job, then timed out
four resource-intensive suites: full and bilingual publications, serving parity,
and the packaged measurement subprocess. No result assertion disagreed with a
reviewed number. These four files now use the existing isolated sequential test
group; all assertions and 30/60-second setup/subprocess budgets are unchanged.
They remain included exactly once and excluded from the ordinary parallel group.
Independent review approved this scoped runner change. Its comment now describes
isolation accurately without promising execution before other groups.

All **28 tests across those four suites passed** in the focused one-worker run;
typecheck and scoped configuration lint passed. Fresh required CI on the final
commit still owns release acceptance.
