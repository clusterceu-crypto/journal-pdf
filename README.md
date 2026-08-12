# Journal PDF v1.2.2

Browser-only GitHub Pages application that converts a ZIP of `.xlsx` / `.xlsm` group journals into one unencrypted A4-landscape PDF. Journal data stays in browser memory; source Excel files are never rewritten, macros/formulas are never executed, and journal data is not uploaded to a server.

> Core rule: layout may change; factual educational data may not. Deterministic PDF-only normalization is allowed; ambiguous values or symbols require a user decision.

## v1.2.2 — font / symbol safety

Excel can store visible legacy symbols as Unicode Private Use Area code points (`U+E000..U+F8FF`). A PUA value is font-dependent, therefore Journal PDF does **not** apply a global rule such as `U+F062 -> β`.

The v1.2.2 parser preserves source-font provenance from OOXML cell styles and rich-text runs: font name (`<name>` / `<rFont>`), family, charset, scheme, file, worksheet and cell reference. Before PDF rendering, a dedicated Font / symbol normalization phase scans PUA values and applies only explicit source-font-specific mappings. Unknown or ambiguous cases become **Нестандартні символи шрифту** review items.

Example of why the font matters: the legacy Symbol-font slot represented as `U+F062` corresponds to standard Unicode `β` (`U+03B2`), while the same private slot in Wingdings has different semantics (LEO / `♌`). The code point alone is therefore never sufficient evidence for replacement.

All final text is checked against the embedded Tinos font before PDF rendering. Unsupported characters block generation and are reported with file, discipline, worksheet, cell, source font, code point and cell text. A user can remove the character only in the PDF model or replace it with supported Unicode. Technical reports retain the current session statistics after font/preflight errors.

## Existing v1.2.1 behavior retained

- Type A: grades and topics on one worksheet.
- Type B: grades and topics on different worksheets of one workbook; sheet type is detected by content and combined into one discipline.
- Fixed 8 mm grade/date columns; small tables are not stretched; large tables paginate with discipline, teacher and full student list repeated.
- Separate `Дата | Кількість годин | Теми занять` pages; long text wraps; safe continuation rows are joined without correcting source wording.
- Grade table is black. In topic tables only numeric red source values in `Кількість годин` remain red.
- Empty grade pages containing only `№ | ПІБ студента` are omitted while topic pages remain.
- `Примітки` and service notes are preserved and excluded from grade normalization.
- Deterministic PDF-only normalization: `н -> нб`; attestation `н/на -> н/а`; slash rules such as `10/- -> 10`, `-/7 -> 7`, `нб/5 -> 5`, `5/нб -> 5`, `нб/зрх -> нб`.
- Standalone `зрх`, `?`, `-`, `.`, Excel errors and other ambiguous text go to review with remove / keep / replace controls.
- ZIP path traversal, symlink, encryption, suspicious compression ratio, entry-count and size limits are enforced.
- Web Worker keeps analysis/PDF work responsive; progress and current subject are shown live.

## Font mapping policy

Mapping tables are intentionally conservative. A mapping is keyed by **source font + legacy/private code point**. `Symbol`, `Wingdings`, `Wingdings 2`, `Wingdings 3`, `Webdings` and other symbol fonts are never treated as interchangeable. Unlisted mappings are not guessed and remain review items until a verified mapping is added or the user supplies Unicode replacement.

## Tests

`tests/run-tests.mjs` contains the v1.2.1 regression suite. `tests/font-v122.mjs` documents the additional A-H font cases: ordinary β; source-font-dependent U+F062; unknown-font review; rich-text `rPr/rFont`; cell-style font provenance; unsupported Unicode preflight; retained technical-report statistics; and real-ZIP end-to-end generation. Real fixtures are supplied externally and are never committed.

## GitHub Pages

Test branch: `develop` / repository root. Stable `main` is changed only after explicit approval.

Test URL: `https://clusterceu-crypto.github.io/journal-pdf/`

Current version: **Journal PDF v1.2.2**.
