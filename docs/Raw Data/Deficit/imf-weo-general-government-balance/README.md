# IMF general-government balance source package

This package preserves the reviewed April 2026 IMF World Economic Outlook workbook used for Georgia's annual general-government balance data.

- Source page: <https://data.imf.org/Datasets/WEO>
- Preserved workbook: `official/WEOApr2026all.xlsx`
- Retrieved workbook URL: <https://data.imf.org/-/media/iData/External-Storage/Documents/2F78EE59F79143A7921E5E203D3AAA80/en/WEOApr2026all.xlsx>
- Dataset version: `IMF.RES:WEO(9.0.0)`
- Worksheet and country: `Countries`, `GEO`
- Reviewed size: 5,585,205 bytes
- SHA-256: `B29239CB48F8B895D1E526070C4FDE01147BC8F6BD3B86F636363BB6BD87FE7A`

The two public measures are `GEO.GGXCNL_NGDP.A` (net lending or borrowing as a percent of GDP) and `GEO.GGXCNL.A` (net lending or borrowing in billions of Georgian lari). The generator converts the nominal series to GEL by multiplying by 1,000,000,000. `GEO.NGDP_FY.A` is retained only in the staging evidence to validate the IMF percentage; it is not a third public statistic.

Coverage is complete for 1995–2031. The IMF workbook identifies 2025 as the latest actual year, so 1995–2025 are marked `actual` and 2026–2031 are marked `projection`. Values keep the IMF sign: negative means deficit/net borrowing, positive means surplus/net lending, and zero means balance.

From `apps/web`, run `npm run data:prepare-general-government-balance` to regenerate the staging CSV, canonical CSV, and validation report. Run `npm run data:check-general-government-balance` to verify the source and require a byte-for-byte match without writing files.

A later WEO vintage must be preserved as a new reviewed source package. It must not silently replace this workbook or its generated history because IMF releases can revise both historical and projected observations.
