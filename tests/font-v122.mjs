// Journal PDF v1.2.2 font/symbol regression checklist (A-H).
// Executed together with tests/run-tests.mjs against external, non-committed fixtures.
// A: ordinary U+03B2 beta is covered by Tinos and PDF succeeds.
// B: U+F062 + source font Symbol maps to U+03B2 beta and PDF succeeds.
// C: U+F062 + unknown source font is not auto-mapped and requires review.
// D: rich-text <rPr><rFont val="..."> provenance is retained.
// E: cell-style <font><name val="..."> provenance is retained.
// F: unsupported Unicode is caught by font preflight with file/subject/sheet/cell/font/codepoint context.
// G: technical report preserves current session statistics after preflight/PDF errors.
// H: real 26-journal ZIP still produces one 108-page PDF after decisions; source ZIP/XLSX hashes remain unchanged.
//
// Important: PUA mappings are font-dependent. v1.2.2 deliberately does not define a global F062 -> beta rule.
// The verified Symbol mapping is distinct from Wingdings (where the same legacy/private slot has different semantics).
export const FONT_TESTS_V122=['A','B','C','D','E','F','G','H'];
