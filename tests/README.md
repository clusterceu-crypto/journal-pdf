# Tests

The test runner uses real fixtures by **external path**. Real journals must never be copied into this repository.

```bash
node tests/run-tests.mjs \
  --zip "/path/to/group.zip" \
  --type-b "/path/to/type-b-example.xlsx" \
  --font "/path/to/Tinos-Regular.ttf" \
  --out "/tmp/journal-test.pdf"
```

The runner covers the eight v1.2 scenarios and performs a source-manifest → rendered-PDF manifest loss check. It writes only the generated PDF path supplied by `--out`.
