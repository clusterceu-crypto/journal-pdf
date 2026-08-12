# Tests — Journal PDF v1.2.1

Real test journals are supplied by **external path**. Never copy real XLSX/XLSM/ZIP/PDF fixtures into this repository.

```bash
node tests/run-tests.mjs \
  --zip "/path/to/group.zip" \
  --type-b "/path/to/type-b-example.xlsx" \
  --font "/path/to/Tinos-Regular.ttf" \
  --out "/tmp/journal-test.pdf" \
  --json "/tmp/journal-test-report.json"
```

The required 24 checks cover normalization (`зрх`, `?`, `-`, `.`, `н`, `на`, slash rules), `Примітки`, service notes, inter-table text, empty grade pages, the v1.2.1 color policy, Type A/Type B, A4 landscape, fixed 8 mm grade columns, multi-page grade alignment and source-file immutability.

The runner additionally performs a recognized-source → rendered-PDF manifest audit. Source cells that belong exclusively to an intentionally skipped empty grade page are reported separately rather than treated as lost content.
