# Changelog

## 1.2.1 — 2026-08-12

### Added
- Controlled PDF-only normalization of ordinary grade and attestation values.
- Explicit rules for `н`, `на`, valid grade pairs and deterministic slash constructions such as `10/-`, `-/7`, `нб/5`, `5/нб`, `нб/зрх`.
- Grouped **Перевірити нестандартні значення** dialog with remove / keep / replace decisions and per-cell locations.
- Bulk decision actions for equal values and remove/keep review for text found between `Примітки` and the topics table.
- Analysis metrics for automatic normalizations and cases requiring a decision.
- 24-test v1.2.1 regression suite and an additional data-loss audit.

### Changed
- Grade-table text is always rendered black, regardless of Excel font color.
- In the topics table, red is retained only for numeric source cells in `Кількість годин` that were red in Excel.
- `Примітки` receives a merged label area; service annotations in the row are preserved and excluded from grade normalization.
- Empty grade pages containing only the student list are omitted while other discipline content remains.
- Technical report and UI version updated to 1.2.1.

### Safety
- All normalization and manual decisions remain in the PDF model only. Source XLSX/XLSM files are never modified.

## 1.2.0 — 2026-08-12

### Changed
- Replaced the Python/FastAPI/ReportLab server architecture with a static browser-only application for GitHub Pages.
- ZIP, XLSX/XLSM analysis and PDF generation now happen locally in browser memory.
- Grade columns are fixed at 8 mm and are never stretched to fill the page.

### Added
- Content-based Type A and Type B worksheet detection.
- Combining grade and topic worksheets from one workbook into one discipline.
- Safe continuation joining for topic rows with empty date/hours.
- Preservation of red Excel font marks in PDF.
- Unicode Tinos embedding in generated PDF.
- A4 landscape text-based PDF writer with repeatable grade pages and wrapped topic rows.
- Problem-cell validation with keep / PDF-only replace / PDF-only blank decisions.
- Web Worker analysis and PDF generation with live progress.
- Optional neutral waiting messages and technical-report copy action.
- ZIP path traversal, symlink, size, CRC and suspicious compression-ratio defenses.
- Automated external-fixture test runner and source-to-PDF render manifest audit.

### Removed
- FastAPI server runtime.
- Python workbook/PDF engine.
- Windows server launcher and Python requirements.
