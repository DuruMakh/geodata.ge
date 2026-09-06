# Human-readable XML sitemap presentation

Status: Approved by the user on 2026-09-06.

## Goal

Keep `https://fiscal.ge/sitemap.xml` as the machine-readable sitemap consumed by search engines, while making the same URL easier for a person to inspect in a normal browser.

## Decision

Add a standard XML stylesheet presentation layer to the sitemap. The underlying `<urlset>` data remains unchanged, including the Georgian and English URLs, `lastmod` values, and reciprocal `hreflang` links. Browsers that support XML stylesheets will show a compact technical table; crawlers that read the XML will continue to receive the same valid sitemap structure.

## Presentation

- Keep the existing XML document and content type.
- Add an `xml-stylesheet` processing instruction pointing to a static `/sitemap.xsl` asset.
- Render one row per sitemap URL with the URL, last-modified date, and available language links.
- Use a restrained, readable technical style with clear spacing, wrapping long URLs, and responsive behavior on narrow screens.
- Do not add the sitemap to the product’s human-facing navigation or change the approved Fiscal.ge application design system.

## Compatibility and safety

- Preserve the existing route inventory and bilingual `hreflang` data exactly.
- Do not convert the sitemap to HTML or remove XML semantics.
- Keep the stylesheet as a separate static asset so it can fail independently without changing crawler data.
- Verify XML parsing, URL count, language alternates, and the visible browser presentation.

## Verification

- Unit or route-level regression coverage proves the sitemap still emits the same URL and alternate-language records.
- A browser check confirms `/sitemap.xml` loads as XML, references the stylesheet, and presents readable rows without console errors or horizontal overflow at desktop and mobile widths.
- Run the repository’s required checks before claiming completion.
