# Fiscal.ge Agent Readiness Design

**Date:** 2026-08-28
**Status:** Reviewed implementation scope
**Source:** Ora Is Agentic audit supplied by the owner, rechecked against current `origin/main` and live `https://fiscal.ge`

## Goal

Make Fiscal.ge easier for agents to discover, understand, and recover from invalid URLs without changing the approved visual design, public data, or human-facing navigation.

## Confirmed changes

1. Replace the bare Next.js 404 with a branded, server-rendered recovery page. It must retain HTTP 404 and link to `/`, `/explorer`, `/methodology`, `/sitemap.xml`, and `/llms.txt`.
2. Publish `/llms.txt` in the current llms.txt v2 order: H1, blockquote summary, non-heading guidance, then H2 link-list sections. The guidance must say when Fiscal.ge is useful, what data it covers, and what it does not provide.
3. Protect the already-correct homepage output with a raw-response regression: meaningful text remains above 500 characters without scripts, with one H1 followed by H2 sections.
4. Extend the existing Organization JSON-LD with an email-only `ContactPoint` for general enquiries and strengthen tests for the existing name, description, URL, and email.

## Explicit non-goals

- Do not add homepage copy or alter its heading hierarchy; live raw HTML already exceeds the audit threshold and has one H1 plus four H2s.
- Do not replace Organization/WebSite/DataCatalog/Dataset schema with SoftwareApplication.
- Do not add a physical address, telephone number, `sameAs`, or other unverified identity claim.
- Do not attempt to solve brand ranking through application code. Search Console, indexing requests, press mentions, public profiles, and backlinks remain owner/external work.
- Do not add a public API, database request, dependency, crawler-only hidden content, or visual redesign.

## Markdown negotiation decision gate

Exact acceptmarkdown.com behavior requires request-time parsing of `Accept` preferences, including q-values and explicit rejections, and `Vary: Accept` on both HTML and Markdown responses. In Next.js App Router this requires a `proxy.ts` request layer in front of the statically generated pages.

That would be Fiscal.ge's first request-time application layer and conflicts with the current static-only SEO boundary. A static header rewrite can pass a simple audit probe but cannot follow the published negotiation rules exactly. Therefore:

- do not ship a partial header-only or substring-matching workaround;
- implement the full negotiation task only after the owner explicitly accepts the runtime, latency, caching, and cost boundary;
- keep the Markdown source curated and limited to the canonical discovery pages listed in `/llms.txt`;
- preserve all existing Next.js `Vary` tokens when appending `Accept`.

## Success criteria

- An unknown HTML URL returns 404 and exposes all five recovery destinations in raw HTML.
- `/llms.txt` returns 200 as UTF-8 plain text, follows the published order, contains specific when-to-use guidance, and has no broken internal link.
- Raw homepage HTML still contains more than 500 meaningful text characters, one H1, and H2 sections without JavaScript execution.
- Organization JSON-LD exposes the existing verified identity plus email-only `ContactPoint`; no address or phone is invented.
- If the negotiation gate is approved: canonical HTML requests stay HTML, Markdown-preferred requests return UTF-8 `text/markdown`, unacceptable requests return 406, missing Markdown routes return 404, and every negotiated response includes `Accept` in `Vary` without removing Next.js tokens.
- `npm.cmd run check`, a canonical-host production build, focused browser tests, and `git diff --check` pass.
