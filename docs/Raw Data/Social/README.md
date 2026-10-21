# Social protection raw data

Research sources for the pensions and social help pages.

- `ssa-statistics/`: Social Service Agency (SSA) statistics. The catalogue and cleaned tables are at the top; the original files are in `official/` (`workbooks/` has all 1,027 SSA workbooks for 13 topics, `pages/` the saved section pages, `recovery/` the original archive's index and manifest).
- `geostat-social-protection/`: Geostat social protection workbooks (`official/`) and the cleaned table, with a cross-check against SSA.
- `MANIFEST.csv`: path, size and SHA-256 of every original file. For SSA files, `original_download_path` gives the file's path in the original `ssa-statistics` download, so the original folder structure can be rebuilt.
- `file-transfer-2026-10-19.csv`, `storage-status.json` and `storage-verification.json` record the local move and hash check on 19 October 2026.

The original archive `ssa-statistics/official/recovery/ssa-statistics.zip` (117,294,520 bytes, over GitHub's 100 MB file limit) is not committed. Each of its 832 files is committed under `official/` with identical bytes, as `MANIFEST.csv` shows.
