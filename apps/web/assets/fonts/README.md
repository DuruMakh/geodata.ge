# Bundled fonts

## Open Graph font

`NotoSansGeorgian-Regular.ttf` is the unhinted static Noto Sans Georgian Regular build used only by the server-rendered Open Graph image.

- Source: https://notofonts.github.io/georgian/fonts/NotoSansGeorgian/unhinted/ttf/NotoSansGeorgian-Regular.ttf
- Retrieved: 2026-08-22
- SHA-256: `fa3d96f1a7257da0f23fb7eda880dcac05a69ca168e55a42ddf87fd03e6fcef7`
- Copyright: 2022 The Noto Project Authors
- License: SIL Open Font License 1.1; see `OFL-NotoSansGeorgian.txt`

## Landing hero display face

`EurostileGEOMt-Demi.woff2` is the browser-delivered face loaded by `components/landing/landing-page.tsx` for the landing `<h1>` only. It is a lossless WOFF2 conversion of the retained `EurostileGEOMt-Demi.ttf` source. Its Mkhedruli codepoints carry Mtavruli glyphs, so the heading displays as caps while the DOM text stays Mkhedruli.

- Source: https://typeface.ge/ka/font/Eurostile+GEOMt (`/ka/font/554/download`)
- Retrieved: 2026-08-27
- SHA-256: `89ce4893c26756ba669c5edc4fa2c3575a53bdb42a6bd9b2134ee7027b21e36e`
- Designer: Merab Getsadze; `manufacturer` field names GF Fonts
- Copyright: `© 2025 GF Fonts. All rights reserved.`
- License: the archive ships no license file; the font's `name` table sets the license field to the single word `Free` and the license URL to `upload@typeface.ge`. The same table claims `Eurostile GEO_Mt is a trademark of GF Fonts`, while Eurostile is a Monotype typeface (Aldo Novarese, 1962). Terms were not verifiable at the time of import.

## Site text faces

`NotoSansGeorgian-Variable.woff2`, `NotoSerifGeorgian-Variable.woff2` and `GeistMono-Variable.woff2` are the UI, display and numeric faces loaded with `next/font/local` by `components/site/root-document.tsx`. They are stored here so `next build` never downloads fonts: Next 16's Turbopack fails the build whenever Google Fonts serves a font from its `/l/font?kit=…&skey=…` address form.

- Source: the `google/fonts` repository (`ofl/notosansgeorgian/NotoSansGeorgian[wdth,wght].ttf`, `ofl/notoserifgeorgian/NotoSerifGeorgian[wdth,wght].ttf`, `ofl/geistmono/GeistMono[wght].ttf`), the same versions Google Fonts served on retrieval: 2.005, 2.003 and 1.701.
- Retrieved: 2026-10-12
- Processing: `fonttools varLib.instancer` pinned `wdth=100` and limited `wght` to 400–700 (Geist Mono 400–600), then `pyftsubset --unicodes='*' --glyphs='*' --layout-features='*' --flavor=woff2`; every glyph is kept.
- SHA-256: `72d15828444dd4007e9e5f31e212b52e92af834db8f194bab267a5c7aa67923d` (Noto Sans Georgian), `e24a340babc302db1fff2b74f9d3903eae0110b2c6daca5585eb606cdcd7b75f` (Noto Serif Georgian), `a00979ae945b142cb54e87617e1facb16bf1913bc9e5c2cc60195b4813450cf8` (Geist Mono)
- Copyright: 2022 The Noto Project Authors (both Noto faces); 2024 The Geist Project Authors (Geist Mono)
- License: SIL Open Font License 1.1; see `OFL-NotoSansGeorgian.txt`, `OFL-NotoSerifGeorgian.txt` and `OFL-GeistMono.txt`. `OFL-NotoSerifGeorgian.txt` is the `ofl/notoserifgeorgian/OFL.txt` file of the `google/fonts` repository, retrieved 2026-10-13; its copyright line matches the font's own `name` table (ID 0): `Copyright 2022 The Noto Project Authors (https://github.com/notofonts/georgian)`.
