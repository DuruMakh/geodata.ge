# Marriages and divorces: design for Duru's OK

Written 2026-10-20 (Tbilisi time) for the "Marriages and divorces" thread. Nothing is built yet; this is the plan to approve.

## What you asked for

Marriages and divorces each year since 1994, with a municipality map, inside the existing Population hub (მოსახლეობა / Demography), which already has Population, Age and sex, Migration and Births and deaths.

## What a visitor will see

**One new page, "ქორწინება და განქორწინება" (Marriages and divorces)**, the fifth card in the Population hub, at `/explorer/demography/marriages-divorces` (English under `/en/...`). It is built the same way as the existing Births and deaths page, so the hub stays consistent.

1. **Heading and one short line:** "2025: 22,285 ქორწინება, 13,173 განქორწინება". Nothing else under the heading.
2. **Georgia over time (chart with the series list on the right):**
   - Under the heading "Number": Marriages, Divorces (both ticked by default).
   - Under "Average age at marriage": men, women; and first marriages only, men and women.
   - Under "Average age at divorce": men, women.
   - Under "Marriage length": how long marriages lasted before divorce (average years).
   - One icon switch: number / per 1,000 residents (it only changes the two counts). The chart shows one unit at a time, as on the Business and Crime pages.
   - 1994–2025. Excel download. One short source line under the chart.
3. **Municipality map for 2025:** marriages per 1,000 residents, with the list beside it, Georgia at the top. Each line also shows that place's marriages and divorces as counts. Clicking Georgia, a region or a municipality opens that place's own Population page.
4. **On every Population place page** (Georgia, the 11 regions, the 64 municipalities): a new "Marriages and divorces" section below "Births and deaths", with that place's marriages and divorces 1994–2025 as columns, the per-1,000 icon, a table view and an Excel download. The map links land on this section.

## A few numbers it will show

- Marriages: 21,908 in 1994, a low of 12,535 in 2002, a peak of 34,693 in 2013, 16,359 in 2020 (COVID year), 22,285 in 2025.
- Divorces: 3,089 in 1994, 1,622 in 1999, then a steady rise to 14,098 in 2022; 13,173 in 2025.
- Per 1,000 residents in 2025: 5.7 marriages, 3.3 divorces (1994: 4.5 and 0.6).
- Average age at first marriage, 2025: men 32.4, women 30.1 (1994: 26.8 and 23.3).
- Marriages that ended in divorce in 2025 had lasted 10.9 years on average.
- Map 2025: from about 4 marriages per 1,000 residents (Mtskheta, Ninotsminda) to about 10 (Khulo, Kazbegi, Bolnisi).

## Source

Geostat, Population and Demography: Marriages (category 323) and Divorces (category 324), 17 tables, all downloaded and read in the cloud, plus Geostat's two metadata notes. We use 8 of them: marriages and divorces by municipality (34, 41), crude marriage and divorce rates for Georgia and the regions (39, 39-1, 46, 46-1), mean age of spouses (40), mean age of divorced people (48) and average duration of marriage (47). The originals are archived in the repository with checksums, like all other Population files.

## Decisions I made (say if you want any changed)

1. **Per 1,000 for municipalities is our calculation.** Geostat publishes the rate for Georgia and the regions only. For municipalities we divide marriages by Geostat's own mid-year population (the same rule Geostat uses), and a check proves the method by reproducing Geostat's published region rates exactly. Georgia and the regions show Geostat's own published rates. *(Amended at build, 2026-10-20: every place's rate is calculated the same way, so one method serves Georgia, the regions and the municipalities; the check holds every Georgia and region rate within 0.05 of Geostat's published one, apart from two reviewed 2018 regional divorce cells.)*
2. **The map shows marriages only.** Divorces appear as a count on each list line and in the place pages. One map measure keeps it simple; a second map would need a switch.
3. *(Amended 2026-10-20: Georgia keeps 1994–2025; regions and municipalities start in 2009, because Geostat's place rows before 2009 are on older borders: Tbilisi took in neighbouring villages in 2007, and until 2008 they include Akhalgori and three other now-occupied areas. From 2009 every municipality adds up exactly to its region and to Georgia. Duru was asked on a card; the build follows this default until answered.)* Originally: **Years are 1994–2025 everywhere**, places included. Geostat says the method has not changed over the period. Two small notes go into the methodology, not on the page: until 2008 Georgia's and Mtskheta-Mtianeti's totals include Akhalgori (14–90 marriages a year), which is now occupied; and in 2014–2016 Geostat prints seven towns on their own rows, which we add back into their municipalities (as on Births and deaths).
4. **The 2025 per-1,000 values are marked "new counting"**, because 2025 rates divide by the population recalculated after the 2024 census (the same marker the other Population pages show). The counts themselves are not affected.
5. **Left out to keep the page focused:** monthly tables (the site shows years only), five-year age groups, previous marital status, order of marriage, and divorces by how long the marriage lasted in groups. They stay archived and can be added later.
6. **Two facts go into the methodology:** since 2017 marriages under 18 are no longer registered (Civil Code change), which lifts the average ages slightly; and marriages where both spouses are foreigners living abroad are not counted.

## Shared files

The Population hub card list, navigation, methodology page, database setup and browser-test page counts are shared with the other hub threads now building. If another thread merges first, this one redoes those edits before its own merge, as agreed.

## Next step

After your OK: a step-by-step build plan, then the build, then screenshots and a clickable preview link before anything goes to a PR.
