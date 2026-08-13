# Journal PDF v1.2.7

Browser-only GitHub Pages application that converts a ZIP of `.xlsx` / `.xlsm` group journals into one unencrypted A4-landscape PDF. Journal data is processed locally in the browser and source Excel files are never rewritten.

## v1.2.7

- Adds a first A4 landscape title page: **«ЖУРНАЛ ОБЛІКУ РОБОТИ АКАДЕМІЧНОЇ ГРУПИ»**, detected group name, and a user-entered academic year.
- The academic year is entered in the UI and copied verbatim to the PDF; it is not inferred from journal dates and is not persisted in localStorage/IndexedDB.
- PDF-only layout removes trailing student rows that contain no student name and no marks. Rows with a student name or any mark remain; the separate `Примітки` row remains untouched.
- `Кількість годин` continues to render centered in the topics table; numeric red service-hour values remain red under the existing v1.2.x rule.
- `Перевірити нестандартні значення` is a dedicated green action button.
- Waiting jokes and the visible jokes option are removed from the UI.

## Existing behavior retained

Type A / Type B detection, fixed 8 mm grade columns, A4 landscape, black grade tables, red numeric service hours only, grade/attestation/slash normalization, manual review, source-font/PUA handling, Greek Unicode replacement, font preflight, ZIP safety, UI recovery after PDF errors, and immutable source XLSX/ZIP remain in force.

## Tests

`tests/regression-v127.mjs` covers title-page insertion, conservative empty-row filtering, `Примітки` preservation policy, academic-year passthrough and version/UI invariants. Existing v1.2.0–v1.2.6 regression files remain part of the release baseline. Real journal fixtures remain external and must never be committed.

## GitHub Pages

Test branch: `develop` / root. Stable `main` changes only after explicit approval.

Test URL: `https://clusterceu-crypto.github.io/journal-pdf/`

Current version: **Journal PDF v1.2.7**.
