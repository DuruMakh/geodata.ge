# Trade product translation references

The two original JSON responses were captured from Geostat's public Trade portal classification endpoint on 2026-10-10. `manifest.json` records the original URL, size and SHA256 for each. They are language references, not monetary observations or proof of a historical HS edition.

`label-review.csv` records all 1,562 distinct native HS4 code/name pairs in the four accepted 1995–2025 blocks and their Georgian display names. For 1,238 pairs, the native English name and code match the official bilingual reference after punctuation/spacing normalization. The remaining 324 pairs use concise translations of the native wording, preserving its important qualifiers instead of substituting a current definition.

In particular, the native historical 4114 Wooden frames and 4115 wooden packing labels remain wood products; they are not replaced by the current leather descriptions for those codes. Historical 8485 Machinery parts, 8524 recorded media and 8517 line telephony retain their native meanings. Where the source itself has a wording or allocation exception, its original English label, four-digit code, source block and original cells remain attached; translation does not resolve or remap it.

The reviewed human-readable catalogue is `data/imports/trade-products-catalogue.csv`. Its IDs include the source block. English companions preserve the native primary name, and alternative captured flow names remain search aliases. Reviewed everyday aliases help find a broader native product entry; an alias does not narrow its amounts to that word or join historical series. The label references are not added to the public original-workbook archive or Trade MCP datasets.
