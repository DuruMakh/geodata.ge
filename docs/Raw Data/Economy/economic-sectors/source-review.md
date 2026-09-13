# National economic sector source review

Reviewed 2026-09-11. Source inspection is complete for the available observations. The user approved nominal/share2010–2025 and real growth2011–2025. No sector page is live or implemented by this review.

## Originals and mapping

The [official GDP page](https://www.geostat.ge/index.php/en/modules/categories/23/gross-domestic-product-gdp) links to the three originals recorded in `source-manifest.json`. The existing nominal original is reused without modification. The two newly downloaded originals retain their upstream filenames and bytes. All three show a last update of 19 June 2026 and mark 2025 preliminary, with revision scheduled for 16 November 2026.

All sheets identify NACE Rev. 2 in A2. Activity codes A–T occupy A3:A22, with full English names in B3:B22. The national reference is the independently published market-price GDP row 26. Rows 23, 24 and 25 are basic-price total, product taxes and product subsidies; none is an additional selectable sector.

The Georgian activity names in the registry were checked during implementation against the [Georgian current-price workbook](https://www.geostat.ge/media/81051/03_mshp-mimdinare-fasebshi.xlsx), sheet `მშპ მიმდინარე ფასებში`, A3:B22 (GDP label B26). Its observed SHA-256 was `a5b7e2ddb35679f4cc35218f8e3dff0958d11428e2da78f78afe56693085a521`. All20 codes/names matched after trimming surrounding whitespace. That workbook was read in memory, not archived locally. This is label-verification evidence, not another numerical source for the serving dataset.

| Original | Sheet | Annual headers | Source units |
| --- | --- | --- | --- |
| Existing nominal | `GDP at current prices` | G2 (2010), every fifth column through CD2 (2025*) | million GEL, current prices |
| `06_Real-GDP-Growth.xlsx` | `Real GDP Growth` | G2 (2011), every fifth column through BY2 (2025*) | index, corresponding previous year = 100 |
| `04_GDP-at-constant-prices.xlsx` | `GDP_constant_prices` | G2 (2010), every fifth column through CD2 (2025*) | million GEL, chain-linked constant 2019 prices |

Headers interleave quarters with annual observations. Quarter headers and 2026 Q1 are excluded. Match annual headers explicitly and validate both activity codes and full row labels before extraction.

The [Geostat methodology](https://www.geostat.ge/media/80065/geostat_gdp_methodology_en.html) identifies SNA 2008, NACE Rev. 2 / GNC 006-2016 and the revision of 2010–2017 to the revised methodology. It explains the product-tax adjustment and double deflation. Chain-linked component amounts must not be summed as a real-GDP reconciliation rule.

## Measured coverage matrix

Each range below was checked for finite values in every annual cell, not inferred from the first/last column. Shares use the nominal source and its same-year GDP denominator.

| Series | Nominal and GDP share | Published real growth | Missing growth |
| --- | --- | --- | --- |
| sector.a | 2010–2025 | 2011–2025 | 2010 |
| sector.b | 2010–2025 | 2011–2025 | 2010 |
| sector.c | 2010–2025 | 2011–2025 | 2010 |
| sector.d | 2010–2025 | 2011–2025 | 2010 |
| sector.e | 2010–2025 | 2011–2025 | 2010 |
| sector.f | 2010–2025 | 2011–2025 | 2010 |
| sector.g | 2010–2025 | 2011–2025 | 2010 |
| sector.h | 2010–2025 | 2011–2025 | 2010 |
| sector.i | 2010–2025 | 2011–2025 | 2010 |
| sector.j | 2010–2025 | 2011–2025 | 2010 |
| sector.k | 2010–2025 | 2011–2025 | 2010 |
| sector.l | 2010–2025 | 2011–2025 | 2010 |
| sector.m | 2010–2025 | 2011–2025 | 2010 |
| sector.n | 2010–2025 | 2011–2025 | 2010 |
| sector.o | 2010–2025 | 2011–2025 | 2010 |
| sector.p | 2010–2025 | 2011–2025 | 2010 |
| sector.q | 2010–2025 | 2011–2025 | 2010 |
| sector.r | 2010–2025 | 2011–2025 | 2010 |
| sector.s | 2010–2025 | 2011–2025 | 2010 |
| sector.t | 2010–2025 | 2011–2025 | 2010 |
| economy.gdp_total | 2010–2025 | 2011–2025 | 2010 |

Available counts: 336 nominal, 336 derivable GDP shares, 315 growth observations, or 987 total. There are 21 unavailable growth cells for 2010. The current growth sheet has no 2010 annual column and the volume sheet has no 2009 annual column. Neither supports a compatible 2010 growth calculation. An official-site search did not find an alternative compatible series; legacy SNA 1993 classifications and aggregate-only World Bank growth are not valid replacements for missing sector rates.

## Calculation and precision contract

- Nominal: convert each source number's decimal representation from million GEL to full GEL with decimal arithmetic. Retain source precision.
- GDP share: `100 × sector GVA / same-year market-price GDP`; source locator retains both cells. The GDP reference is 100% only when that denominator is valid. Do not divide by summed GVA or selected sectors.
- Growth: subtract exactly 100 from the published index using decimal arithmetic. Record `calculation = index_to_growth`. For example an index of 107.46161492416432 means 7.46161492416432%, not 107.46% or 0.0746%. It is not a nominal change or a summed/averaged sector rate.
- Validate growth independently against `100 × (current volume / previous volume − 1)` from the constant-price original. Its 2010 level supports 2011 growth, not 2010 growth. The published index remains the served source.
- Derived ratios use a dedicated 50-significant-digit decimal context and are rounded once to 20 decimal places. Database/import parity is exact; it has no tolerance.
- Canonical preparation will use a fixed nominal reconciliation tolerance of 0.00000001 million GEL (0.01 GEL), allowing the accumulated finite spreadsheet precision of 20 source numbers, and a growth-check tolerance of 0.0000000001 percentage points. These thresholds are fixed before implementing the automated validation and must not be widened to hide errors. The preliminary exploratory check below used binary arithmetic, not canonical decimal validation.

## Exploratory checks

Every nominal year (2010–2025) was checked against both source identities: sum A–T equals basic-price total; basic total plus taxes minus subsidies equals market GDP. The maximum absolute difference in the exploratory binary-number check was 1.46 × 10^-11 million GEL. All 315 published growth indices were compared with adjacent-year chain-linked levels; the maximum absolute difference was 1.11 × 10^-13 percentage points. Deterministic preparation tests and exact-decimal reports remain implementation work.

Representative source values:

- Nominal agriculture: G3 = 1963.727396774285 million GEL (2010), CD3 = 5419.971597482003 million GEL (2025*).
- Small household sector: CD22 = 86.35408557338411 million GEL (2025*), retained as a real nonzero observation.
- GDP reference: CD26 = 104598.139883332 million GEL (2025*).
- Accommodation/food services contracted approximately 46.6073% in 2020. The chart must support negative growth.

The GDP overview's national growth uses World Bank and is not silently replaced. Its 2025 canonical rate is 7.46161504152039%, versus Geostat's published index converted to 7.46161492416432%. The 2020 overview rate is -6.2904717853839%, versus approximately -6.29125397230588% in this Geostat release. These are source differences, not reasons to substitute the overview rate into this sector dataset.

## Attribution and redistribution

Geostat's [Terms of Use](https://www.geostat.ge/index.php/en/page/monacemta-gamoyenebis-pirobebi), retrieved directly on 2026-09-11, permit downloading, adaptation and redistribution of its statistical data, metadata and publications, with Geostat credited. Third-party copyrighted material is excluded; logo/trademark use is limited, with unchanged publications expressly addressed. Archive these statistical originals unchanged, credit Geostat, and do not generalize this permission to unrelated third-party assets.

## Approved product decision

The user approved retaining nominal/share 2010–2025 and using the observed 2011–2025 range for growth, with clear coverage text. Switching measure preserves selection and intersects a manual range with the destination coverage. No missing growth is invented.
