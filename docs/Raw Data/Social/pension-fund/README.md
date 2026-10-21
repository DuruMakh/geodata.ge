# Pension Fund of Georgia: what is published and what is served

Collected on **21 October 2026** from <https://pensions.ge>. The Fund (საქართველოს საპენსიო ფონდი, formerly სსიპ საპენსიო სააგენტო) publishes its documents through `https://site-api.pensions.ge/api/v1/embedded-doc/get?slug=<slug>`, which returns the file's path under `https://site-api.pensions.ge/`. The thirteen files in `official/` are saved byte for byte under the names pensions.ge serves them with. Nothing here is edited by hand.

The package feeds the funded pension page. It reads the originals once, offline. CI does not run `extract.py`; it checks the committed outputs against `source-manifest.json`.

## Files

| File | What it is |
| --- | --- |
| `official/` | The original PDFs: six served, seven kept only for cross-checks. |
| `source-manifest.json` | One entry per PDF: `source_id`, `document`, `url`, `local_file`, `bytes`, `sha256`, `retrieved_on`, `used_for` (`served` or `check`). |
| `extract.py` | Reads the PDFs with poppler's `pdftotext` (layout text, plus word positions for the two charts), runs the checks and writes the two outputs below. Standard library only. |
| `test_extract.py` | Regression tests: the fixture of all 99 values, the recorded differences, the failure cases and the committed outputs. |
| `pension-fund-annual.csv` | The 99 served values, UTF-8 with BOM: `measure,year,value,unit,months,source_id,document,page,line`. Money is whole GEL (the printed thousands × 1,000, negative for a loss), counts are whole numbers, the return is as printed to one decimal. `page` is the PDF page and `line` the printed line label (the chart title for the 2025 report). |
| `validation-report.json` | `passed`, `failures`, `rows` and the recorded `restatements` and `revisions`. |

## What is served from where

Every statement prints its year and the year before. A year is served from the **latest statement that prints it as text**:

| Year | Statement |
| --- | --- |
| 2019, 2020 | `2020-IFRS.pdf` (2019 is its comparative column) |
| 2021 | `2022-IFRS-GE.pdf` (comparative column; the 2021 statement is a scanned image and is not kept) |
| 2022 | `2023-IFRS-GE.pdf` (comparative column) |
| 2023 | `2024-IFRS-GE.pdf` (comparative column) |
| 2024, 2025 | `2025-IFRS.pdf` (in English) |

The statements are the pension scheme's statements of changes in net assets, in thousand GEL. Their line labels differ by document: 2019–2020 say "სუბსიდია" for the State's part, 2022–2024 say "სახელმწიფოს საპენსიო შენატანი", and 2025 says "Subsidy from the State of Georgia". The 2019 statement says "საქართველოს მთავრობის სუბსიდია".

- **Savings** are the members' liabilities note's "ნაშთი 31 დეკემბერს" / "Balance at 31 December" line. Several notes carry such a line; the right one is the one whose 1 January balance is the earlier year's closing balance (and whose opening balance for the year before is the figure already read, or a dash in the first year).
- **Net assets** are the closing net assets of the statement of changes in net assets.
- **Securities** are one measure: a gain is printed among the increases, and in 2022 a loss (−31,187 thousand) among the decreases, and is stored negative. **Dividends and securities** print a dash for 2021 and no line before it; a dash or an absent line gives no row, never a zero. Payouts are the total line of payments and opt-outs, stored positive.
- **Members, people who left, people paid, employers and the return** come from `Annual_Rep_2025_geo.pdf` (the Fund's 2025 annual report). Members (page 16), employers (page 15) and the people paid (the total row of the table on page 20) are read from text; the people who left (page 19) and the annual return (page 7) are chart labels, read with `pdftotext -bbox` by assigning each label to the nearest year label by horizontal position. The return chart shows a pair of bars per year, and the **left bar is the return** (the right bar is inflation: 7.0, 2.4, 13.9 and so on, the known inflation rates). The "since the Fund's start" pair at the right of the chart is not a year and is ignored.

The 2025 annual report's text (page 4) gives the 2025 return as 11.8%, the same as the chart.

## Checks

`extract.py` exits non-zero, and writes nothing, if any of these fails:

- the three contribution parts add up to the printed total, in every statement column;
- in every statement column, the increases less the decreases equal the printed net change, and the figures behind each total add up to it;
- each year's opening net assets plus the net change equal its closing net assets, and a year's closing net assets are the next year's opening net assets in every statement that prints both;
- the members' balance rolls forward in the note (opening plus every line down to closing);
- the served value equals the same year's value in that year's own statement, except recorded restatements (own statements as text exist for 2019, 2020, 2022, 2023, 2024 and 2025; 2020 and 2025 are the served ones);
- the 2025 report's counts equal the earlier reports', except recorded revisions;
- the 2025 return equals the report text, 11.8%; the rows of the people-paid table add up to its total row;
- the ten anchor values of the design (savings, net assets, contributions, State contribution, 2022 securities loss, members, employers and the 2025 return), the 99 rows, and `source-manifest.json` against the files.

## Recorded restatements: none

Each served money value (all ten measures) was compared with the statement of its own year where one exists as text: 2019 (`2019-IFRS.pdf`), 2022, 2023 and 2024. They are identical, so the list is empty. The 2019 statement also prints an English version after the Georgian one; only the Georgian was read.

## Recorded revisions of counts and returns

The Fund revises older figures slightly. Each earlier annual report's figures **for its own year** were compared with the 2025 report's, so the revisions below are what was printed when the year closed against what the 2025 report prints now. Where the earlier report agrees with the 2025 report (every 2023 and 2024 count, the 2022 employers, the 2021 return) nothing is recorded.

| Year | Measure | Earlier report | Earlier | Served | Printed as |
| --- | --- | --- | ---: | ---: | --- |
| 2019 | members | 2019 report, p. 9 | 960,394 | 958,226 | year-end statistics block |
| 2019 | left | 2019 report, p. 9 | 164,096 | 164,198 | year-end statistics block |
| 2020 | members | 2020 report, p. 1 | 1,106,683 | 1,105,041 | report text |
| 2020 | left | 2020 report, p. 3 | 3,377 | 3,098 | report text |
| 2020 | paid_persons | 2020 report, p. 13 | 430 | 466 | year-end statistics block |
| 2021 | members | 2021 report, p. 17 | 1,235,938 | 1,234,732 | year-end statistics block |
| 2021 | left | 2021 report, p. 5 | 1,880 | 1,605 | report text |
| 2021 | paid_persons | 2021 report, p. 18 | 741 | 839 | year-end statistics block |
| 2021 | employers | 2021 report, p. 2 | 82,795 | 82,801 | report text |
| 2022 | members | 2022 report, p. 20 | 1,359,887 | 1,359,035 | year-end statistics block |
| 2022 | left | 2022 report, p. 10 | 1,564 | 1,218 | report text |
| 2022 | paid_persons | 2022 report, p. 20 | 1,615 | 1,853 | year-end statistics block |
| 2023 | return | 2023 report, p. 9 | 11.9% | 12.3% | return chart |
| 2024 | return | 2024 report, p. 6 | 11.6% | 11.5% | report text |

**The 2024 return.** The 2025 report's chart gives 11.5% for 2024. The 2024 report's text says "2024 წლის ნომინალურმა წლიურმა ამონაგებმა 11.6% შეადგინა", and its own chart also shows 11.6%. The page serves 11.5% (the 2025 report) and the methodology mentions the difference.

Not compared, because the original does not give a figure that can be read the same way: employers and returns in the 2019 and 2020 reports (not printed for the year), the 2022 report's return chart (its year labels are not text), and the 2021 statement (a scanned image). The 2020 report's "12.9%" is the average yield of its investments, not a published annual return, and it equals the 2025 chart's 2020 return.

## Re-running

```
cd "docs/Raw Data/Social/pension-fund"
python3 -I test_extract.py      # needs poppler's pdftotext; checks the fixture and the committed outputs
python3 -I extract.py           # re-checks the originals, then rewrites the CSV and the report
python3 -I extract.py --write-manifest   # only after replacing a PDF: rebuilds source-manifest.json
```

If pensions.ge replaces a file, download it under the same name from the `url` in the manifest, rebuild the manifest, re-run the tests and read any new difference by hand before changing the recorded lists in `test_extract.py`. A change in `sha256` of a served file changes what the funded pension page shows.
