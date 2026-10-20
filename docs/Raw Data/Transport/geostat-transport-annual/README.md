# Transport statistics (National Statistics Office of Georgia)

Research package for the Fiscal.ge "Transport" hub. Approved design: `docs/superpowers/specs/2026-10-20-transport-design.md`. Everything here is reproducible from the files in `official/`, which are never edited. Requires Python 3 with `xlrd` 2.0.x (reads the one `.xls` file); the `.xlsx` files use the worksheet reader shared with the unemployment package, and `node verify_independent.mjs` needs the `xlsx` (SheetJS) package of `apps/web`.

## Sources

All files were downloaded fresh on 2026-10-20 (UTC, 05:40–05:41) with `curl -sSL`, from the file links of five Geostat category pages, which are kept as HTML captures (05:41). `retrieval-log.txt` records the HTTP status, URL and start time of every download. Each fresh download is byte-identical to the copy held in the project's `transport-sources/raw` folder. Exact URLs, retrieval times, SHA-256 hashes and byte sizes are in `source-manifest.csv` and `source-manifest.json`.

- Environmental indicators, `https://www.geostat.ge/en/modules/categories/565/environmental-indicators`: tables H-1 to H-4.
- Railway transport statistics, `…/categories/795/railway-transport-statistics`: `0504EN030101`–`030106`.
- Air transport statistics, `…/categories/796/air-transport-statistics`: `0504EN030201`–`030203`.
- Road transport statistics, `…/categories/797/road-transport-statistics`: road length, registered vehicles, technical inspections, Tbilisi taxi licences.
- Maritime transport statistics, `…/categories/802/maritime-transport-statistics`: `0504EN030401`–`030403`.

| Source ID | Local file | Use |
| --- | --- | --- |
| `geostat_transport_passenger_demand` | `official/H-1-Passenger-transport-demand_ENG.XLSX` | Served: passenger-km by mode and per person, 2000–2025 |
| `geostat_transport_freight_demand` | `official/H-2-Freight-transport-demand_ENG.XLSX` | Served: tonne-km by mode, 2000–2025 |
| `geostat_transport_fleet_fuel` | `official/H-3.-Composition-of-road-motor-vehicle-fleet-by-fuel-type_ENG.xlsx` | Served: vehicle fleet by type (2000–2025) and fuel (2017–2025) |
| `geostat_transport_fleet_age` | `official/H-4.-Age-of-road-motor-vehicle-fleet_ENG.xlsx` | Served: vehicle fleet by age, 2017–2025 |
| `geostat_transport_rail_goods` | `official/0504EN030102_Goods-Transported-by-Railway.xlsx` | Served: tonnes carried by railway, total, domestic, exports, imports, transit, 2018–2025 |
| `geostat_transport_rail_passengers` | `official/0504EN030103_Passengers-Transported-by-Railway.xlsx` | Served: railway passengers, total, domestic, international, 2018–2025 |
| `geostat_transport_metro` | `official/0504EN030105_Passengers-transported-by-Metro.xlsx` | Served: metro passengers (sheet `2012-2025 Y`), 2012–2025 |
| `geostat_transport_airlines` | `official/0504EN030201_Airlines-Registered-in-Georgia.xlsx` | Served: passengers and freight of Georgian airlines, 2012–2025 |
| `geostat_transport_airports` | `official/0504EN030202_Airports-in-Georgia.xlsx` | Served: passengers and freight and mail at Georgia's airports, 2015–2025 |
| `geostat_transport_sea_passengers` | `official/0504EN030401_Passenger-carried-in-seaports-and-terminals.xlsx` | Served: sea port passengers, 2020–2025 |
| `geostat_transport_sea_freight` | `official/0504EN030403_Volume-of-carried-freight-in-seaports-and-terminals.xlsx` | Served: sea port freight, total and liquid, general and dry bulk, 2020–2025 |
| `geostat_transport_registered` | `official/Number-of-Registered-Vehicles.xlsx` | Served: registered vehicles by region and type, fuel, owner and age, 2017–2025 |
| `geostat_transport_roads` | `official/Length-of-road-Eng-2024.xls` | Served: road length by region and road type, 2011–2024 |
| `geostat_transport_rail_turnover`, `_rail_infrastructure`, `_rail_regions` | `official/0504EN030101…`, `…030104…`, `…030106…` | Archived only |
| `geostat_transport_air_infrastructure`, `_sea_ships` | `official/0504EN030203…`, `…030402…` | Archived only |
| `geostat_transport_taxi_licences`, `_technical_inspections` | `official/Taxi_Licenses_Tbilisi-EN.XLSX`, `official/Technical-Inspections_2021-2025.xlsx` | Archived only |
| `geostat_transport_environment_page`, `_rail_page`, `_air_page`, `_road_page`, `_sea_page` | `official/geostat-category-{565,795,796,797,802}-2026-10-20.html` | The page captures the file links come from |

## Outputs

- `transport-annual.csv`: the 4,301 served observations, one row per indicator and year, with columns `year,indicator_id,value,published_value,unit,basis,value_status,source_id,source_sheet,source_cell`. `value` is the stored cell's shortest round-trip number text with a trailing `.0` removed, so xlrd and SheetJS agree; a nil cell (`-`, or `_`) has value `0`. `published_value` is the value at Geostat's published precision: the stored double to 15 significant digits, then rounded half-up to one decimal (whole numbers for km per person). `basis` is always `actual` and `value_status` always `official`: nothing is calculated or imputed.
- `coverage.csv`: first and last year, count and any unavailable years inside that range for each of the 452 indicators.
- `validation-report.json` (from `prepare.py`) and `independent-validation.json` (from `verify_independent.mjs`).
- `source-manifest.csv` and `source-manifest.json`.

| Measure | Unit | Groups | Years | Rows |
| --- | --- | --- | --- | --- |
| `transport.fleet.*` | `thousand_units` | `cars`, `buses`, `trucks`, `special`; `{type}_fuel_{fuel}`; `{type}_age_{up_to_2,up_to_5,up_to_10,over_10,unknown}` | types 2000–2025 (2004–2005 gaps; special also 2006); fuel and age 2017–2025 | 486 |
| `transport.passenger_km.*` | `million_passenger_km` | `total`, `road`, `rail`, `metro`, `air`, `sea` | 2000–2025 | 156 |
| `transport.passenger_km_per_person.total` | `passenger_km_per_person` | | 2000–2025 | 26 |
| `transport.passengers.*` | `thousand_passengers` | `rail`, `rail_domestic`, `rail_international`, `metro`, `airports`, `airlines`, `seaports` | see Sources | 69 |
| `transport.tonne_km.*` | `million_tonne_km` | `total`, `road`, `rail`, `air`, `sea` | 2000–2025 (sea: 2000–2008, 2011, 2012) | 115 |
| `transport.freight_tonnes.*` | `thousand_tonnes` | `rail` and `rail_{domestic,exports,imports,transit}`; `seaports` and `seaports_{liquid,general,dry}`; `airports`; `airlines` | see Sources | 89 |
| `transport.registered.*` | `thousand_units` | `{area}`; `{area}_{cars,buses,trucks,special,type_unknown}`; `{area}_fuel_{gas,petrol,petrol_gas,diesel,diesel_gas,electric,hybrid,hybrid_gas,hybrid_diesel,unknown}`; `{area}_age_{0_2,2_5,5_10,over_10,unknown}`; `{area}_owner_{companies,individuals}` | 2017–2025 where the year has the column | 2,632 |
| `transport.road_km.*` | `km` | `{area}`; `{area}_{international,secondary,local}` | 2011–2024 | 728 |

`{area}` is `total` (Georgia), the site's 11 region IDs (`region_tbilisi`, `region_adjara`, `region_guria`, `region_imereti`, `region_kakheti`, `region_mtskheta_mtianeti`, `region_racha_lechkhumi_kvemo_svaneti`, `region_samegrelo_zemo_svaneti`, `region_samtskhe_javakheti`, `region_kvemo_kartli`, `region_shida_kartli`), `region_abkhazia` and, for registered vehicles, `region_unknown`. Fuel IDs: `petrol` (Gasoline), `petrol_gas` (Gasoline-gas), `diesel`, `diesel_gas`, `gas`, `electric` (Electricity), `hybrid`, `hybrid_gas`, `hybrid_diesel`, `unknown`.

Fleet fuels served: cars `petrol`, `petrol_gas`, `diesel`, `gas`, `electric`, `hybrid`, `hybrid_gas` (2022–2025), `unknown`; buses and trucks `petrol`, `petrol_gas`, `diesel`, `gas`, `electric`, `unknown`; special vehicles `petrol`, `petrol_gas`, `diesel`, `electric`, `unknown`. Fleet ages: every band for each type except buses' `unknown`.

### Gaps and rows not served

- `…` / `...` (data not available or confidential) is a gap, never zero: H-3 and H-4 print the 2004–2005 totals (and special vehicles' 2006 total) and every fuel and age row before 2017 that way.
- `-` follows each table's own legend. H-1, H-4, the railway, airport and sea port tables say "magnitude nil", so `-` is served as 0 (sea passenger-km 2000–2009 and 2020–2025). H-2 says "data not available", so its `-` and `...` cells are gaps (sea tonne-km 2009, 2010 and from 2013). H-3 has no legend entry for `-`, but prints it only in rows that are not served. The airport tables' legend writes nil as `_`, and the road table prints one `_` cell (Tbilisi secondary roads 2015, whose total equals its international roads), served as 0. Only 17 served values come from nil cells: 16 sea passenger-km and that road cell.
- Not served because they are nil or 0 in every year (checked on every run): inland waterways passenger-km and tonne-km; H-3 diesel-gas and hybrid-diesel of every type, hybrid and hybrid-gas of buses, trucks and special vehicles, gas of special vehicles; H-4 buses of unknown age. Percentage rows, population, GDP and tonne-km per GDP are not served.
- Registered vehicles: the type `Unknown` column exists from 2022, `Diesel-gas` in 2020 and from 2022, `Hybrid-gas` and `Hybrid-diesel` from 2022; other years have no column and no value.

## Cell map

`prepare.py` finds every column by its printed year heading and every row by its printed label, never by fixed position.

**H-1 to H-4** (one sheet each, `H-1` … `H-4`): the heading row is the one with `Unit` in column B, holding the years 2000–2025. A section heading is a row with only column A (`Road transport*`, `Railway transport`, `Inland waterways transport`, `Maritime transport`, `Aviation`, `Underground transport (metro)` in H-1 and H-2; `Passenger cars`, `Buses and minibuses`, `Special*`, `Trucks` in H-3 and H-4); `of which:` is not a section. A label printed under several sections (`Passenger transport demand`, `Total number`, `Gasoline`, `<= 2 years`, …) is read from the first such row under its section; a label printed once (`Total passenger transport demand`, `Total Passenger transport demand per capita`, `Total freight transport demand`) is matched alone. Column B must read `million pkm`, `million tkm`, `km` or `1000 units`. H-4's totals are compared with H-3's cell for cell and only H-3's are served.

**Railway** (`0504EN030102` sheet `Transportation`; `0504EN030103` sheet `Number of passengers`): years in row 2, `Years` / `Year` (or nothing, for 2018 in the goods sheet) in row 3. Goods: the `Goods, total` row of the sections `Transported, total`, `National transported`, `Outgoing goods` (exports), `Incoming goods` (imports) and `Transit`. Passengers: the first `Number of passengers, total`, `National` and `International` rows (the passenger-km block below repeats the labels). The 2026 columns sit over quarters and are not served.

**Metro** (`0504EN030105` sheet `2012-2025 Y`): a year in column A and passengers in the column headed `Number of passengers, thsd. Persons`. The cells are formatted without decimals, but they store Geostat's sum of quarters with one decimal (2025: `147641.427`), and the value is published to one decimal like every other thousand-passenger figure (`147641.4`).

**Airlines and sea ports** (`0504EN030201` sheets `Number of passengers by quarter` and `Volume of freight by quarter`; `0504EN030401` sheet `Passenger`; `0504EN030403` sheet `Freight`): a year in column A starts each block of quarter rows; the block's yearly row is the one whose quarter cell (column B) is `…` or `...`. Columns by heading: `Number of passengers, thsd. Passengers`, `Freight volume, thsd. Tons`, `Passenger Carried, total`, `Freight carried, total (thsd. tons)`, `Liquid bulk`, `General cargo`, `Dry bulk`. 2026 has no yearly row.

**Airports** (`0504EN030202` sheets `Passengers carried`, `Freight carried`): a year in row 2 over each five-column block, `Year` in row 3 over the yearly column; rows `Passengers carried (thsd. persons)` and `Freight and mail volume (thsd. tons)`.

**Registered vehicles** (`Number-of-Registered-Vehicles.xlsx`, four sheets): one row per area, labelled in column A (`Georgia`, `Tbilisi`, `Abkhazia`, `Adjara`, `Guria`, `Imereti`, `Kakheti`, `Mtskheta-mtianeti`, `Racha-Lechkhumi and Kvemo Svaneti`, `Samegrelo-Zemo Svaneti`, `Samtskhe-Javakheti`, `Kvemo Kartli`, `Shida Kartli`, `Region unknown`; matched after trimming spaces). Row 3 holds a year over the first column of each year's block, and a block starts where row 3 reads the next year in sequence from 2017:

- `type of vehicle`: `Motor vehicles – total` in row 4 over the block's first column; row 5 `Lorries and trucks`, `Buses and minibuses`, `Special*`, `Passenger cars` and, from 2022, `Unknown`.
- `fuel type`: row 4 fuel names; the columns present change from year to year.
- ` type of owner `: two columns per year, `Legal person` (companies) and `Physical person` (individuals). Row 3 prints `2021` over the 2022–2025 second columns; those wrong headings are ignored because a block starts only at the next year in sequence and is two columns wide.
- `age of vehicle`: five columns per year, `<=2`, `(2-5]`, `(5-10]`, `>10`, `Unknown` (printed `უცნობია` in 2024 and 2025). Row 3 prints `2021` and `2019.2`, `2018.6`, … over later columns; ignored the same way. These bands do not overlap, unlike H-4's.

**Road length** (`Length-of-road-Eng-2024.xls` sheet `Roads`): a year in row 3 over each four-column block, `Total` in row 4 over its first column, `International road`, `Secondary road`, `local road` in row 5. Rows `Georgia - total`, `Tbilisi*`, `Adjara AR`, `Abkhazia AR` and the other regions.

## Checks

`python3 prepare.py` rebuilds every generated file and fails unless all of these hold; `python3 prepare.py --check` fails if a committed file differs from a rebuild. `python3 -m unittest test_validation -v` runs the regression tests, including negative controls. `node verify_independent.mjs` re-reads every cell with SheetJS against label tables written separately and runs 12 negative controls.

- Every served (indicator, year) is present exactly once, and nothing else (4,301 rows, against year ranges written out separately); no year is after 2025.
- Every value equals its source cell, re-read, and every published value is that value rounded to the unit's precision.
- The rows not served are still nil or 0 in every year; H-3 and H-4 print the same type totals.
- Totals equal their parts (1,103 comparisons): fuels and H-4's cumulative `up to 10 + over 10 + unknown` within 0.1 thousand of each type's total; modes within 0.2 of total passenger-km and tonne-km; railway directions and sea port cargo types within 0.1; in the regional workbook, the 11 regions plus Abkhazia and region unknown to Georgia, and each area's types, fuels, owners and age bands to its total, within 0.2; road types to each area's length and regions plus Abkhazia to Georgia within 0.2. Two differences beyond tolerance are Geostat's rounding and are recorded exactly (`KNOWN_DIFFERENCES`): buses' fuels add up to 0.2 thousand more than the total in 2020, special vehicles' to 0.2 less in 2025.
- Anchors, as published: passenger cars 2025 1,650.0 and 2000 244.8; electric cars 2025 15.2; cars over 10 years old 2025 1,318.9; passenger-km 2025 11,262.1 (air 1,862.6); railway tonne-km 2025 3,814.9; railway transit 2025 7,616.6 thousand tonnes; registered vehicles 2025 Georgia 1,914.9, Tbilisi 855.0, Guria 40.7; metro passengers 2025 147,641.4 thousand.

## Geostat's notes

- Road transport passenger-km and tonne-km from 2005 are "according to statistical surveys and experts' estimation" (H-1, H-2).
- Special vehicles include agricultural machinery from 2008 (H-3, H-4, registered vehicles).
- H-4's age rows are cumulative: up to 2 years is part of up to 5 years, which is part of up to 10 years.
- Tbilisi's road length covers only the roads the Roads Department of Georgia manages (since 2012). From 2021 local roads include roads within settlements, and exclude self-governing cities; the 2024 data uses the road list of Decree No. 407 and updated municipal boundaries.
- Airport figures count passengers and freight at Georgia's airports; airline figures count what airlines registered in Georgia carry, wherever they fly. The two overlap and are not added.
- Several tables note that totals and sums can differ because of rounding.
