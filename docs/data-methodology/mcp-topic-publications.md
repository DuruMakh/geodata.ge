# Topic datasets in `/mcp` and the bulk files

This note owns how the Explorer's chart pages are served through the read-only `/mcp` endpoint and as bulk CSV files. It records the rules a caller needs; the reviewed data of each page is described in that page's own methodology note under `docs/data-methodology/`.

## What is served

Every Explorer chart page that is not one of the core datasets' pages is one **topic dataset**: 91 topic datasets beside the 11 core datasets (102 in `catalogue.json`). The dataset id is the page path after `/explorer/`, with `/` written as `-` (`/explorer/education/schools` is `education-schools`). Place pages (a region, a municipality, a city) are entities of the dataset of the national page they belong to. Topic data is annual; a school year prints as `2025/26`, and a value that comes from a household or labour survey is a survey estimate, not a count. The tool is `query_indicators`; `compare` and `rank` work on topic series and places, and `get_sources` resolves the sources a dataset cites.

A dataset serves exactly what its page shows: the page's series, places and years, never a row the page hides or a discontinued line. The value is the number the page's own model carries. Per-person figures, shares of GDP and rates that the browser calculates are not served; where the page itself sums rows, the value is marked `derived`. A missing cell stays missing (`availability: "missing"`), and zero is a value. Municipal codes `05`, `42`, `43`, `46` and `64` are never entities.

Each dataset is also one file, `/downloads/data/topics/<datasetId>.csv`, UTF-8 with BOM and without the internal `source_sheet`, `source_cell`, `source_workbook` and `source_number_format` columns. A query that would return too many values is refused with the link to that file.

## Caveat codes added for topics

`topic_survey_estimate` (note), `topic_derived` (note), `topic_partial_period` (severe, limits comparison), `topic_planned` (severe), `topic_preliminary` (note, limits comparison), `topic_projection` (severe, breaks comparison), `topic_series_break` (severe, breaks comparison: a reviewed break inside the requested years, with its reason) and `topic_dated_period` (severe, limits comparison: a value at a date inside the year). The codes and their wording are owned by `ai-grounding-and-caveats.md`.

## Change between two periods

`compare` and `rank` are the only places a change is calculated.

- A unit in percent (a rate or a share in %) changes in percentage points, never as a percentage, as for the core rates.
- A temperature (unit `celsius`) is on an interval scale: zero is not an absence. Only the absolute change is given, never a percentage change.
- A change across a registered series break is `not_comparable` in `compare` and excluded with its reason in `rank` (the 2024 census re-base of population, for example).
- A ranking by series ranks like with like, for one place: the series under one heading, in the unit of the series named (thousand persons never rank beside a rate, tonnes beside litres, GEL beside a share of GDP). A heading's total is left out, and so is any series whose own parts are in the same ranking (Total VAT breaks beside the VAT breaks). By `parentSeriesId`, a parent whose children the page lists under several headings, each a breakdown of its own (trade partners by country and by country group, foreign investment by country and by sector), ranks the children under one heading: that of `seriesId` when given, else the first. A series under no heading and with no parent (the interest rates) has no peers and is refused with that reason. A total the source states without linking its parts (Total consumption beside Households, Meat beside Beef) is not detected.

## Known limits of the served groups

- **Combined historical regions.** The two combined historical region groups in the labour and unemployment data are typed `region`, with no historical marker. They are not current regions and do not add up with the eleven regions.
- **Trade country groups.** The trade partner groups (EU, CIS and the like) share a parent with the individual countries but sit under their own heading, and they overlap the countries they contain. `rank` by that parent ranks the countries only; the groups rank among themselves (a `seriesId` under the groups' heading).
