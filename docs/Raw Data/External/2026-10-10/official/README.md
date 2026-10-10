# External flows: official source capture (2026-10-10)

Unedited downloads from Geostat and the National Bank of Georgia (NBG) for the remittances, FDI and current-account research. I downloaded them on the owner's machine because the cloud session could not reach either site.

- `full-source-manifest.json` records, for each file: original and resolved URL, publisher, UTC retrieval time, local path, SHA-256, byte size, content type and notes.
- `workbook-coverage.json` lists each workbook's sheet names, row counts and detected first/last years. The detection is automatic, so check it against the table below.

## Coverage (checked by hand)

| File | Sheets | Coverage |
|---|---|---|
| geostat/FDI_Eng-countries.xlsx | FDI, FDI (annual) | 1996 – 2026 Q2 (annual to 2025) |
| geostat/FDI_Eng-sectors-NACE-2.xlsx | ENG, ENG (annual) | 2016 Q1 – 2026 Q2 |
| geostat/FDI_Eng-sources.xlsx | sources, sources (annual) | 2007 Q1 – 2026 Q2 (annual to 2025) |
| geostat/FDI_Eng_regions.xlsx | ENG, ENG (annual) | 2009 Q1 – 2026 Q2 |
| geostat/FDI_Eng-components.xlsx | Components, Components (annual) | 2013 Q1 – 2026 Q2 |
| geostat/FDI_Eng-sizes.xlsx | FDI, FDI (annual), definition of size classes | 2016 Q1 – 2026 Q2 |
| geostat/FDI_Eng-ages.xlsx | FDI, FDI(annual) | 2016 Q1 – 2026 Q2 |
| geostat/FDI_Eng_by_Quarters.xlsx | FDI | 1996 – 2026 Q2 (rows = years, Q columns; 2026 preliminary) |
| geostat/FDI_Eng_stocks-countries.xlsx | countries-ENG | end-2015 – 30.06.2026 |
| geostat/FDI_Eng_stocks-sectors.xlsx | FDI Sectors | 2000 – 30.06.2026 |
| geostat/FDI_Eng_bpm6.xlsx | Sheet1 | 2000 Q1 – 2026 Q2 |
| nbg/BOP-6_bopbpm6eng.xlsx | BOP–BPM6, BOP–BPM6(short), BOP-anlt, contact | 2000Q1 – 2026Q2 |
| nbg/IIP-6_iip-bpm6-eng.xlsx | IIP-1 (BPM6), IIP-2 (BPM6), contact | end-1999 – 2026-06 |
| nbg/REMC_money-transfers-by-countries-eng.xlsx | MTR Note, 2012-2026 (eng) , 2010-2011 (eng), 2008-2009(eng), 2000-2007(eng) | monthly 2000-01 – 2026-08, by country |
| nbg/REMM_money-transfers-by-months-eng.xlsx | MTR Note, 1999-2026 E | monthly 1999-07 – 2026-08, **2024 column absent** |
| nbg/REMS_money-transfers-by-systems-eng.xlsx | MTR Note, three system sheets | monthly 2008-01 – 2026-08 |

## Caveats

- **REMM has no 2024 column.** Its year headers run …2022, 2023, 2025, 2026. The 2023, 2025 and 2026 columns match REMC month for month. REMC has all of 2024: 3,361,549 thousand USD of inflows.
- **NBG has no REMCY table.** None of NBG's 13 statistics-data categories (Archive included) lists money transfers by currency. The only money-transfer tables are REMC, REMM and REMS, and the guessed file names return 404.
- **No NBG release calendar body.** The NBG "Advance Release Calendar" page renders client-side and its server HTML contains no calendar. In practice, the per-table `updateDate` and `nextUpdateDate` fields in `nbg/nbg-statistics-api-category-24-external-sector.json` serve as the calendar. For example, BOP-6 was updated 30/09/2026 and is next due 30/12/2026; REMC/REMM were updated 15/09/2026 and are next due 15/10/2026.
- **The Geostat methodology page lists international manuals.** I downloaded only the FDI-relevant ones (BPM6, OECD Benchmark Definition of FDI, CDIS Guide) and skipped the trade-statistics manuals. The FDI metadata itself is `FDI_metadata_1002_090626_EN.pdf`.
