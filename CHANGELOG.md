# Changelog

## 1.2.2 — 2026-08-13

### Fixed
- Unsupported glyphs are now caught by a Tinos font-coverage preflight before final PDF rendering.
- Font/preflight errors retain file, discipline, worksheet, cell, source font, code point and cell text when provenance is known.
- Technical reports retain current-session counts instead of resetting analysis statistics after PDF/font errors.

### Added
- OOXML source-font provenance from cell styles (`<name>`, family, charset, scheme) and rich-text runs (`<rPr>`, `<rFont>`).
- Dedicated PUA (`U+E000..U+F8FF`) Font / symbol normalization phase.
- Source-font-specific conservative mapping. There is no global `U+F062 -> β` rule.
- Review category **Нестандартні символи шрифту** with file/discipline/sheet/cell/font/code-point context and PDF-only replacement controls.
- PUA audit counters and A-H font/symbol regression cases.

### Safety
- A PUA value is auto-mapped only when the originating font has an explicit verified mapping; unknown or ambiguous mappings require user review.
- Existing v1.2.1 grade normalization, layout, color, Type A/Type B, privacy and ZIP-safety behavior remains in force.

## 1.2.1 — 2026-08-12
- Added deterministic PDF-only grade/attestation normalization and grouped manual review.
- Added `Примітки` handling, inter-table text review, empty grade-page omission and black grade-table policy.
- Kept red only for red numeric service values in topic-table `Кількість годин`.
- Added 24-test regression suite and source-to-PDF loss audit.

## 1.2.0 — 2026-08-12
- Migrated from Python/FastAPI to a browser-only GitHub Pages architecture.
- Added Type A/Type B content detection, fixed 8 mm grade columns, A4-landscape PDF generation, ZIP safety, Web Worker progress and PDF-only validation decisions.
