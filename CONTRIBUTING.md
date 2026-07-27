# Contributing a new test case

This repo is shared — multiple QAs (and AI agents on their behalf) add test
cases to it. These conventions exist so it stays navigable and safe as it
grows, not because they're pretty. Follow them even when it feels like
overhead for a "simple" test.

If you're using Claude Code (or another AI agent) to generate the test,
point it at **[CLAUDE.md](CLAUDE.md)** — it encodes this same ruleset as
direct instructions the agent follows automatically.

## 1. Where files go

One screen/flow = one spec file = one page object = one runner. Mirror the
same relative path in all three:

```
tests/<module>/<name>.spec.js
framework/pages/<name>Page.js
runners/<module>/run-<name>.bat
```

`<module>` is the ALAYA nav category in kebab-case (`general-ledger`,
`account-receivable`, `pos`, `sales`, `reports/<sub-category>`, ...). Reports
get their own `reports/<category>/` subfolder in both `tests/` and `runners/`
— don't mix a report into a module's transactional folder or vice versa.

Never dump a new page object's helper logic into an existing unrelated page
object. If two screens genuinely share behavior, factor it into
`framework/` as its own module (like `frameHelper.js` / `fuzzyMatch.js`),
not by importing one page object from another.

## 2. Page object shape

Every page object in this repo follows the same shape — copy the nearest
existing one in the same category as your starting point, don't start from
scratch:

```js
const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

class XyzPage {
  constructor(page) {
    this.page = page;
    this.frame = null; // resolved by goto(), re-resolved after any navigation
  }

  async goto() { /* nav clicks, then resolve the frame */ }
  async _resolveFrame() { /* findFrame() by CONTENT check, never by name */ }
  // one method per user action, one flow method that composes them
}

module.exports = { XyzPage };
```

**Never hardcode an iframe name.** DevExpress renders every screen's content
inside an iframe whose `name` attribute is dynamic (a session-specific
number) or literally the string `"undefined"` — confirmed across every
single module in this repo so far, no exceptions. Always resolve frames via
`findFrame(page, checkFn)`, matching on some element that's only present on
the target screen.

**Use `heal()` for anything that might drift** (buttons, labeled fields) —
it tries your listed strategies in order of past success, falls back to
fuzzy text matching, and remembers what worked. Plain `page.locator(...)` is
fine for something you've confirmed is a stable, unique CSS id (e.g. a
toolbar button's id, confirmed via a live DOM dump or a Katalon Object
Repository entry) — heal() adds no value once you already know the one
correct selector.

## 3. Test spec shape

```js
const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { XyzPage } = require('../../framework/pages/xyzPage');

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('<Nav Category> > <Screen>', () => {
  test('[Happy Path] <what it does>', async ({ page }) => {
    test.setTimeout(90000); // see "Timeouts" below — don't skip this
    // ...
  });
});
```

Tag every test title with a category prefix: `[Happy Path]`, `[Negative]`,
`[Save Draft]`, `[Post]`, `[Post & New]`, etc. — whatever matches what the
test actually verifies. This is how the HTML report stays scannable once
there are 100+ tests in it.

Do **not** add `test.describe.configure({ retries: 0 })`. The suite-wide
default (`retries: 1` in `playwright.config.js`) exists specifically so a
transient slow-render under full-suite load doesn't read as a hard failure
— see "Timeouts" below for why this matters more than it sounds.

## 4. Timeouts

**Always set `test.setTimeout(...)` explicitly** — never rely on the global
30s default. A test that's plenty fast standalone can time out when it runs
as test #80 of 95 in the full suite, an hour into a run, against a server
that's slower under sustained load. This has caused real, confirmed failures
in this repo (Cash Sales, several report tests) — always budget generously:

- Simple settings/CRUD screens: `test.setTimeout(90000)`
- Anything that waits on an async-generated report: `test.setTimeout(90000)`
  and widen the specific `findFrame()`/`waitFor()` call waiting on the
  report's print button to `{ timeout: 30000 }` too (the test-level timeout
  alone doesn't help if a single action inside it has its own tighter cap).

## 5. Building a new test case, step by step

1. **Get ground truth first.** In order of preference:
   - A **Katalon Object Repository entry** for the same screen (check
     `Object Repository/**/*.rs` in the Katalon project if one exists) — its
     CSS/XPath selectors are real, confirmed selectors, even if the object's
     auto-generated *name* is misleading.
   - A **Playwright codegen recording** (`npm run record`, or ask the person
     requesting the test to record one and paste the output) — most
     reliable for confirming the exact click sequence and frame structure.
   - A **screenshot** of the screen — enough to guess field labels and
     layout, but selectors from a screenshot alone are unconfirmed; mark
     them as such in a comment.
2. Build the page object, following the shape in section 2.
3. Build the spec, following the shape in section 3.
4. Build the runner `.bat`, copying the nearest existing one in
   `runners/<module>/` and just changing the path/env vars.
5. `node -c` both new `.js` files, then `npx playwright test --list` to
   confirm the suite discovers your new test.
6. **Run it live, headed, standalone**, and actually look at what happens —
   don't just check the exit code. If it fails, read the real failure
   screenshot (`test-results/.../test-failed-1.png`) before changing
   anything; every wrong-selector guess in this repo's history got fixed
   this way, never by re-guessing blind.
7. If your test creates data, make sure it deletes it again by the end —
   see "Test data hygiene" below.
8. Once it's green standalone, that's normally enough for a PR — you don't
   need to run the entire ~90-test suite yourself for every change, but do
   mention in the PR which module you touched so reviewers know what to
   spot-check.

## 6. Test data hygiene

If your test creates a real record (a Customer, a Promotion, a Journal
Entry...), it must delete it again before the test ends, using the same
search-then-act pattern as `customerPage.js`/`promotionPage.js`: search for
the record you just created, wait for the grid to genuinely show it (not
just assume it's there), then act on it. Never assume "the first/only row in
the grid" — leftover data from a previous failed run, or from someone else's
test running earlier in the same suite, can and has caused a test to act on
the wrong row.

Use an obviously-fake, greppable name for anything you create (`TESTING001`,
not `Test Customer` or a real-sounding name) — makes it easy for anyone to
spot and clean up a leftover later.

## 7. Safety rules (read this one properly)

This repo has a **real incident history**: an early, looser version of a
delete-confirmation helper once deleted an unrelated real row because it
matched a delete-confirm dialog by role/text across the whole page instead
of a specific scoped element, and a retried click landed on a second dialog
it never should have touched.

- **Always scope delete-confirm and save-confirm dialogs to the specific
  frame you're already working in** — never fall back to a page-wide
  `getByRole`/`getByText` search for a "Yes" button. If the specific
  selector doesn't match, that should be a loud failure, not a silent
  broadened search.
- **Wait for the confirm dialog to actually disappear** after clicking Yes
  (`.waitFor({ state: 'hidden' })`), not just a fixed `waitForTimeout` — that
  hidden-state wait is your proof the click registered exactly once.
- **Never click "Select All" on a multi-row picker** (warehouse/item
  selection, etc.) — on this app, selecting everything has caused reports to
  hang for multiple minutes or indefinitely. Select one row unless a human
  explicitly asks for more.
- If you're not sure whether an action is destructive, or whether a
  recorded codegen action was intentional (recordings sometimes capture a
  stray extra click), **ask the person who requested the test** rather than
  guessing. Never assume a "probably fine" default when the action deletes,
  posts, or modifies data.

## 8. Known DevExpress/ASPx gotchas

These have each cost real debugging time — check here before re-discovering
them:

- **`.fill()` is not always reliable** on DevExpress `ASPxClientEdit`-backed
  inputs — it sets the DOM value directly, bypassing the framework's own
  internal focus/blur/change tracking. Confirmed to intermittently fail
  (silently, no error) on both a live-filter search box and the login
  form's User ID field. If a field needs its value to actually register
  with the app (triggers a postback, feeds a live filter), use real
  keystrokes: `.click()` then `.pressSequentially(value, { delay: 30-60 })`.
  Reserve plain `.fill()` for fields you've confirmed don't need this.
- **Clearing a field before retyping**: use a real triple-click
  (`.click({ clickCount: 3 })`) to select-all, not `.fill('')` — the latter
  is the same JS-direct-value problem as above and has been linked to
  unexplained UI glitches on at least one screen.
- **`heal()`'s knowledge base is plain JSON** — a `RegExp` passed as a
  strategy's `options.name` silently serializes to `{}` the first time it's
  saved, permanently corrupting that strategy for every future run (the
  merge logic keys by `type::role` only, so the corrupted entry can never
  be replaced by the correct in-memory one). Only pass JSON-safe values
  (strings) into a `heal()` strategy's `options`. If you need a regex match,
  do it directly (`frame.getByRole('img', { name: /.../ })`) without
  `heal()`.
- **Per-row action button ids are not stable** — a grid row's Edit/Delete
  icon id (e.g. `..._DXCBtn60Img`) reflects that row's position in whatever
  was rendered at recording time, not a fixed identity. Never hardcode one
  from a recording; select by role/accessible-name (`getByRole('link',
  {name:'Edit', exact:true})`) scoped to a row you've already verified
  matches your target, instead.
- **A save/toolbar button's container id from a recording isn't always the
  real one** — cross-check against a live DOM dump (`error-context.md` from
  a failed run's accessibility snapshot) if a recorded id doesn't match
  what you see on screen; titles like `"Save [Alt + S]"` tend to be more
  stable than a specific toolbar-item container id.

## 9. Git workflow

- One branch per feature/module (`add-ar-customer-crud`, not one giant
  branch for everything you touch in a week).
- Keep PRs scoped to one module/spec at a time where reasonable — makes
  review and rollback easier.
- **Never commit `.env`** — it's git-ignored; if you need a new env var,
  add it (with a placeholder value) to `.env.example` instead.
- **Do commit `framework/knowledge-base.json`** changes — it's meant to
  accumulate confirmed-good strategies over time. If a diff there looks like
  it's *replacing* a previously-working entry with something new for no
  reason you understand, ask before merging — that's usually a sign
  something regressed rather than improved.
- If two people are actively adding tests to the same module folder at the
  same time, coordinate in chat first — small collisions here (e.g. both
  touching the same `<name>Page.js`) are easy to avoid and annoying to
  merge-conflict-resolve otherwise.
