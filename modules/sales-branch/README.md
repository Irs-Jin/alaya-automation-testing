# sales-branch module

No automated tests yet. When you add the first one for this module:

1. Create page objects in `pages/` and specs in `tests/` (see `modules/inventory/` for the reference pattern).
2. Use `kbFile: 'sales-branch'` in every `heal()` call so this module's locator knowledge base stays in `framework/knowledge-base/sales-branch.json`.
3. Follow `CLAUDE.md` at the repo root for the full generation workflow.
