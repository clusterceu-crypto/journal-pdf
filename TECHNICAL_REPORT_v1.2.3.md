# Journal PDF v1.2.3 — Technical report

Version: 1.2.3
Branch: develop only
Base HEAD: 5954e05e54bb61467a7d171c49308ecf7cf5ae74

## Font normalization
- Standard Unicode Greek is not treated as PUA and is sent directly to Tinos/PDF after coverage validation.
- PUA mapping remains keyed by source font + code point; no global U+F062/U+F067 Greek mapping exists.
- Unknown PUA remains a blocking review item.

## Review UX
Every font-symbol card exposes subject, file, sheet, cell, source font, code point and occurrence count before expansion. Context is clipped around and highlights the exact code point. Detailed expansion lists provenance per cell. Bulk keys include category, code point, normalized source font and context category.

Greek palette offers α–ω with Ukrainian names. Text names are optional manual replacements only. Unsupported blocking glyphs cannot be kept unchanged.

## Technical report state
Reports preserve session statistics and include file, discipline, sheet, cell, source font, code point, Unicode representation/context, selected decision and replacement when available, plus PUA found/auto-mapped/review, unsupported, resolved and unresolved counts.

## Regression scope
Type A, Type B, 8 mm grade columns, A4 landscape, black grade tables, red numeric service hours only, absence/attestation/slash normalization, ambiguous-grade review, notes, extra text, empty grade pages, font preflight and immutable source archives remain unchanged by this UX-layer release.
