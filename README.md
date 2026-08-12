# Journal PDF v1.2.0

**Journal PDF** is a browser-only web application that converts a ZIP archive of group electronic journals (`.xlsx` / `.xlsm`) into one printable, unencrypted A4 landscape PDF.

> Core rule: **layout may change; factual educational data may not.** If the structure or a cell is ambiguous, the application reports a warning instead of silently “fixing” the journal.

## Privacy model

- The ZIP, Excel contents, names, grades, themes and generated PDF are processed in browser memory.
- Journal files are not uploaded by the application to a server or third-party API.
- `localStorage` and `IndexedDB` are not used for journal data.
- Reloading the page clears the in-memory working state.
- Excel macros are never executed.
- Excel formulas are never calculated. Existing cached/display values are read when available; a formula without a usable cached result becomes a warning.
- GitHub Pages only serves the static HTML/CSS/JavaScript application.

The PDF needs a Ukrainian-capable Unicode serif font. The app first tries `assets/Tinos-Regular.ttf` and otherwise downloads the **static Tinos Regular font file only** from a version-pinned upstream URL. No journal data is attached to that request. See `THIRD_PARTY_LICENSES.md`.

## Supported journal layouts

### Type A
Grades and `Дата | Кількість годин | Теми занять` are on the same worksheet.

### Type B
Grades are on one worksheet and the lesson-topic table is on another worksheet of the same workbook. Worksheet names are not used for classification; the type is determined from cell content. Both worksheets are combined into one discipline.

## PDF rules

- A4 landscape on every page.
- One PDF for the entire group, disciplines sorted alphabetically.
- Grades first, topics second within each discipline.
- `№` width: 9 mm; student-name width: 70 mm; every grade/date column: **8 mm**.
- A small number of date columns is **not** stretched to the right page edge.
- Many date columns are split across additional pages; the discipline, teacher and full student list are repeated on every grade page.
- Topic table uses narrow date/hour columns and the remaining width for the theme.
- Long themes wrap and rows grow as required.
- Safe topic continuation rule: if the next row has empty date + hours and non-empty theme text, its text is appended as a continuation of the previous theme. Words are not corrected or normalized.
- Main text is black. Text originating from an Excel cell with red font remains red in the PDF.
- PDF text remains selectable/searchable text; pages are not screenshots.
- PDF is not encrypted and is suitable for later signing with KEP/EDS tooling.

## Validation and manual PDF-only decisions

Before PDF creation the app reports, among other things:

- Excel error cells such as `#NAME?` and `#VALUE!`;
- formulas that have no usable cached result;
- unreadable workbooks;
- ambiguous or incomplete journal structures.

For a correctable cell the user can:

1. leave it as-is (default);
2. enter a replacement used **only in the PDF**;
3. make it blank **only in the PDF**.

The original workbook is never modified.

## ZIP safety limits

The browser ZIP reader rejects unsafe paths, symlinks, encrypted entries, ZIP64 entries, unsupported compression methods and CRC failures. Current outer-archive limits are:

- archive: 200 MB;
- up to 500 ZIP entries;
- up to 500 MB total uncompressed data;
- up to 50 MB for one outer entry;
- suspicious compression ratio above 250:1 for entries over 1 MB is rejected;
- up to 200 Excel journal files per group archive.

Individual XLSX/XLSM files are themselves ZIP containers and are parsed under additional internal limits.

## Browser requirements

A modern browser with `Worker`, `Blob`, `TextDecoder`, `DataView`, `fetch` and `DecompressionStream('deflate-raw')` support is required. Current Chromium-family browsers are the primary tested target for v1.2.0.

## GitHub Pages

The repository is intended to be served directly from the branch root:

- test branch: `develop`;
- stable branch: `main` after explicit approval;
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
├── css/
│   └── app.css
├── js/
│   ├── app.js
│   ├── archive.js
│   ├── workbook-parser.js
│   ├── journal-parser.js
│   ├── pdf-generator.js
│   ├── validation.js
│   ├── progress.js
│   └── worker.js
├── assets/
│   └── README.md
└── tests/
    ├── README.md
    └── run-tests.mjs
```

## Local development

Serve the repository with any static HTTP server. Do not open `index.html` via `file://`, because Web Workers and font fetching are subject to browser origin restrictions.

Example for development only:

```bash
python -m http.server 8080
```

Then open `http://127.0.0.1:8080/`.

## Test data policy

Real `.xlsx`, `.xlsm`, `.zip` and generated `.pdf` files are excluded by `.gitignore`. **Do not add exceptions for `tests/fixtures`.** Tests accept external paths so real journals remain outside the repository.

## Version

Current version: **Journal PDF v1.2.0**.
