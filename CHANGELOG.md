# Changelog

## 1.2.4 — 2026-08-13

### Fixed
- Greek/font preflight now supports the production `JournalPdf.TrueTypeFont`: `hasCodePoint(cp)` is supplied from the existing `glyphFor(cp)` lookup, with a defensive helper fallback.
- Manual font-symbol replacements (`β`, `γ`, `бетта`, `гамма`, or any user text) remain unchanged and are what font coverage validates.
- Recoverable PDF/preflight errors restore the UI: review remains available when decisions are pending; Generate becomes active again when pending = 0; Download activates only after `pdfDone`.
- Large formatted worksheets no longer rely on argument-stack-unsafe `Math.max(...hugeMap)` behavior during workbook parsing. The v1.2.4 parser guard computes the same maxima without dropping cells and restores native Map iteration immediately after parsing.
- Workbook warnings now identify whether failure happened while reading XLSX or while recognizing journal structure.

### Tests
- Added a regression using a real `JournalPdf.TrueTypeFont` and real Tinos data for `α`, `β`, `γ`, `ω`.
- Added manual replacement preservation checks.
- Release QA includes a synthetic 130,000-cell worksheet stack-safety test.

## 1.2.3 — 2026-08-13
- Improved font-symbol review context, navigation and grouping.
- Added Greek Unicode palette and Tinos Greek preflight.

## 1.2.2 — 2026-08-13
- Added OOXML source-font provenance, font-dependent PUA normalization and Tinos coverage preflight.

## 1.2.1 — 2026-08-12
- Added deterministic PDF-only grade/attestation normalization and grouped manual review.

## 1.2.0 — 2026-08-12
- Migrated to browser-only GitHub Pages architecture.
