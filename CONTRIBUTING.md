# Contributing to ALAYA Automation Testing

This repo is shared by the whole QA team. Please follow this workflow so we
don't step on each other.

## Git workflow

1. **Branch per feature/PBI**, don't commit straight to `main`:
   ```bash
   git checkout -b test/PBI-xxxxx-short-description
   ```
2. **Commit your module's files only.** Because knowledge-base is split per
   module (`framework/knowledge-base/<module>.json`), you should only ever
   see changes to your own module's KB file in `git status` — if you see
   changes to another module's KB file, you probably ran the full test
   suite instead of just your module; check before committing:
   ```bash
   npx playwright test modules/<your-module>
   ```
3. **Open a PR**, tag another QA for review. Small PRs (one screen / one
   flow at a time) are much easier to review than a giant batch.
4. **Never commit `.env`.** It's gitignored — if `git status` shows it,
   something's wrong, stop and check your `.gitignore`.

## Adding tests for a module that already has some

Follow the existing pattern in that module's `pages/` and `tests/` folders.
Don't invent a new structure — consistency matters more than your personal
preference here.

## Adding tests for a brand-new module (or new screen in an existing one)

See **CLAUDE.md** — it walks through the whole process, including how to
handle screens with no confirmed selectors yet (short version: record the
flow with `record.bat`, then generate the page object from that recording).

## Code review checklist (for reviewers)

- [ ] Test titles are tagged with a category: `[Happy Path]`, `[Negative]`,
      `[UI]`, `[Edge Case]`, `[Security]`, `[Integration]`, `[Formula]`
      (matches our standard workbook conventions)
- [ ] New `heal()` calls include `kbFile: '<module>'`
- [ ] Selectors that are marked `// TODO(...)` as unconfirmed guesses are
      either confirmed before merge, or the PR description says why they're
      still unconfirmed and what's needed to confirm them
- [ ] No hardcoded credentials, URLs pointing at prod (only SIT/test
      environments), or hardcoded iframe `name` attributes (these are
      often session-specific — use `framework/frameHelper.js`'s `findFrame`
      instead)
- [ ] Page objects go in `pages/`, specs go in `tests/` — not mixed together
- [ ] Ran the test locally at least once before opening the PR

## Reporting a selector that broke after deployment

Before assuming the framework failed you, check
`framework/knowledge-base/<module>.json` for the failing element's id — it
shows every strategy that was tried. If even fuzzy fallback couldn't find
it (common for icon-only buttons with no visible text), that's a real gap
worth fixing in `framework/fuzzyMatch.js` or `selfHealingLocator.js` — flag
it in the team channel rather than just patching around it locally, since
the fix usually benefits every module.
