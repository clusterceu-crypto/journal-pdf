# Journal PDF v1.2.4 — Technical report

## Root cause: `font.hasCodePoint is not a function`
The v1.2.3 Greek preflight expected `hasCodePoint(cp)`, but the deployed `JournalPdf.TrueTypeFont` implementation exposed `glyphFor(cp)` only. Earlier helper tests used a mock object that happened to implement `hasCodePoint`, so they did not reproduce the production API mismatch.

v1.2.4 adds a compatibility helper and, for the production class, `hasCodePoint(cp) { return cp === 0 || this.glyphFor(cp) !== 0; }`. No glyph is assumed supported without the cmap lookup.

## Manual replacements
Font coverage is run on the resolved PDF text. User replacements are preserved exactly. Tests cover Unicode `β`/`γ` and textual `бетта`/`гамма`.

## UI recovery
After a recoverable fatal/preflight message, controls are recalculated from current subject/pending-decision state. Download remains disabled until `pdfDone`.

## Stack overflow
The workbook parser used spread-based maximum discovery (`Math.max(...rows.keys())` and an equivalent cell-column spread). Very large formatted worksheets can exceed the JavaScript engine's argument stack before `Math.max` executes. v1.2.4 guards parsing so the same maxima are obtained with constant-size iterators while retaining every row/cell in the Maps. Native Map iteration is restored in `finally`.

The worker now labels failures as either `Етап читання XLSX` or `Етап розпізнавання структури`, so future structural failures are not reported as an undifferentiated stack error.

## Executed local checks
- Production `JournalPdf.TrueTypeFont` + real system Tinos: Greek preflight PASS for α, β, γ, ω.
- Manual replacement preservation: PASS for β, γ, бетта, гамма.
- Synthetic 130,000-cell XLSX: stack-safe parse PASS; 130,000 cells retained, maxRow=130000, maxCol=1.

The exact E-20-19 ZIP named in the manual report is not present in the currently accessible conversation/library fixtures, so its final subject count and PDF page count must not be claimed until that exact archive is available or the user reruns it on Pages.
