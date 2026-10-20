# Annual energy balances, food self-sufficiency and farming (Geostat)

Research package for the Fiscal.ge Energy and food hub. Approved designs: `docs/superpowers/specs/2026-10-11-energy-food-design.md` and, for the Farming page, `docs/superpowers/specs/2026-10-20-farming-design.md`. Everything here is reproducible from the files in `official/`, which are never edited.

## Sources

The energy and food files were retrieved on 2026-10-11 and the farming files on 2026-10-20 from Geostat, the National Statistics Office of Georgia. Each workbook was downloaded again from its `geostat.ge/media` link and its bytes matched the copy first fetched into the project's source folder. Exact URLs, SHA-256 hashes and byte sizes are in `source-manifest.csv` and `source-manifest.json`. The page captures are archival and are not compared byte for byte.

| Source ID | Local file | Contents |
| --- | --- | --- |
| `geostat_energy_balance_{year}_aggregated` (12) | `official/energy-balance-{year}-aggregated.xlsx` | "1. Aggregated Energy Balance", sheets `TJ` and `KTOE`, 2013–2024. Only `KTOE` (thousand tonnes of oil equivalent) is used. |
| `geostat_energy_balance_{year}_electricity` (12) | `official/energy-balance-{year}-electricity.xlsx` | "2. Electricity and heat", sheets `GWh&TJ` (spelled `GWH&TJ` from 2014), `TJ`, `KTOE`. Only the `Electricity (GWh)` column of the GWh sheet is used. |
| `geostat_energy_efficiency` | `official/energy-efficiency.xls` | Energy efficiency indicators 2013–2024. Used only to cross-check total supply and final consumption. |
| `geostat_food_balance_sheets` | `official/food-balance-sheets.xlsx` | Food balance sheets, 12 sheets, 2014–2025, with the self-sufficiency ratio. |
| `geostat_energy_balance_2024_aggregated_ka`, `geostat_food_balance_sheets_ka` | `official/ka/…-ka.xlsx` | Georgian-language versions, kept as label references. No value is read from them. |
| `geostat_farming_general` | `official/farming-general.xlsx` | "1. General agricultural statistics", sheet `AG. output` (farm output, current prices, million GEL, 2010–2025; 2025 is starred preliminary). |
| `geostat_farming_annual_crops` | `official/farming-annual-crops.xlsx` | "3. Production of annual crops", sheet `Production` (thousand tonnes, 2006–2025). |
| `geostat_farming_permanent_crops` | `official/farming-permanent-crops.xlsx` | "6. Production of permanent crops", first sheet (thousand tonnes, 2006–2025). |
| `geostat_farming_livestock_numbers` | `official/farming-livestock-numbers.xlsx` | "8. Livestock numbers (annual)", first sheet (end of year, thousand head, 2006–2025). |
| `geostat_farming_livestock_products` | `official/farming-livestock-products.xlsx` | "10. Livestock products (annual)", first sheet (thousand tonnes; milk million litres; eggs million pieces; 2006–2025). |
| `geostat_farming_prices` | `official/farming-prices.xlsx` | "17. Agricultural production prices", sheet `Prices` (farm-gate price, GEL per kg, milk per litre, eggs per piece, 2014–2025). |
| `geostat_farming_{…}_ka` (6) | `official/ka/farming-…-ka.xlsx` | Georgian-language versions of the six farming workbooks, kept as label references. No value is read from them. |
| `geostat_agriculture_page` | `official/agriculture-page.html` | Capture of the Agriculture page (`https://www.geostat.ge/en/modules/categories/196`). |
| `geostat_energy_balance_page_{year}` (12), `geostat_energy_balance_index_page`, `geostat_food_security_page` | `official/energy-balance-page-{year}.html`, `energy-balance-index-page.html`, `food-security-page.html` | Captures of the source pages. |

Pages (all `https://www.geostat.ge/en/modules/categories/<id>`): Energy Balance of Georgia 2013 → 82, 2014 → 83, 2015 → 84, 2016 → 85, 2017 → 86, 2018 → 631, 2019 → 681, 2020 → 719, 2021 → 786, 2022 → 821, 2023 → 864, 2024 → 891; index page 328; Food Security 297; Energy Efficiency Indicators 789 (efficiency workbook only). The workbook links are the ones printed on those pages, for example `https://geostat.ge/media/75778/Energy-efficiency_ENG.XLS` and `https://geostat.ge/media/80160/1.Food_Balance_Sheets_ENG.xlsx`. The 2025 energy balance is not published, so energy ends in 2024.

## Outputs

- `energy-food-annual.csv`: the 1,389 primary observations (681 energy and food, 708 farming), one row per indicator and year. Columns: `year, indicator_id, value, published_value, unit, basis, value_status, source_id, source_sheet, source_cell, source_label, source_number_format`.
  - `value` is the cell's exact stored decimal token (for example `138.69999999999999`), or `0` for a dash.
  - `published_value` is the value as Geostat displays it. Excel keeps 15 significant digits, so the stored value is cut to 15 digits and then rounded half-up. Energy and electricity show one decimal (`5099.0`, and `2235.45` shows as `2235.5`). A food ratio follows its own cell's number format like every other row: `0` shows whole percent (meat 2024 `47.1` publishes as `47`, milk 2025 `68.4` as `68`, eggs 2024 `96.5` as `97`) and `General` shows the stored value (all whole numbers, for example `22`). The exact stored value stays in `value`. The build fails on any other food number format.
  - Farming values follow their cell's number format too: `#,##0.0`, `0.0` and `#\ ##0.0` show one decimal, `0.00` two; a `General` price cell shows its stored value, which must have at most two decimals (`6.28`).
  - `unit` is `ktoe`, `gwh` or `percent`, and for farming `million_gel`, `thousand_tonnes`, `thousand_head`, `million_litres`, `million_pieces`, `gel_per_kg`, `gel_per_litre` or `gel_per_piece`; `basis` is always `actual`; `value_status` is `published`, `no_flow` (energy dash) or `preliminary` (farming year heading with a star).
  - `source_label` is the row label and column heading as printed (`DOMESTIC SUPPLY | Total`).
- `coverage.csv`: the first and last year and the count for each indicator.
- `validation-report.json` (from `prepare.py`) and `independent-validation.json` (from `verify_independent.mjs`).

## Cell map

`prepare.py` finds every row by its normalised label text and every column by its heading text, never by fixed position. A label is normalised by collapsing whitespace, ignoring case and dropping footnote marks such as `quarrying1`, `steel[1]` and `Import *`. Rows below `FINAL CONSUMPTION` are the first match after it, because the same words reappear later in the non-energy-use block.

| Indicator IDs | Sheet, row, column | Years | Rows |
| --- | --- | --- | --- |
| `energy.supply.{total, coal, crude_oil, oil_products, natural_gas, hydro, wind_solar_geothermal, biofuel_waste, electricity}` | `KTOE`; row `DOMESTIC SUPPLY`; columns Total, Coal, Crude oil, Oil products, Natural Gas, Hydro, Geothermal/wind/solar, Biofuel & Waste, Electricity | 2013–2024 | 108 |
| `energy.production.total`, `energy.exports.total` | `KTOE`; rows `Production`, `Exports`; column Total | 2013–2024 | 24 |
| `energy.imports.{total, coal, crude_oil, oil_products, natural_gas, electricity}` | `KTOE`; row `Imports` | 2013–2024 | 72 |
| `energy.final.{total, industry, transport, commercial_public, households, agriculture, other_unspecified, non_energy}` | `KTOE`; column Total; rows `FINAL CONSUMPTION`, `Industry`, `Transport`, `Commercial and public services`, `Residential`, `Agriculture/forestry/fishing`, `Not elsewhere specified (Other)`, `Non-energy use` | 2013–2024 | 96 |
| `energy.final_fuel.{coal, oil_products, natural_gas, wind_solar_geothermal, biofuel_waste, electricity}` | `KTOE`; row `FINAL CONSUMPTION`; fuel columns | 2013–2024 | 72 |
| `electricity.production.total`, `electricity.imports`, `electricity.exports`, `electricity.losses` | `GWh&TJ`; column `Electricity (GWh)`; rows `Production`, `Imports`, `Exports`, `Losses` | 2013–2024 | 48 |
| `electricity.production.{thermal, hydro, wind}` | same column; `MA Thermal Electricity Plants`, `MA Hydro Electricity Plants`, `Wind Electricity Plants` inside the `Transformation Sector-Production` block (ending at `Energy Sector`) | wind 2016–2024, others 2013–2024 | 33 |
| `electricity.final.{total, industry, transport, commercial_public, households, agriculture, other_unspecified}` | same column; `FINAL CONSUMPTION`, `Industry`, `Transport`, `Commercial and public services`, `Residential`, `Agriculture/forestry/fishing`, `Not elsewhere specified (Other)` | 2013–2024 | 84 |
| `food.self_sufficiency.{wheat, maize, potato, vegetables, grapes, meat, beef, pork, sheep_goat_meat, poultry_meat, milk, eggs}` | the 12 sheets Wheat, Maize, Potato, Vegetables, Grapes, Meat, Beef, Pork, Sheep and Goat Meat, Poultry Meat, Milk and Milk Products, Egg; row `Self-sufficiency ratio, %` (Egg: `Self-sufficiency ratio,%`); year columns | 2014–2025 | 144 |

| `farming.output.{total, crops, livestock, services}` | `AG. output`; rows `Output of agriculture, total`, `Plant growing`, `Animal husbandry`, `Agricultural services` | 2010–2025 | 64 |
| `farming.harvest.{wheat, barley, maize, beans, potatoes, vegetables, melons}` | `Production`; rows `Wheat, total`, `Barley, total`, `Maize`, `Haricot Beans`, `Potato`, `Vegetables, total`, `Melons` | 2006–2025 | 140 |
| `farming.harvest.{grapes, apples, peaches, tangerines, hazelnuts, walnuts}` | `Permanent Crops production`; rows `Grapes`, `Apple`, `Peach, nectarine`, `Tangerine`, `Hazelnut`, `Walnut` | 2006–2025 | 120 |
| `farming.livestock.{cattle, dairy_cows, pigs, sheep_goats, poultry}` | `Number of livestock`; rows `Bovine animals`, `Dairy cows and buffaloes`, `Pigs`, `Sheep and goats`, `Poultry, ths. heads` | 2006–2025 | 100 |
| `farming.products.{meat, beef, pork, sheep_goat_meat, poultry_meat, milk, eggs}` | `Livestock products`; rows `Meat, total`, `Beef`, `Pork`, `Sheep and goat`, `Poultry`, `Milk (mill. litres)`, `Egg (mill. pieces)` | 2006–2025 | 140 |
| `farming.price.{wheat, maize, potatoes, tomatoes, apples, grapes, hazelnuts, beef, pork, poultry_meat, milk, eggs}` | `Prices`; rows `Wheat`, `Maize`, `Potato`, `Tomato`, `Apple`, `Grapes`, `Hazelnut`, `Beef`, `Pork`, `Poultry meat`, `Milk (1 litre)`, `Egg (1 piece)` | 2014–2025 | 144 |

Farming year columns are read from the first row with at least five year headings (row 2, or row 3 under `Name` in the prices sheet).

By page group: supply page 204 (108 + 24 + 72), use page 168 (96 + 72), electricity 165, food 144, farming 708, in all 1,389. Sheets are found through the workbook's own relationship file, because the order of sheets in `workbook.xml` need not match the order of the parts.

## Checks

`prepare.py` rejects:

- a duplicate, missing or extra observation, or a year outside coverage;
- a published value that is not the stored value as displayed, or a row that differs from a fresh read of its source cell, number format or printed row and column label;
- a cell that is neither a number nor a dash, and in particular a "…" cell;
- production + imports − exports − international marine bunkers − international aviation bunkers + stock changes differing from domestic supply by more than 0.2, for each of the 11 fuel columns (including Total) and each year;
- a Total column that differs from the sum of its fuel columns by more than 0.5 for supply, imports and final consumption;
- final consumption differing from industry + transport + commercial and public services + residential + agriculture + not elsewhere specified + non-energy use by more than 0.5 ktoe, and electricity final consumption differing from industry + transport + the four other sectors by more than 0.5 GWh;
- electricity production differing from thermal + hydro + wind by more than 0.5 GWh (wind is counted as 0 before 2016 inside this check only);
- electricity domestic supply − energy sector − losses differing from final consumption by more than 0.5 GWh;
- a food ratio more than 10 points from production ÷ (production + import − export) × 100 on the same sheet. Most published ratios match the formula and a few differ, for example sheep and goat meat 299 published against 291 by the formula in 2017 (no reason for the difference is given);
- farm output total differing from crops + livestock + services by more than 0.5 (2010–2025);
- meat differing from beef + pork + sheep and goat + poultry + other meat (read for this check only) by more than 0.2, and milk from cow and buffalo milk + sheep and goat milk by more than 0.2;
- dairy cows above cattle in any year;
- a food balance sheet's domestic production more than 0.6 from the farm table it repeats (wheat, maize, potatoes, vegetables, grapes, the five meats, milk and eggs, 2014–2025). The one known difference is grapes 2014, 165 in the balance sheet against 172.6 in the crop table, with no reason given; it is listed in `validation-report.json`;
- a dash or "…" in a served farming cell (in the farming tables a dash means no data, because the survey sample was small before 2016);
- a negative value, except electricity supply, which is negative in 2016 and 2023 when exports exceeded imports.

`verify_independent.mjs` re-reads every workbook with SheetJS (the web app's own `xlsx` dependency), finds all 1,389 cells again from labels with separately written tables, and compares stored value, dash status, cell, sheet, printed label, number format, display text and unit. It also reads the `.xls` efficiency workbook, which `prepare.py` cannot, and requires `energy.supply.total` to equal "Total primary energy supply" and `energy.final.total` to equal "Final energy consumption" (ktoe rows) for all 12 years within 0.05. Its negative controls must detect an altered value, an altered dash, an omitted row, a shifted year, a wrong cell, a wrong label, an efficiency mismatch, an altered farming value and an altered preliminary status.

`test_validation.py` covers all of the above, with small in-memory workbooks for self-closing empty cells and for sheet order resolved through relationships.

Run them with:

```
python3 -B prepare.py --check && python3 -B -m unittest test_validation -v && node verify_independent.mjs
```

`python3 prepare.py` rebuilds the generated files and `node verify_independent.mjs --write` rewrites `independent-validation.json`.

## Rules and notes

- **Dashes.** Geostat writes "-" where a flow did not occur (the 2013–2015 workbooks add a non-breaking space). Such a served cell is stored as `0` with `value_status = no_flow` and listed in `validation-report.json`. At present there are three: crude oil imports in 2013 and 2021, and crude oil supply in 2013. Nuclear and heat columns are dashes everywhere and are not served.
- **"…" (not published).** Several workbooks from 2013 to 2020 have "…" (sometimes followed by a non-breaking space) in their non-ferrous metals rows, an industry sub-row that is never served. No served series may contain one, and the build fails if it does. Nothing is estimated, interpolated or derived.
- **Wind starts in 2016.** The 2013–2015 electricity workbooks have no wind column or row, only geothermal and solar in TJ, so `electricity.production.wind` has no rows before 2016. The `KTOE` column "Geothermal/wind/solar" exists in every year and is served as `wind_solar_geothermal` for 2013–2024. Its heading reads "Geothermal, solar etc." in 2013, "Geothermal, solar etc" in 2014–2016 and "Geothermal, wind, solar etc" from 2017.
- **Losses.** The electricity loss row is labelled "Losses" except in 2016, 2017 and 2018, when Geostat prints "Distribution Losses". The check that supply − energy sector − losses = final consumption passes for those years, so it is the same flow. The printed label is kept in `source_label`.
- **Decimals.** Electricity values for 2016 carry two decimals in the workbook (for example `9329.19`), which `published_value` shows as `9329.2`. The exact token stays in `value`.
- **Sheet names.** The electricity sheet is `GWh&TJ` in 2013 and `GWH&TJ` from 2014. The name is looked up case-insensitively and recorded in `source_sheet`.
- **Food footnotes.** The Wheat and Maize sheets carry "* Products received from wheat converted into wheat." (and the same for maize), and the Grapes sheet "* Wine converted into grape.", attached to the sheet title (wheat, maize) or to the Import and Export row labels (grapes). The Egg sheet is in million pieces and the others in thousand tonnes; the ratio is a percent in all. Geostat's sheets say "Last update: 16.06.2025" and point to its metadata document, `https://www.geostat.ge/media/70747/0814_270525_EN.PDF`, which is not archived here.
- **Sheep and goat meat** reaches 345% in 2018 and is kept as published.
- **Farming survey change.** Geostat enlarged its farm survey in 2016 and reconciled 2006–2015 with it. Rows published only from 2016 (winter and spring wheat, white and red grapes, chicken and so on) are not served.
- **Preliminary.** Only the 2025 column of farm output carries a star ("2025*", "Preliminary data"); its four values are `preliminary`. The livestock workbooks print a preliminary footnote but star no year, so their values are `published`.
- **Not used.** Monthly electricity and fuel data, energy prices, the 2022 household energy survey, the other food and agriculture workbooks (sown area, yields, holdings surveys, fertilisers, quarterly livestock), the TJ sheets, the natural gas, coal, oil and biofuel workbooks of each balance, and the Georgian files' values.
