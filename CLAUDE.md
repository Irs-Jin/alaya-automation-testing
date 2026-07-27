# CLAUDE.md — AI instructions for this repo

This file tells Claude (or any AI assistant) how to generate new automation
test cases for ALAYA in a way that's consistent with the rest of this repo.
If you're a QA who wants to generate new tests with AI: **copy this file's
conventions, don't skip them** — the whole point of this repo is that every
module looks and behaves the same way, so anyone can jump into anyone
else's tests.

## What this project is

Playwright test automation for ALAYA (ERP system: AR, AP, Inventory, Sales
Branch/POS, Business Intelligence, System Administration modules), built on
top of a custom self-healing locator framework. ALAYA is an ASP.NET
WebForms + DevExpress application — expect DevExpress-specific quirks (see
"DevExpress gotchas" below).

## Repo structure (do not deviate from this)

```
framework/                 <- SHARED code. Do not copy/duplicate into a module folder.
  selfHealingLocator.js     <- heal(target, spec) — use this for every locator, no raw page.locator() in page objects
  fuzzyMatch.js
  frameHelper.js            <- findFrame(page, checkFn) — use for anything inside an iframe
  loginHelper.js
  knowledge-base/<module>.json   <- one per module, auto-updated, don't hand-edit except to clear a bad entry
modules/<module>/
  pages/<Screen>Page.js     <- one page object per screen
  tests/<screen>.spec.js    <- one spec file per screen/flow
```

Module names in use: `inventory`, `ar`, `ap`, `sales-branch`, `bi`,
`sysadmin`, `login` (shared, lives in framework/ since every module needs it).

## The self-healing pattern — always use it

Never write a raw `page.locator(...)` or `page.getByRole(...)` directly for
an element that's part of the application UI (fine for one-off assertions
in tests, but page-object element getters should go through `heal()`).

```js
const { heal } = require('../../../framework/selfHealingLocator');

const { locator } = await heal(page /* or frame */, {
  id: 'createItem.itemCode',       // stable logical name — used as the KB key, never changes even if the real selector does
  label: 'Item Code',              // semantic label — used for fuzzy fallback matching if all strategies fail
  kbFile: 'inventory',             // REQUIRED — must match the module folder name
  strategies: [                     // ordered by confidence; put confirmed exact selectors first
    { type: 'css', value: '#txtItemCode_I' },        // confirmed via DevTools/codegen
    { type: 'label', value: 'Item Code' },           // fallback guesses after
    { type: 'placeholder', value: 'Item Code' },
  ],
});
```

Strategy types available: `testid`, `label`, `placeholder`, `role` (needs
`role` + optional `options`), `text`, `css`.

**Always set `kbFile` to the module you're working in.** This is what keeps
knowledge-base files from colliding between QA working on different modules.

## DevExpress gotchas (read before inspecting elements)

These cost real debugging time on the Inventory module — don't repeat that:

1. **One logical field can be two DOM elements.** Password fields
   especially: a hidden "real" input plus a visible masking clone (id
   suffix `_CLND`) for iOS/browser compatibility. If filling a field seems
   to do nothing, check for a clone.
2. **Interactive elements are often inside iframes**, with `name`
   attributes that are session-specific (a random number) or literally the
   string `"undefined"`. Never hardcode an iframe name/selector. Always use
   `framework/frameHelper.js`'s `findFrame(page, checkFn)` to locate the
   right frame by its *content* (e.g. "does this frame contain a textbox
   named 'Description:'"), not by name.
3. **Toolbar icons are often plain `<img>` tags with an `onclick` handler**,
   not semantic `<button>`s — no visible text, sometimes only a `title`
   tooltip. `fuzzyMatch.js` already checks `title`/`alt` for this reason —
   don't remove that.
4. **Standard Playwright `.click()` can fail** on some of these DevExpress
   elements even when the selector is correct, due to actionability checks
   (visibility/pointer-events). If a confirmed-correct selector still won't
   click, fall back to invoking the element's `onclick` directly via
   `page.evaluate()`.
5. Field labels in the app don't always match what you'd guess from the
   PBI — e.g. what you'd assume is "Item Name" is actually labeled
   "Description" in the real form. Confirm labels against the real UI,
   don't assume from the PBI wording alone.

## Workflow: generating tests for a screen that has NO confirmed selectors yet

This is the common case for a new module (AR, AP, etc.) or a new screen.

1. **Read the PBI** (or ask the QA for the PBI number/description) and
   design test cases first, using our standard categories: `Happy Path`,
   `Negative`, `UI`, `Edge Case`, `Security`, `Integration`, `Formula`.
   Flag ambiguities as open questions instead of guessing at business
   rules.
2. **Don't guess selectors from scratch.** Ask the QA to record the flow:
   ```
   record.bat
   ```
   (or `npx playwright codegen <url>` directly). They perform the flow by
   hand once; you get real, confirmed selectors back, including correct
   iframe detection that manual DevTools inspection often misses.
3. **Fold the recorded selectors into a page object** using the `heal()`
   pattern above — don't just paste the raw recorded script as the final
   test. The recording is a source of truth for *what the real selectors
   are*, not the final architecture.
4. **Mark anything the recording didn't cover** as `// TODO(<name>):
   unconfirmed guess` in the code, and wrap it so a missing selector
   doesn't crash the whole test (see `modules/inventory/pages/createItemPage.js`
   for the pattern — optional fields use `.catch(() => {})` / null-checks).
5. **Write the spec file** in `modules/<module>/tests/`, tagged with
   category prefixes in the test titles.
6. **Run it.** If something fails, check `test-results/` (screenshot,
   video, trace) and the module's knowledge-base file before guessing again.

## Workflow: adding to a module that already has confirmed selectors

Just follow the existing page object's pattern in that module. Reuse
`loginHelper.js` for auth — don't reimplement login per module.

## Reference implementation

`modules/inventory/pages/createItemPage.js` and
`modules/inventory/tests/create-item.spec.js` are the canonical example —
when in doubt, match their structure.

## Migrating old Katalon scripts

If asked to migrate an existing Katalon project into this repo: Katalon's
Object Repository often has human-readable element descriptions even after
its selectors have gone stale post-deployment. Use those descriptions as
the `label` field for `heal()` calls (they're exactly what fuzzy fallback
matches against), use any still-valid selectors as confirmed `strategies`
entries, and re-confirm anything that no longer resolves via codegen
recording rather than guessing.
