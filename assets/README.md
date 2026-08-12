# Assets

Journal PDF v1.2.0 intentionally contains no test journals and no generated PDFs.

For a fully same-origin/offline font setup, the repository maintainer may place a legally obtained copy of **Tinos-Regular.ttf** here as:

`assets/Tinos-Regular.ttf`

The application checks this path first. If it is absent, it fetches the same open-licensed Tinos font from the version-pinned upstream fallback configured in `js/pdf-generator.js`.

Do not place Times New Roman or any font whose redistribution license is unclear in this repository.
