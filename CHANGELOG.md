# Changelog

## 1.2.7 — 2026-08-13

### Added
- First A4-landscape title page: `ЖУРНАЛ ОБЛІКУ РОБОТИ АКАДЕМІЧНОЇ ГРУПИ`, group name and user-entered academic year.
- UI field for academic year; the value is PDF-only and is not persisted.
- Dedicated green `Перевірити нестандартні значення` action.

### Changed
- PDF layout omits student rows only when both the student name and all grade cells are empty. The `Примітки` row is preserved separately.
- `Кількість годин` remains centered in topic rows, including red numeric service-hour values.
- Removed the visible jokes option and waiting jokes from the interface.

### Preserved
- v1.2.6 font-symbol replacement materialization, font preflight and recoverable UI behavior.
- Type A/Type B, 8 mm grade columns, normalization/review rules, colors, A4 landscape and immutable source files.

## 1.2.6 — 2026-08-13
- Font-symbol review replacements are materialized into source-cell PDF overrides before final rendering.

## 1.2.5 — 2026-08-13
- Review context is safe for non-font warnings such as `зар`, `зрх`, `?`, `-` and Excel errors.

## 1.2.4 — 2026-08-13
- Production `TrueTypeFont` Greek compatibility, recoverable PDF UI state and large-sheet stack-safety fixes.

## 1.2.3 — 2026-08-13
- Improved font-symbol review context, navigation and Greek Unicode palette.

## 1.2.2 — 2026-08-13
- OOXML source-font provenance, font-dependent PUA normalization and Tinos coverage preflight.

## 1.2.1 — 2026-08-12
- PDF-only grade/attestation normalization and grouped manual review.

## 1.2.0 — 2026-08-12
- Browser-only GitHub Pages architecture.
