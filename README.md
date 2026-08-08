# ALAYA Automation Testing

Self-healing Playwright test suite for the ALAYA ERP web app (DevExpress
ASPxWebForms). Covers General Ledger, Account Receivable, Inventory,
Purchase, Sales, POS, and the Reports catalog (~90 test cases and growing).

New here? Start with **[ONBOARDING.md](ONBOARDING.md)** — a guided walkthrough
for your first day. Adding a new test case? Read **[CONTRIBUTING.md](CONTRIBUTING.md)**
first — it exists so the suite doesn't turn into a mess as more people add to
it. Using Claude Code (or another AI agent) to generate a test case? It should
pick up **[CLAUDE.md](CLAUDE.md)** automatically — don't skip it manually.

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- [Git](https://git-scm.com/)
- Network access to your ALAYA instance (e.g. `sit.irsbizsuite.com.my`) and to
  `cdn.playwright.dev` (for downloading the browser binary)

## Setup

```bash
git clone https://github.com/Irs-Jin/alaya-automation-testing.git
cd alaya-automation-testing
npm install
npx playwright install --with-deps chromium

# Configure your environment
cp .env.example .env
# edit .env: set ALAYA_BASE_URL, ALAYA_CLIENT_ID, ALAYA_USERNAME, ALAYA_PASSWORD
```

`.env` is git-ignored — never commit real credentials. `.env.example` is the
tracked template; keep it in sync when new env vars are introduced.

## Running tests

```bash
npm test                              # entire suite, headless
npm run test:headed                   # entire suite, visible browser
npm run test:ui                       # Playwright's interactive UI mode
npm run report                        # view the HTML report from the last run

npx playwright test tests/sales       # just one folder/module
npx playwright test -g "Cash Sales"   # just tests matching a name
```

Every module also has its own double-click runner under `runners/<module>/run-*.bat`
(sets the right env vars for you), one per-module batch runner at the repo root,
and one master script that runs everything:

```
run-all-tests.bat                     ← runs the ENTIRE suite, one test at a time
                                         (--workers=1), then opens the HTML report.
                                         Takes ~2 hours against UAT — let it run in
                                         the background. Failures late in a long run
                                         may reflect UAT server load, not a real bug
                                         — see CONTRIBUTING.md.

run-account-receivable-tests.bat      ← Account Receivable (Customer + its Reports)
run-account-payable-tests.bat         ← Account Payable (Reports only, so far)
run-general-ledger-tests.bat          ← General Ledger (JE/CBP/CBR/SV/Bank Recon + its Reports)
run-pos-tests.bat                     ← POS (Birthday Setting + Promotion)
run-sales-tests.bat                   ← Sales (Cash Sales + its Reports)
run-inventory-tests.bat               ← Inventory (Reports only, so far)
run-purchase-tests.bat                ← Purchase (Reports only, so far)
run-staff-tests.bat                   ← Staff (Reports only, so far)
run-gst-tests.bat                     ← GST (Reports only, so far)
run-membership-voucher-tests.bat      ← Membership Voucher (Reports only, so far)
run-others-tests.bat                  ← Others (Reports only, so far)
```

Each module script scopes to just that module's transactional tests (if any) plus
its own Reports category, so you can re-check one area in a few minutes instead
of running the whole ~2h suite.

`--workers=1` is deliberate, everywhere in this repo: every test logs in as
the same shared ALAYA account, and this app's session handling has not been
confirmed safe under concurrent logins. Don't parallelize without confirming
that first.

## Reading results

- **Terminal / HTML report** (`npm run report`): pass/fail per test, with
  timing.
- **`test-results/<test-name>/`** (created automatically on failure): a
  screenshot, a video, a Playwright trace (`npx playwright show-trace
  <path>/trace.zip` for a full timeline), and `error-context.md` with an
  accessibility-tree snapshot of the page at the moment of failure.
- Failed tests **retry once automatically** (`retries: 1` in
  `playwright.config.js`). If a test fails then passes on retry, the run
  still reports overall success but flags it as "flaky" — worth a look, but
  not a blocker. If it fails twice, that's a real failure.

## Project structure

```
framework/
  selfHealingLocator.js   ← heal(): tries known selectors in confidence order, falls back to fuzzy match
  frameHelper.js          ← findFrame(): finds the right iframe by CONTENT, never by name (names are unstable)
  fuzzyMatch.js           ← Levenshtein-based text similarity used by the fuzzy fallback
  knowledge-base.json     ← persistent locator success/failure stats — DO commit this, it gets smarter over time
  loginHelper.js          ← shared login flow, used by every spec's beforeEach
  pages/<name>Page.js     ← one page object per screen/module

tests/<module>/<name>.spec.js     ← one spec file per screen/flow, grouped by module
runners/<module>/run-<name>.bat   ← one double-click runner per spec, mirrors tests/ layout
run-all-tests.bat                 ← runs everything

CONTRIBUTING.md   ← conventions for adding a new test case (read before your first PR)
ONBOARDING.md     ← new-QA walkthrough
CLAUDE.md         ← instructions for AI agents (Claude Code) generating tests in this repo
```

## Contributing

See **[CONTRIBUTING.md](CONTRIBUTING.md)**. Short version: one module per
branch, run your new test standalone *and* as part of the full suite before
opening a PR, and never loosen the delete-confirmation safety patterns
without a very good reason (see CONTRIBUTING.md's "Safety rules" — this repo
has a real incident history behind that rule).
