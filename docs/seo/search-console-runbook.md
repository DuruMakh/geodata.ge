# Fiscal.ge Search Console Runbook

## Property and sitemap

1. Verify the `fiscal.ge` Domain property through the DNS record Google supplies.
2. Submit `https://fiscal.ge/sitemap.xml`.
3. Record the submission date, discovered URL count, and any sitemap error in the monthly baseline.

## Representative URL inspection

Inspect these live URLs after every SEO release:

- `https://fiscal.ge/`
- `https://fiscal.ge/explorer/expenditure`
- `https://fiscal.ge/explorer/revenue`
- `https://fiscal.ge/explorer/analysis`
- `https://fiscal.ge/explorer/municipalities`
- `https://fiscal.ge/explorer/municipalities/04`
- `https://fiscal.ge/explorer/municipalities/region/imereti`
- `https://fiscal.ge/methodology`
- `https://fiscal.ge/methodology/expenditure`
- `https://fiscal.ge/about`

For each URL, record:

- page availability and indexability;
- referring sitemap;
- user-declared canonical;
- Google-selected canonical;
- last crawl date;
- detected structured data and any error.

Request indexing only for this representative sample after the live test passes. Do not manually request all municipality pages.

## Monthly performance export

Use a complete 28-day date range and export:

- queries;
- pages;
- devices;
- countries;
- search appearance.

Classify queries as branded (`fiscal`, `fiscal.ge`) or non-branded, then group non-branded Georgian queries into national budget, expenditure, revenue, municipality/region, download, and methodology intent.

Search Console is the indexing and organic-search source of truth. Do not infer indexing from `site:` searches or infer traffic from Vercel deployment views.

`geodata-ge.vercel.app` is outside this production SEO runbook. The owner will configure that hostname separately as a preview surface.
