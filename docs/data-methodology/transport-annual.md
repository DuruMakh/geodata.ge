# Annual transport data collection and validation

## Purpose and status

This methodology governs the research package at `docs/Raw Data/Transport/geostat-transport-annual/`, collected on 2026-10-20 from the National Statistics Office of Georgia (Geostat). The research captures are immutable. The 4,301 served values (452 indicators), all official, appear on the Transport pages under the approved design `docs/superpowers/specs/2026-10-20-transport-design.md`; see [Serving on the Transport pages](#serving-on-the-transport-pages). Nothing is published through MCP or included in central machine-readable publications.

Geostat is the sole publisher. The package preserves 25 originals under `official/`: the 13 served workbooks (environmental indicator tables H-1 to H-4; goods and passengers transported by railway; metro passengers; airlines registered in Georgia; airports of Georgia; passengers and freight in sea ports and terminals; registered vehicles by region; length of common use roads by region), seven workbooks archived for reference only (railway freight turnover, railway infrastructure, goods by region of loading and unloading, air transport infrastructure 2025, ships entering sea ports, Tbilisi taxi licences, technical inspections 2021–2025) and captures of Geostat's category pages 565, 795, 796, 797 and 802 that link them. Exact URLs, retrieval times, byte sizes and SHA-256 fingerprints live in `source-manifest.csv` and `source-manifest.json`; the package README holds the full cell map.

Geostat's metadata for railway (`0527_200526_EN.PDF`), air (`0526_200526_EN.PDF`) and maritime transport (`0532_200526_EN.PDF`) is linked from the methodology page but is not one of the 25 archived originals. The metadata link printed under tables H-1 to H-4 (`0806_140325_EN.PDF`) returned HTTP 404 on 2026-10-20, so no metadata is linked for those tables.

## Indicators and definitions

| Indicator IDs | Meaning | Source | Coverage |
| --- | --- | --- | --- |
| `transport.fleet.*` | Road motor vehicle fleet, thousand units: by type, each type by fuel, each type by cumulative age | H-3, H-4 | types 2000–2025 (gaps 2004–2005, special also 2006); fuel and age 2017–2025 |
| `transport.passenger_km.*` | Passenger transport demand, million passenger-km, total and by mode | H-1 | 2000–2025 |
| `transport.passenger_km_per_person.total` | Passenger transport demand per capita, km | H-1 | 2000–2025 |
| `transport.passengers.*` | Passengers carried, thousand: railway (total, national, international), metro, airports, Georgian airlines, sea ports | `0504EN030103`, `030105`, `030202`, `030201`, `030401` | railway 2018–, metro and airlines 2012–, airports 2015–, sea ports 2020– (to 2025) |
| `transport.tonne_km.*` | Freight transport demand, million tonne-km, total and by mode | H-2 | 2000–2025 (sea 2000–2008, 2011, 2012) |
| `transport.freight_tonnes.*` | Goods carried, thousand tonnes: railway (total, national, exports, imports, transit), sea ports (total, liquid, general, dry bulk), airports (freight and mail), Georgian airlines | `0504EN030102`, `030403`, `030202`, `030201` | as for passengers |
| `transport.registered.*` | Registered vehicles at the end of the year, thousand: Georgia, 11 regions, Abkhazia, region unknown, each by type, fuel, owner and age band | `Number-of-Registered-Vehicles.xlsx` | 2017–2025 where the year has the column |
| `transport.road_km.*` | Length of common use roads, km: Georgia, 11 regions, Abkhazia, each by international, secondary and local roads | `Length-of-road-Eng-2024.xls` | 2011–2024 |

All rows use `basis=actual` and `value_status=official`. Nothing is calculated, interpolated or imputed.

## Identifiers

Indicator IDs are stable lowercase ASCII names `transport.{measure}.{group}`; the 452 served IDs are listed in `coverage.csv` and in `TRANSPORT_INDICATORS` (`apps/web/lib/data/transport/types.ts`). Regional groups use the site's region IDs (`region_tbilisi`, …), plus `region_abkhazia` and `region_unknown`. Source IDs are `geostat_transport_*` (the registry adds the `source.` prefix). Georgian and English labels are display data, never identifiers. `data/imports/transport-annual.csv` has one row per indicator and year, with the columns `year`, `indicator_id`, `value`, `published_value`, `unit`, `basis`, `value_status`, `source_id`, `source_sheet`, `source_cell` and `last_reviewed_at`. `value` keeps the stored cell's number and `published_value` rounds half-up to one decimal (whole km for passenger-km per person).

## What the pages cover

Annual figures on five pages and a page for Georgia and each of the 11 regions (12 area pages), plus `/methodology/transport`, each mirrored under `/en`: Vehicles (the fleet by type and each type's fuels), Vehicle age (each type's cumulative age rows; passenger cars over 10 years old by default), Passengers (passenger-km by mode and per person, passengers carried), Freight (tonne-km by mode, goods carried) and Regions (registered vehicles of the 11 regions on a map, and a page each for Georgia and the regions with registered vehicles by type, fuel, age and owner, and road length). Quarterly values, 2026, municipalities, taxi licences, technical inspections, railway and air infrastructure and ships are not served.

## Vehicles in the register

H-3, H-4 and the registered-vehicles workbook name the Ministry of Internal Affairs of Georgia as their source; the registered-vehicles workbook says "(end of year; thsd.)". The note "Data for 2008-2025 years includes agricultural machinery" under special vehicles marks a break between 2007 and 2008. `…` ("Data not available or confidential") is a gap: the 2004–2005 totals, special vehicles' 2006 total, and every fuel and age row before 2017.

## Age rows

H-4's rows are cumulative (up to 2 years ⊂ up to 5 ⊂ up to 10); a type's total is up to 10 + over 10 + unknown, checked within 0.1 thousand. The registered-vehicles workbook's bands (`<=2`, `(2-5]`, `(5-10]`, `>10`, unknown) do not overlap and add up to the area's total. H-4's type totals equal H-3's cell for cell; only H-3's are served.

## Passenger-km and tonne-km

One passenger-km is one passenger carried one kilometre; one tonne-km one tonne carried one kilometre. Geostat's air metadata: passenger turnover is "The number of passengers multiplied by flight distance"; its railway metadata counts only the distance inside Georgia on international journeys. H-1 and H-2 note: "Data about road transport in 2005-2025 - according to statistical surveys and experts’ estimation." Their notes on coverage read: "Table covers enterprises of passenger transport activities in Georgia." (H-1) and "Table covers data on enterprises of transport activities in Georgia." (H-2); both are quoted on the methodology page.

## Passengers and goods carried

Airport and airline figures overlap and are never added: airports count passengers served at Georgia's airports (transfer passengers twice) and freight and mail loaded or unloaded there; airlines count passengers and cargo on board flights of airlines registered in Georgia, anywhere. The railway's goods split into national, outgoing (exports), incoming (imports) and transit; transit is goods crossing Georgia by rail between other countries. Railway passenger numbers are based on ticket sales (railway metadata 3.1).

## Regions and roads

Georgia's registered vehicles equal the 11 regions plus Abkhazia and region unknown (within 0.2 thousand); Abkhazia and region unknown have no page. Three columns are served but not listed on the area pages: `type_unknown` (from 2022), `fuel_diesel_gas` (2020 and from 2022) and `fuel_hybrid_diesel` (from 2022). Road length comes from the Roads Department of Georgia and municipal administrations; Tbilisi's roads are "Managed by Roads Department of Georgia since 2012"; from 2021 local roads include roads within settlements and exclude self-governing cities; the 2024 data use the road list of Prime Minister's Decree No. 407 and updated municipal boundaries. Georgia's road length equals the regions plus Abkhazia within 0.2 km. Tbilisi's local roads and Racha-Lechkhumi and Kvemo Svaneti's international roads are 0 in every year; they are served but not listed on the area pages (`TRANSPORT_ZERO_ROWS`), and validation fails if either becomes non-zero. Tbilisi's 0 means not counted, since local roads exclude self-governing cities.

## Rows that are not listed

Nil or zero in every year, checked on every run and not served: inland waterways passenger-km and tonne-km; H-3 diesel-gas and hybrid-diesel of every type, hybrid and hybrid-gas of buses, trucks and special vehicles, gas of special vehicles; H-4 buses of unknown age. H-1 and H-2 percentages, population, GDP and tonne-km per GDP are not served.

## Values as Geostat publishes them

The pages show Geostat's published values and calculate nothing. `-` is nil (served as 0) in H-1, H-4, the railway, airport and sea port tables (the airport tables write `_`; the road table prints one `_`, Tbilisi secondary roads 2015, served as 0). `…` ("Data not available") is a gap, as for sea tonne-km 2009, 2010 and from 2013; H-2's only `-` cells are the unserved inland waterways row. Geostat's legend marks `0.0` as "Negligible magnitude": below 0.05 of the unit, not necessarily none. Only 17 served values come from nil cells. Missing years are gaps, dashes and blank Excel cells, never zero. The pages state no causes.

## Extraction and validation

`prepare.py` locates every column by its printed year heading and every row by its printed label. `python3 -B prepare.py --check` rebuilds every output and rejects a changed value, a missing, extra or duplicate observation, a year outside an indicator's coverage or after 2025, a published value that is not the stored value rounded, a not-served row that is no longer nil, and totals that differ from their parts (1,103 comparisons) beyond tolerance (0.1 national, 0.2 modes and regional), apart from the two recorded rounding differences (`KNOWN_DIFFERENCES`: buses' fuels +0.2 in 2020, special vehicles' −0.2 in 2025). Anchors: passenger cars 2025 1,650.0 and 2000 244.8; electric cars 2025 15.2; cars over 10 years 2025 1,318.9; passenger-km 2025 11,262.1 (air 1,862.6); railway tonne-km 2025 3,814.9; railway transit 2025 7,616.6 thousand tonnes; registered vehicles 2025 Georgia 1,914.9, Tbilisi 855.0, Guria 40.7; metro passengers 2025 147,641.4 thousand. `node verify_independent.mjs` re-reads every cell with SheetJS against separately written label tables, with 12 negative controls. `apps/web/lib/data/transport/validation.ts` repeats the identity, coverage, source-contract, sum and anchor checks in the site's own pipeline.

## Serving on the Transport pages

`npm run data:prepare-transport` writes `data/imports/transport-annual.csv` (UTF-8 with BOM) and `data/reports/transport-validation.json`; `npm run data:check-transport` (part of `data:validate`) rebuilds both in memory and fails on any difference. The Prisma mirror table `TransportFact` (migration `20261020120000_transport`) is filled only by the transactional, parity-checked `npm run data:import`; CSV and database modes serve identical rows.

Routes are `/explorer/transport` with `/vehicles`, `/vehicle-age`, `/passengers`, `/freight`, `/regions` and `/regions/[id]` (Georgia and the 11 regions), plus `/methodology/transport`, each mirrored under `/en`. Excel downloads hold Summary, Data and Sources sheets in the reader's language, with the selected series and years in the selection's unit, empty cells for missing values and validated links to the archived Geostat workbooks the exported values come from (`data/methodology/source-archives/transport.csv`); only the 13 served workbooks are listed. Internal identifiers and cell references are not exported. `/methodology/transport` publishes all 25 originals; the HTML captures download as `.txt` files. The 25 `source.geostat_transport_*` rows of `data/sources/source-documents.csv` stay out of the fact-query snapshot.

## Statistical limitations and future use

Later integration must preserve annual frequency, the 2008 break for special vehicles, the cumulative H-4 age rows, the road-transport estimates from 2005, the airport–airline overlap, the H-2 gaps and the 2021 and 2024 road-definition changes. Quarterly values, 2026, municipalities, the archived-only workbooks and any calculated ratio would each be a separately reviewed addition.

Original sources: Geostat's [environmental indicators](https://www.geostat.ge/en/modules/categories/565/environmental-indicators), [railway](https://www.geostat.ge/en/modules/categories/795/railway-transport-statistics), [air](https://www.geostat.ge/en/modules/categories/796/air-transport-statistics), [road](https://www.geostat.ge/en/modules/categories/797/road-transport-statistics) and [maritime](https://www.geostat.ge/en/modules/categories/802/maritime-transport-statistics) transport pages, and the metadata for [railway](https://www.geostat.ge/media/79116/0527_200526_EN.PDF), [air](https://www.geostat.ge/media/79115/0526_200526_EN.PDF) and [maritime](https://www.geostat.ge/media/79117/0532_200526_EN.PDF) transport.
