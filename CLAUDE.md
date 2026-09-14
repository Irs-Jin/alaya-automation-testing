# Instructions for AI agents working in this repo

This is a shared Playwright test suite for the ALAYA ERP (DevExpress
ASPxWebForms). Multiple QAs use AI agents (including you) to add test cases
to it. Follow this file exactly — it is the distilled result of many real,
sometimes costly, debugging sessions. Don't rediscover these the hard way.

Full rationale for everything below lives in **CONTRIBUTING.md** — read it
before your first test case in a session if you have any doubt about a
convention here. This file is the actionable checklist version.

If the user asks you to run their tests with the "email a report to the QA
team when done" pipeline (a `run-<name>-selected-tests.bat` /
`run-<name>-selected-tests.ps1` pair), read **[EMAIL-REPORT-GUIDE.md](EMAIL-REPORT-GUIDE.md)**
first — each person has their own, and there are credential-handling rules
you must follow.

## Before writing anything

Ask what ground truth is available, in this order of preference, and use
whichever exists:
1. A Katalon Object Repository entry for the same screen (real, confirmed
   selectors — check `Object Repository/**/*.rs` in any Katalon project the
   user points you to, even if the object's auto-generated name looks
   wrong/misleading; the selector inside it is what matters).
2. A Playwright codegen recording the user pastes or records
   (`npm run record`).
3. A screenshot (selectors from this are unconfirmed guesses — say so).

If a codegen recording ends with an action that looks disconnected from the
rest of the flow (e.g. a bare `page.locator('a').first().click()` with no
clear purpose), that's very likely a recorder artifact from the user
clicking around after finishing — leave it out and say you did, rather than
replicating it blindly.

## File layout — always this shape, no exceptions

```
tests/<module>/<name>.spec.js
framework/pages/<name>Page.js
runners/<module>/run-<name>.bat
```

Copy the nearest existing file in the same category as your starting point.
Don't invent a new shape.

## Page object rules

- Constructor takes `page`, stores a `frame` reference initialized to
  `null`.
- Resolve the iframe via `findFrame(page, checkFn)` — **never** hardcode an
  iframe name. Every DevExpress screen in this app puts its content in an
  iframe with a dynamic or literally-`"undefined"` name. This is confirmed
  true for every module built so far, with zero exceptions.
- Use `heal()` (`framework/selfHealingLocator.js`) for buttons/fields that
  might drift. Use a plain, specific `page.locator(cssId)` only for an id
  you've confirmed is stable (toolbar button, fixed grid-header control).
- **Never pass a RegExp inside a `heal()` strategy's `options`.** The
  knowledge base is plain JSON; `JSON.stringify(/regex/)` produces `{}` and
  permanently corrupts that strategy on the very first save (the merge
  logic can't tell the corrupted entry apart from a correct one by key
  alone, so it never self-heals). If you need a regex-based accessible-name
  match, call `frame.getByRole(role, { name: /regex/ })` directly, bypassing
  `heal()` for that one lookup.
- Never hardcode a per-row action-button id (e.g. something ending in
  `_DXCBtn60Img`) — it reflects that row's position at recording time, not
  a stable identity. Select by role + accessible name instead
  (`getByRole('link', { name: 'Edit', exact: true })`), scoped to a row
  you've already verified matches your target.

## Interacting with fields — read before writing any `.fill()` call

- If a field just needs a value present when the form submits (most text
  inputs), `.fill()` is fine.
- If a field's value needs to actually register with the app's own JS
  (triggers a live filter, a postback, a client-side validation state) —
  confirmed necessary for: search/filter boxes, the login form's User ID
  field — use real keystrokes instead:
  ```js
  await field.click();
  await field.pressSequentially(value, { delay: 30 });
  ```
  `.fill()` sets the DOM value directly and has been confirmed, more than
  once, to silently fail to register with DevExpress's `ASPxClientEdit`
  wrapper — the field looks filled in a screenshot taken right after, but
  the value doesn't stick or the framework never "sees" it.
- To clear a field before retyping, use a real triple-click
  (`field.click({ clickCount: 3 })`), never `.fill('')`.
- Don't use `.press('Enter')` to force a postback on a field that hasn't
  been confirmed to need it — on at least one screen this had the
  unintended side effect of submitting the surrounding form and navigating
  to whatever the browser's default action was, instead of just filtering.

## Timeouts — set these explicitly, every time

- `test.setTimeout(90000)` at minimum for anything that posts, saves, or
  waits on a generated report. Never rely on the global 30s default — it is
  measurably too tight once a test runs deep into the full ~90-test suite,
  against a server under sustained load, even though the exact same test
  passes fine standalone. This is a confirmed, repeated failure mode in this
  repo, not a hypothetical.
- If a specific action waits on something async (a report's print button
  appearing, a popup rendering), give that specific `findFrame()`/`waitFor()`
  call its own generous timeout too (e.g. `{ timeout: 30000 }`) — the
  surrounding test-level timeout doesn't rescue a tighter per-action cap.
- Do not add `test.describe.configure({ retries: 0 })`. The suite-wide
  `retries: 1` default exists specifically to absorb the slow-render-under-
  load failure mode above without masking a genuinely broken selector (which
  would fail identically on the retry too, under the same load — a real bug
  survives a retry; a load-related timeout doesn't).

## Safety — non-negotiable

This repo has a real incident history: a loosely-scoped delete-confirmation
helper once deleted an unrelated real row, because it searched for a "Yes"
button by role/text across the whole page instead of one specific,
already-verified frame, and a retried click landed on a second dialog.

- Scope every delete-confirm / save-confirm dialog interaction to the exact
  frame you're already working in. Never fall back to a page-wide
  `getByRole`/`getByText` "Yes" search.
- After clicking a confirm "Yes", wait for that element to become hidden
  (`.waitFor({ state: 'hidden' })`) as proof the click registered exactly
  once — not a fixed `waitForTimeout`.
- Before any Edit/Delete action on a searched/filtered grid, verify a
  genuine matching data row is actually visible first (not just that the
  search box holds the typed text, and not just "count > 0" against a
  locator that might also match the search box's own wrapper cell — require
  the match come from a row that also carries the row's own action links).
  Throw loudly if it never appears; do not proceed on an assumption.
- Never click "Select All" on a multi-row picker (warehouse, item, etc.) —
  confirmed to hang some reports for minutes or indefinitely. Select one row
  unless a human explicitly asks for more.
- If a recorded/requested action is destructive (delete, post, modify real
  data) and you're not fully certain it's intended exactly as given, ask.
  Don't pick the "probably fine" interpretation on your own.
- If you observe unexplained behavior during a live run (a dialog you didn't
  trigger, a field that silently didn't take a value), **investigate with a
  read-only repro before touching anything destructive again** — don't
  guess-and-check with real delete/save actions in a live ERP system. Prefer
  isolating the variable (e.g. search for a nonexistent term) over repeating
  the exact failing action hoping it resolves itself.

## Before calling a test case done

1. `node -c` the new page object and spec.
2. `npx playwright test --list` — confirm it's discovered.
3. Run it live, headed, standalone. If it fails, read the actual failure
   screenshot in `test-results/.../test-failed-1.png` before changing
   anything — every wrong-selector fix in this repo's history came from
   reading a real screenshot, never from re-guessing blind.
4. If the test creates data, confirm it deletes it again — search for the
   record by name after the run and verify it's gone, independent of
   whether the test's own assertions passed (a "Deleted Successfully"
   banner appearing is not, by itself, proof the row is actually gone —
   verify with a fresh search in a clean session).
5. Use an obviously-fake, greppable test-data name (`TESTING001`, not a
   realistic-looking name).

## Never do this without explicit user confirmation first

- `git push`, especially to a shared branch.
- Deleting or modifying a record you didn't create yourself in this session
  (e.g. anything that looks like real customer/business data, not a
  `TESTING*`-named row you just made).
- Widening a delete-confirmation selector's scope back to page-wide/generic
  after it was deliberately narrowed — that narrowing is there because of a
  real incident, not by accident.
