# Bundled fonts

## Open Graph font

`NotoSansGeorgian-Regular.ttf` is the unhinted static Noto Sans Georgian Regular build used only by the server-rendered Open Graph image.

- Source: https://notofonts.github.io/georgian/fonts/NotoSansGeorgian/unhinted/ttf/NotoSansGeorgian-Regular.ttf
- Retrieved: 2026-08-22
- SHA-256: `fa3d96f1a7257da0f23fb7eda880dcac05a69ca168e55a42ddf87fd03e6fcef7`
- Copyright: 2022 The Noto Project Authors
- License: SIL Open Font License 1.1; see `OFL-NotoSansGeorgian.txt`

## Landing hero display face

`EurostileGEOMt-Demi.ttf` is loaded by `components/landing/landing-page.tsx` for the landing `<h1>` only. Its Mkhedruli codepoints carry Mtavruli glyphs, so the heading displays as caps while the DOM text stays Mkhedruli.

- Source: https://typeface.ge/ka/font/Eurostile+GEOMt (`/ka/font/554/download`)
- Retrieved: 2026-08-27
- SHA-256: `89ce4893c26756ba669c5edc4fa2c3575a53bdb42a6bd9b2134ee7027b21e36e`
- Designer: Merab Getsadze; `manufacturer` field names GF Fonts
- Copyright: `© 2025 GF Fonts. All rights reserved.`
- License: the archive ships no license file; the font's `name` table sets the license field to the single word `Free` and the license URL to `upload@typeface.ge`. The same table claims `Eurostile GEO_Mt is a trademark of GF Fonts`, while Eurostile is a Monotype typeface (Aldo Novarese, 1962). Terms were not verifiable at the time of import.
