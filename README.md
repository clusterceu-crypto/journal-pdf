# Journal PDF v1.2.4

Browser-only GitHub Pages application that converts a ZIP of `.xlsx` / `.xlsm` group journals into one unencrypted A4-landscape PDF. Source Excel files are never rewritten and journal data is processed locally in the browser.

## v1.2.4 — production font and recovery fixes

v1.2.4 fixes the blocking production mismatch found in v1.2.3: Greek preflight called `font.hasCodePoint`, while the deployed `JournalPdf.TrueTypeFont` exposed `glyphFor`. The compatibility layer now derives `hasCodePoint(cp)` from `glyphFor(cp) !== 0` and the preflight helper supports either API without assuming glyph coverage.

User font-symbol decisions are preserved exactly. Replacements such as `β`, `γ`, `бетта`, `гамма`, or any other manually entered PDF-only text are validated after replacement, not replaced by the original PUA code point.

Recoverable PDF/preflight failures no longer strand the UI in a disabled state. Review remains available while decisions are pending; Generate is enabled again when all decisions are resolved; Download is enabled only by a successful `pdfDone`.

Large formatted worksheets are guarded against JavaScript argument-stack overflow during max-row/max-column discovery. All cells remain in the parsed workbook; only the temporary max calculation is made stack-safe, and native Map iteration is restored immediately after parsing.

## Existing behavior retained

Type A / Type B, fixed 8 mm grade columns, A4 landscape, black grade tables, red only for numeric service hours, grade/attestation/slash normalization, review of ambiguous values, `Примітки`, extra-text review, empty grade-page omission, source-font provenance, conservative PUA handling, Greek palette, ZIP safety and immutable source XLSX/ZIP remain in force.

## Tests

`tests/regression-v124.mjs` adds a production-object Greek test using `JournalPdf.TrueTypeFont` with real Tinos data for `α`, `β`, `γ`, `ω`. Release QA also includes replacement-preservation checks and a synthetic 130,000-cell stack-safety parse.

Real journal fixtures remain external and must never be committed.

## GitHub Pages

Test branch: `develop`. Stable `main` changes only after explicit approval.

Test URL: `https://clusterceu-crypto.github.io/journal-pdf/`

Current version: **Journal PDF v1.2.4**.
