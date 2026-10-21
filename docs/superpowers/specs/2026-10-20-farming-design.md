# Farming page in the Energy and food hub

Date: 2026-10-20
Status: Approved by Duru on 2026-10-20 ("Approve one page"). Duru picked "Farming, as a small page" from the second more-data list on 2026-10-20 and asked for it in its own thread. A full farming hub was judged too niche on 2026-10-11, so this adds **one page** to the existing Energy and food hub. Food self-sufficiency stays as it is. The page serves about 710 Geostat values.

## 1. Intended result

Fiscal.ge readers should be able to see what Georgian farms produce, how many animals they keep and what farmers are paid, every year Geostat publishes.

The page answers four questions:

- How much is Georgian farming worth? Farm output was 8,384.9 million ₾ in 2025 (preliminary), against 2,777.4 million in 2010, at current prices.
- How big are the main harvests? In 2025: grapes 348.9 thousand tonnes, maize 208.6, potatoes 206.7, wheat 145.3, hazelnuts 49.3.
- How many animals are there? Cattle fell from 1,080.3 thousand in 2006 to 761.6 thousand at the end of 2025; poultry rose from 5.4 to 8.6 million.
- What are farmers paid? In 2025, 1 kg of wheat sold at the farm for 0.57 ₾, beef for 21.38 ₾ and hazelnuts for 5.85 ₾; a litre of milk for 1.63 ₾.

The page keeps the production editorial look and reuses the Energy and food explorer, the headed series list and the "one unit at a time" rule that Business, Housing and Crime already use. No new chart type, chart library or visual direction is added.

## 2. Page and navigation

| Page | Georgian path | English path | Georgian name (proposal) |
| --- | --- | --- | --- |
| Farming | `/explorer/energy-food/farming` | `/en/explorer/energy-food/farming` | სოფლის მეურნეობა |

- The hub gets a fifth card, **Farming**, after Food self-sufficiency, with its coverage years and a small chart of total farm output. The hub title stays "Energy and food" (ენერგეტიკა და სურსათი); its one-line summary adds farming.
- The sidebar lists Farming as the fifth page under Energy and food.
- Breadcrumbs, heading, language link, metadata, Dataset JSON-LD and the sitemap follow the other four pages.
- Georgian names are proposals and follow Geostat's Georgian agriculture files, which are downloaded for that purpose.

## 3. Page layout

Same rules as the other Energy and food pages:

- Under the heading only one short line: **"Farm output · 2025: 8,384.9 million ₾"**. It must fit on one line on a phone.
- No tabs and no icon switches. One series list on the right holds every series, flat, under five small headings. Nothing is tucked under an expandable row.
- Only **Farm output, total** is selected first. It stays first, selectable and removable.
- The chart shows one heading's unit at a time: ticking a row under another heading, or of another unit, replaces the selection (the Business rule, with the heading as the group as on Education's place pages). Harvests and meat are both in thousand tonnes but stay separate charts, so no chart holds more series than the palette has colours and no two lines share a colour. The twelve prices share one chart.
- Each heading's rows show their latest value in the list. The year range fits the selected unit: prices start in 2014, farm output in 2010, everything else in 2006.
- Chart | Table, the year range and Excel work as on the other pages, and the selection lives in the URL.
- One short source line under the chart, with the methodology link.

## 4. The series list

| Heading | Rows | Unit | Years |
| --- | --- | --- | --- |
| Farm output | Total (selected first), Crops, Livestock, Farm services | million ₾, current prices | 2010–2025 |
| Harvests | Wheat, Barley, Maize, Beans, Potatoes, Vegetables, Melons and watermelons, Grapes, Apples, Peaches and nectarines, Tangerines, Hazelnuts, Walnuts | thousand tonnes | 2006–2025 |
| Livestock | Cattle, Dairy cows, Pigs, Sheep and goats, Poultry | thousand head, end of year | 2006–2025 |
| Meat, milk and eggs | Meat, Beef, Pork, Sheep and goat meat, Poultry meat (thousand tonnes); Milk (million litres); Eggs (million) | as shown | 2006–2025 |
| Farm-gate prices | Wheat, Maize, Potatoes, Tomatoes, Apples, Grapes, Hazelnuts, Beef, Pork, Poultry meat (per kg); Milk (per litre); Eggs (per piece) | ₾ | 2014–2025 |

That is 41 rows. Each chosen row runs without gaps over its years. Rows Geostat only publishes from 2016 (winter and spring wheat, white and red grapes, chicken) are left out so no row starts with a long gap.

The twelve prices share one ₾ axis; the list row names say "per litre" and "per piece" for milk and eggs, so nothing is compared without its unit.

Values show as Geostat prints them: one decimal for quantities and output, two decimals for prices.

## 5. Data rules readers see

Stated on the methodology page:

1. **Source.** Every value is Geostat's published number from its Agriculture statistics. Nothing is recalculated.
2. **Survey change in 2016.** Geostat enlarged its farm survey in 2016 and revised 2006–2015 so the years can be compared. Some detailed rows exist only from 2016; they are not shown.
3. **Preliminary year.** Geostat marks 2025 farm output as preliminary. The Excel file marks those values.
4. **Current prices.** Farm output and farm-gate prices are in current lari, not adjusted for inflation.
5. **Yearly only.** Geostat's quarterly livestock tables are not used.
6. **No causes stated.** The page describes the figures without explaining why they changed.

## 6. Data foundation

### Sources

Geostat, Agriculture (`https://www.geostat.ge/en/modules/categories/196`), downloaded fresh in English, with Georgian versions kept for labels:

| File | Served rows |
| --- | --- |
| `1.General_Agro_Sector_Statistics_ENG.xlsx` (media/80145), sheet "AG. output" | Farm output, 4 rows, 2010–2025 |
| `3.Production_of_Annual_Crops_ENG.XLSX` (media/80146), sheet "Production" | 7 harvest rows, 2006–2025 |
| `6.Production_of_Permanent_Crops_ENG.xlsx` (media/80149), first sheet | 6 harvest rows, 2006–2025 |
| `8.Livestock_Numbers_(Annual)_ENG.xlsx` (media/80150), first sheet | 5 livestock rows, 2006–2025 |
| `10.Livestock_Products_(Annual)_ENG.XLSX` (media/82387), first sheet | 7 product rows, 2006–2025 |
| `17.Agricultural_Production_Prices_ENG.XLSX` (media/81972), sheet "Prices" | 12 price rows, 2014–2025 |

### Research package and checks

The farming files join the existing Energy and food research package (`docs/Raw Data/EnergyFood/geostat-energy-food-annual/`): originals under `official/`, source manifest with URL, date, SHA-256 and size, every served cell transcribed with its file, sheet and cell, plus the independent verification. Rows and columns are found by their label text, not by position.

New checks, on top of the existing ones (missing, extra or duplicate values, changed labels, unexpected "…" cells):

- farm output total equals crops + livestock + services within 0.5;
- meat equals beef + pork + sheep and goat + poultry + other meat within 0.2; milk equals cow and buffalo milk + sheep and goat milk within 0.2;
- dairy cows never exceed cattle;
- where the Food Balance Sheets already on the site give production of wheat, maize, potatoes, grapes, meat, milk or eggs for the same year, it matches the production table within 1 (the balance sheets print whole thousand tonnes, for example wheat 2025: 145 against 145.3);
- spot values from section 1.

### Serving

- The farming values are added to the existing `data/imports/energy-food-annual.csv` and the existing `EnergyFoodFact` database table, which already stores any unit. **No database migration is needed.** CSV and database modes must agree, checked by the existing parity check.
- The page is prerendered like the other four.

## 7. Excel and methodology

- Excel reuses the Energy and food workbook: selected series and years, units, basis, preliminary marks and validated source links.
- `/methodology/energy-food` gets a Farming section in plain words: what farm output means, the harvests and livestock tables, farm-gate prices, and rules 1–6 above.
- The six workbooks join the Energy and food source archive.

## 8. Out of scope

A regional map: Geostat's crop tables by region name only the 3–5 main growing regions and group the rest as "other regions", so a map would be mostly empty (livestock by region is complete only from 2016). Also out: sown area and yields, fertilisers and pesticides, farm-holding surveys, quarterly livestock, retail food prices (inflation pages cover prices), MCP tools and JSON publications. Each would need its own approval.

## 9. Verification

1. The canonical CSV reproduces every served value from its original cell; the independent verification and the new checks pass; CSV and database modes agree.
2. The default selection, headings, one-unit rule and URL state behave as in section 3; the latest line reads the numbers in section 1.
3. Chart, table and Excel agree for the same settings.
4. Georgian and English work at 390, 768 and 1440 pixels.
5. A live preview goes to Duru first. After Duru approves it, run `npm run check`, `npm run build` and `npm run test:browser` once, then push and open the PR.

Also updated during implementation: `Project_Definition.md` section 2 (Energy and food gains a Farming page; the earlier exclusion of crop and livestock production and farm prices is lifted for this page), `DESIGN.md` (the fifth page) and `docs/data-methodology/energy-food-annual.md`.

## 10. Reuse

- **Used as is:** the Energy and food page module, routes pattern, hub cards, workbook writer, source archive, methodology components; `unitList.ts` (one unit at a time and list-row latest values); the headed series list Crime and Business use; `EditorialLineChart`, `ExplorerTable`, `RangeStrip`, `LatestValueLine`.
- **Small additions:** `ENERGY_FOOD_SECTIONS` gets `farming`; Energy and food series definitions get an optional heading and per-series unit, whose absence leaves the four existing pages unchanged; the prepare script and research package read six more workbooks; messages gain the farming labels.
- **Genuinely new:** the farming row definitions, the Georgian and English labels and the farming methodology text. No new component.

## 11. Coordination

Many hub threads are building in parallel (social protection, transport, internet, environment, science and culture, GDP by spending, jobs by industry, marriages and divorces). This page touches the shared sidebar, sitemap, methodology catalogue and browser-test page counts. It does not wait for them: whichever merges second redoes those shared edits.

## 12. Decision for Duru

Approve this design. The implementation plan comes next. Approving the design does not authorize pushing, a pull request or deployment; a live preview comes first.
