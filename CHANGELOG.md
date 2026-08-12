# Changelog

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
