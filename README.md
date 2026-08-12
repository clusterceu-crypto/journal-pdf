# Journal PDF v1.2.1

**Journal PDF** is a browser-only web application that converts a ZIP archive of group electronic journals (`.xlsx` / `.xlsm`) into one printable, unencrypted A4 landscape PDF.

> Core rule: **layout may change; factual educational data may not.** Version 1.2.1 adds explicitly specified PDF-only normalization rules; anything outside those deterministic rules is shown to the user for a decision instead of being guessed.

## Privacy model

- ZIP, Excel contents, names, grades, themes and the generated PDF are processed in browser memory.
- Journal data is not uploaded by the application to a server or third-party API.
- `localStorage` and `IndexedDB` are not used for journal data.
- Reloading the page clears the in-memory working state.
- Excel macros are never executed.
- Excel formulas are never calculated. A formula without a usable cached/display value becomes a review item.
- The source XLSX/XLSM is never rewritten; normalization and user decisions exist only in the internal PDF model.
- GitHub Pages only serves static HTML/CSS/JavaScript.

The PDF embeds **Tinos Regular**, a Unicode serif font with Ukrainian support. The app first tries `assets/Tinos-Regular.ttf` and otherwise downloads only the pinned upstream font file. Journal data is never part of that request. See `THIRD_PARTY_LICENSES.md`.

## Supported journal layouts

### Type A
Grades and `Дата | Кількість годин | Теми занять` are on the same worksheet.

### Type B
Grades are on one worksheet and the lesson-topic table is on another worksheet of the same workbook. Worksheet names are not used for classification; content is. The worksheets are combined into one discipline.

## PDF-only grade normalization in v1.2.1

Ordinary grade cells accept grades `1..12`, `нб`, and two normal grades such as `5/6`. Deterministic normalization includes:

- `н` → `нб`;
- `10/-` → `10`, `-/7` → `7`, `/7` → `7`, `7/` → `7`;
- `нб/-` → `нб`, `-/нб` → `нб`;
- `нб/5` → `5`, `5/нб` → `5` (same rule for other valid grades);
- `нб/зрх` and `зрх/нб` → `нб`;
- `н/1` → `1` after interpreting `н` as `нб` in an ordinary grade column.

In confidently detected `атестація` / `переатестація` columns:

- `н` → `н/а`;
- `на` → `н/а`;
- a grade `1..12`, `н/а`, or blank is accepted.

Unlisted or ambiguous constructions are **not guessed**. Values such as standalone `зрх`, `?`, `-`, `.`, and other unknown text are sent to the review panel.

## Review panel

After ZIP analysis the UI shows:

- number of disciplines;
- number of automatic PDF-only normalizations;
- number of cases requiring a user decision;
- the button **Перевірити нестандартні значення**.

Review items are grouped into:

- nonstandard grades;
- attestation / re-attestation;
- text found between the `Примітки` row and the topic table;
- Excel formulas/errors.

Each group shows the original value, count, file, discipline, worksheet, cell and column context. The user can **Прибрати**, **Залишити**, or **Замінити на…** (where replacement is applicable), either for a single cell or all equal grouped cases. Extra text between tables intentionally supports only remove/keep. All decisions affect the generated PDF only.

## `Примітки`

The `Примітки` row remains part of the grade table. Its label is rendered in a merged 79 mm label area so the word is fully readable. Service annotations to the right (`кр`, `дз`, `л.98`, `дз.101`, `тест`, etc.) are not grade-normalized and are preserved as entered.

If separate text appears after `Примітки` but before the topics header, it becomes a review item rather than being included automatically.

## PDF layout and color rules

- A4 landscape on every page.
- One PDF for the entire group; disciplines sorted alphabetically.
- Grades first, topics second within a discipline.
- `№`: 9 mm; student name: 70 mm; every grade/date column: **8 mm**.
- Small grade tables are not stretched to the page edge.
- Many grade columns continue on new pages with discipline, teacher and the full student list repeated.
- A grade page is omitted when the workbook contains only `№ | ПІБ студента` and no meaningful date/grade/attestation columns. Topic pages for that discipline are still retained.
- **Every piece of text in the grade table is black**, regardless of Excel font color.
- In `Дата | Кількість годин | Теми занять`, red is preserved **only for numeric values in `Кількість годин` whose source Excel cell is red**. All other topic-table text is black.
- Long topics wrap without clipping.
- Safe topic continuation: a row with blank date + hours and non-empty topic text is joined to the previous topic; source wording is not corrected.
- PDF text remains selectable/searchable, the PDF is not encrypted, and the Tinos Unicode font is embedded.

## ZIP safety

The browser ZIP reader rejects path traversal, absolute paths, symlinks, encrypted entries, ZIP64 entries, unsupported compression methods and CRC failures. Limits include:

- outer archive: 200 MB;
- up to 500 ZIP entries;
- up to 500 MB total uncompressed data;
- up to 50 MB for one outer entry;
- suspicious compression ratio above 250:1 for entries over 1 MB;
- up to 200 Excel journals per group archive.

## Browser requirements

A modern browser with `Worker`, `Blob`, `TextDecoder`, `DataView`, `fetch` and `DecompressionStream('deflate-raw')`. Chromium-family browsers are the primary tested target.

## GitHub Pages

- test branch: `develop`;
- stable branch: `main` only after explicit approval;
- test URL: `https://clusterceu-crypto.github.io/journal-pdf/`.

No Python/FastAPI server is required.

## Project structure

```text
journal-pdf/
├── index.html
├── README.md
├── CHANGELOG.md
├── LICENSE
├── THIRD_PARTY_LICENSES.md
├── .gitignore
├── css/app.css
├── js/
│   ├── app.js
│   ├── archive.js
│   ├── workbook-parser.js
│   ├── journal-parser.js
│   ├── pdf-generator.js
│   ├── validation.js
│   ├── progress.js
│   └── worker.js
├── assets/README.md
└── tests/
    ├── README.md
    └── run-tests.mjs
```

## Testing

Real fixtures are passed to the test runner by external path and are never committed. The v1.2.1 runner contains the required 24 tests plus a recognized-source → PDF-render loss audit. See `tests/README.md`.

## Test data policy

Real `.xlsx`, `.xlsm`, `.zip` and generated `.pdf` are excluded by `.gitignore`. Do not add an exception for `tests/fixtures`.

## Version

Current version: **Journal PDF v1.2.1**.
