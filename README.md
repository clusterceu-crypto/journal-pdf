# Journal PDF v1.2.3

Browser-only GitHub Pages application that converts a ZIP of `.xlsx` / `.xlsm` group journals into one unencrypted A4-landscape PDF. Source Excel files are never rewritten.

## v1.2.3 — review UX and Greek Unicode

The font-symbol review card now exposes **subject, file, worksheet, cell, problem type, source font, code point and occurrence count immediately**. A compact 32-character context window highlights the exact problematic glyph and can expand to the full cell text. Multiple occurrences can be expanded into a per-cell provenance list.

Review navigation includes previous/next problem, next unresolved problem and filters for unresolved/all/grades/font symbols/Excel errors/extra text. Grouping is conservative: font-symbol groups include category + code point + source font + context category, so identical PUA values from different fonts are never merged.

A Greek palette provides standard Unicode `α–ω` with Ukrainian names/tooltips plus optional textual replacements (`альфа`, `бета`, `гамма`). Standard Greek Unicode and the standard uppercase Greek letters are explicitly checked against Tinos during preflight and do not create PUA warnings. Textual names are never substituted automatically.

`Залишити` is disabled for a blocking unsupported font glyph; the UI explains that the user must replace or remove it. No global PUA-to-Greek mapping was added. Existing v1.2.2 source-font-specific mapping remains conservative.

## Existing behavior retained

Type A / Type B, fixed 8 mm grade columns, A4 landscape, black grade tables, red only for numeric service hours, `н -> нб`, `н/на -> н/а`, slash normalization, review of `зрх`, `?`, `-`, `.`, notes, extra text, empty grade-page omission, font preflight, ZIP safety and immutable source XLSX/ZIP remain in force.

## Tests

`tests/run-tests.mjs` is the regression suite. `tests/font-v122.mjs` covers v1.2.2 A-H. `tests/font-v123.mjs` contains the v1.2.3 24-case UX/Greek/font checklist and executable helper assertions. Real fixtures remain external.

## GitHub Pages

Test branch: `develop`. Stable `main` changes only after explicit approval.

Test URL: `https://clusterceu-crypto.github.io/journal-pdf/`

Current version: **Journal PDF v1.2.3**.
