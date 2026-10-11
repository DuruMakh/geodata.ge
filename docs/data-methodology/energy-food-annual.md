# Annual energy balance and food self-sufficiency data collection and validation

## Purpose and status

This methodology governs the research package at `docs/Raw Data/EnergyFood/geostat-energy-food-annual/`, collected on 2026-10-11 from Geostat's "Energy Balance of Georgia" pages (2013–2024) and "Food Security" page. The research captures are immutable. The 681 primary values are served on the Energy and food pages under the approved design `docs/superpowers/specs/2026-10-11-energy-food-design.md`; see [Serving on the Energy and food pages](#serving-on-the-energy-and-food-pages). Nothing is published through MCP or included in central machine-readable publications.

Annual data only. Monthly electricity and fuel figures, energy prices, the 2025 energy balance (not yet published), crop and livestock production, farm prices, food consumption per person and regional breakdowns are excluded.

## Sources and coverage

Geostat is the sole publisher. Forty-two originals are preserved under `official/`: 24 energy balance workbooks (for each year 2013–2024, "1. Aggregated Energy Balance" and "2. Electricity and heat"), the energy efficiency workbook (2013–2024), the food balance sheets (2014–2025), the Georgian-language editions of the 2024 aggregated balance and of the food balance sheets (label references, no value is read from them), and 14 captures of Geostat source pages. Exact URLs, retrieval dates, byte sizes and SHA-256 fingerprints live in `source-manifest.csv` and `source-manifest.json`; the same originals are published through `data/methodology/source-archives/energy-food.csv`.

| Page group | Contents | Served values |
| --- | --- | --- |
| Energy supply | `KTOE` sheet: domestic supply (Total and eight fuels), production, imports (Total and five fuels), exports | 204 |
| Energy use | `KTOE` sheet: final consumption (Total and seven users), final consumption by fuel | 168 |
| Electricity | `Electricity (GWh)` column: production (Total, thermal, hydro, wind), imports, exports, final consumption (Total and six users), losses | 165 |
| Food self-sufficiency | `Self-sufficiency ratio, %` row of 12 foods, 2014–2025 | 144 |

The energy efficiency workbook is used only to cross-check total supply and final consumption. It is not served.

## Energy balance, units and definitions

An energy balance is Geostat's yearly account of where a country's energy comes from and where it goes. Energy figures are in thousand tonnes of oil equivalent (the balance's `KTOE` sheet); one tonne of oil equivalent is the energy in one tonne of crude oil, so different fuels can be added together. The terajoule sheet is not used. Electricity is in GWh, as Geostat's electricity workbook publishes it.

## Domestic supply, final consumption and non-energy use

Domestic supply is production plus imports, minus exports, minus international marine and aviation bunkers, plus or minus stock changes, as Geostat publishes it. Electricity's domestic supply is imports minus exports, so it can be negative (−6.9 in 2016 and −58.3 in 2023, thousand tonnes of oil equivalent). Final consumption is industry, transport, commercial and public services, households, agriculture/forestry/fishing, not elsewhere specified (other) and non-energy use. Non-energy use is fuel used as a raw material, for example natural gas for fertiliser.

## Electricity rows

Geostat's balance has no wind column before 2016, so `electricity.production.wind` has no row for 2013–2015: a gap, never zero. The electricity loss row is labelled "Losses" except in 2016–2018, when Geostat's English workbooks print "Distribution Losses"; the check supply − energy sector − losses = final consumption passes in those years, so the row is treated as the same flow and the printed label stays in the package's `source_label`. "Not elsewhere specified (Other)" final consumption is large (1,605.3 GWh in 2013, 2,552.7 in 2024); Geostat does not break it down and the pages offer no explanation of it.

## Food self-sufficiency ratio

The ratio is Geostat's published number for each of 12 foods and each year 2014–2025 (wheat, maize, potatoes, vegetables, grapes, meat, beef, pork, sheep and goat meat, poultry meat, milk and milk products, eggs). It is not recalculated. In plain terms it relates production to the quantity available, production divided by production plus imports minus exports, times 100; Geostat's published ratios can differ from that arithmetic because Geostat also accounts for changes in stocks (sheep and goat meat 299 against 291 in 2017). Geostat's footnotes: wheat and maize balances include products made from them converted into wheat and maize; the grape balance counts wine converted into grapes. Sheep and goat meat reaches 345% in 2018 and is kept as published. Food values show as whole percents.

## Dashes, gaps and unpublished cells

Geostat writes "-" where a flow did not occur. A served dash is stored as `0` with `value_status = no_flow` and listed in the validation report; there are three: crude oil imports in 2013 and 2021 and crude oil supply in 2013. Cells marked "…" (not published) occur only in an industry sub-row (non-ferrous metals) of several 2013–2020 workbooks that is never served; no served series may contain one and validation fails if it does. Nothing is estimated, interpolated or derived.

## Indicators

| Indicator IDs | Meaning | Coverage |
| --- | --- | --- |
| `energy.supply.{total, coal, crude_oil, oil_products, natural_gas, hydro, wind_solar_geothermal, biofuel_waste, electricity}` | Domestic supply by fuel, ktoe | 2013–2024 |
| `energy.production.total`, `energy.exports.total`, `energy.imports.{total, coal, crude_oil, oil_products, natural_gas, electricity}` | Production, exports and imports, ktoe | 2013–2024 |
| `energy.final.{total, industry, transport, commercial_public, households, agriculture, other_unspecified, non_energy}`, `energy.final_fuel.{coal, oil_products, natural_gas, wind_solar_geothermal, biofuel_waste, electricity}` | Final consumption by user and by fuel, ktoe | 2013–2024 |
| `electricity.production.{total, thermal, hydro}`, `electricity.imports`, `electricity.exports`, `electricity.losses`, `electricity.final.{total, industry, transport, commercial_public, households, agriculture, other_unspecified}` | Electricity, GWh | 2013–2024 |
| `electricity.production.wind` | Wind plants, GWh | 2016–2024 |
| `food.self_sufficiency.{wheat, maize, potato, vegetables, grapes, meat, beef, pork, sheep_goat_meat, poultry_meat, milk, eggs}` | Self-sufficiency ratio, % | 2014–2025 |

All rows use `basis=actual`. Each keeps its source ID, sheet, cell, printed row and column label and number format.

## Validation and evidence

`python3 -B prepare.py --check` in the package rebuilds every output in memory, compares the bytes with the saved files, and rejects a duplicate, missing or extra observation, a year outside coverage, a published value that is not the stored value as displayed, a cell that is neither a number nor a dash (in particular a "…" cell), and a changed row or column label. It also requires, for every year:

1. production + imports − exports − bunkers + stock changes to equal domestic supply within 0.2, for each fuel column;
2. the Total column to equal the sum of the fuel columns within 0.5 for supply, imports and final consumption;
3. final consumption to equal the sum of its users (and non-energy use) within 0.5, and electricity production to equal thermal + hydro + wind within 0.5 GWh;
4. electricity supply − energy sector − losses to equal final consumption within 0.5 GWh;
5. every food ratio to lie within 10 percentage points of production ÷ (production + imports − exports) × 100 on the same sheet;
6. no negative value except electricity supply in 2016 and 2023.

`node verify_independent.mjs` re-reads every workbook with SheetJS and separately written label tables, matches all 681 values, and requires total supply and final consumption to equal the energy efficiency workbook for all 12 years. Spot values: 2024 energy supply 5,914.5, 2024 imports 5,099.0, 2024 electricity production 14,234.1 GWh, 2025 wheat 19%.

## Serving on the Energy and food pages

`npm run data:prepare-energy-food` re-reads the package, requires both its report and the independent verification to have passed, and writes `data/imports/energy-food-annual.csv` (UTF-8 with BOM) and `data/reports/energy-food-validation.json`. `npm run data:check-energy-food` (part of `data:validate`) rebuilds both in memory and fails on any difference. The Prisma mirror table `EnergyFoodFact` is filled only by the transactional, parity-checked `npm run data:import`; CSV and database modes serve identical rows.

The pages show energy and electricity to one decimal and food ratios as whole percents, as Geostat publishes them. The wind gap before 2016 is a gap, never zero. The pages describe the figures and state no causes. The energy-food sources are registered sources of a human explorer only and are excluded from the fact-query snapshot.

Excel downloads hold Summary, Data and Sources sheets in the reader's language, with the selected series and years, explicit units and validated links to the archived copies of the Geostat workbooks on fiscal.ge. Internal cell references are not exported.

Original sources: [Energy Balance of Georgia (Geostat)](https://www.geostat.ge/en/modules/categories/328/energy-balance-of-georgia) and [Food Security (Geostat)](https://www.geostat.ge/en/modules/categories/297/food-security).
