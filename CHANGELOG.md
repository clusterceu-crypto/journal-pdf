# Changelog

## 1.2.3 — 2026-08-13

### Improved
- Font-symbol review cards immediately show subject, file, worksheet, cell, problem type, source font, code point and occurrence count.
- Compact context highlights the exact problematic glyph and offers full-cell expansion.
- Added previous/next/next-unresolved navigation and review filters.
- Safe grouping now includes source font and context category, preventing cross-font PUA bulk replacement.

### Added
- Greek Unicode palette `α–ω` with Ukrainian letter names/tooltips and optional textual replacements.
- Explicit Tinos preflight coverage check for standard lowercase and uppercase Greek letters.
- Blocking unsupported glyphs disable `Залишити` and explain why replacement/removal is required.
- Technical-report fields for context, chosen decision, replacement, unsupported/resolved/unresolved counters.
- v1.2.3 24-case font/UX regression checklist.

### Safety
- No global `U+F0xx -> Greek` rules. Automatic PUA mapping remains source-font-specific and verified only.
- Contextual wording can guide the user but is never sufficient for automatic replacement.

## 1.2.2 — 2026-08-13
- Added OOXML source-font provenance, font-dependent PUA normalization and Tinos coverage preflight.
- Preserved analysis statistics and full provenance on PDF/font errors.

## 1.2.1 — 2026-08-12
- Added deterministic PDF-only grade/attestation normalization and grouped manual review.
- Added `Примітки`, inter-table text review, empty grade-page omission and black grade-table policy.

## 1.2.0 — 2026-08-12
- Migrated to browser-only GitHub Pages architecture.
