# ALAYA Automation Testing

Shared Playwright + self-healing automation repo for the ALAYA QA team.
Anyone on the team can clone this, run existing tests locally, and commit
new ones back — this doc gets you from zero to running tests.

## What's in this repo

```
CLAUDE.md              <- read this before generating new test cases with AI
CONTRIBUTING.md         <- git workflow, conventions, PR checklist
framework/               <- shared engine, reused by every module (don't duplicate this per-module)
  selfHealingLocator.js  <- core self-healing locator engine
  fuzzyMatch.js          <- text similarity matching (no external dep)
  frameHelper.js         <- finds elements inside DevExpress iframes
  loginHelper.js         <- shared ALAYA login flow
  knowledge-base/         <- one JSON file PER MODULE (see "Why per-module" below)
modules/
  inventory/             <- reference implementation — read this first
    pages/                <- page objects (one file per screen)
    tests/                <- test specs (one file per screen/flow)
  ar/  ap/  sales-branch/  bi/  sysadmin/   <- same structure, empty until someone adds tests
recordings/              <- codegen output when recording new flows (gitignored)
record.bat               <- double-click to launch Playwright Codegen against ALAYA's login page
```

## First-time setup (new QA joining the team)

```bash
# 1. Clone
git clone <this-repo-url>
cd alaya-automation

# 2. Install dependencies
npm install
npx playwright install --with-deps chromium

# 3. Configure your environment
cp .env.example .env
# edit .env — set ALAYA_BASE_URL, ALAYA_CLIENT_ID, ALAYA_USERNAME, ALAYA_PASSWORD
# (ask a teammate for SIT test credentials if you don't have your own)

# 4. Run the existing tests
npm test              # headless, all modules
npm run test:ui       # interactive UI mode — best for your first run, lets you watch it step through
npm run test:headed   # watch it click through a real browser window
```

`.env` is your personal local config — it's gitignored and never committed.
Each person uses their own copy.

## Running tests for one module only

```bash
npx playwright test modules/inventory
```

## Understanding what you just ran

- Every test is a normal Playwright spec — readable top to bottom, no magic.
- Locators go through a **self-healing** layer (`framework/selfHealingLocator.js`):
  it tries known selectors in order of past success, and if all of them fail
  (e.g. after a deployment changes an element's id), it scans the page for a
  visually/semantically similar element and uses that instead — logging the
  discovery so next time it's no longer a fallback guess.
- Each module has its **own** knowledge base file
  (`framework/knowledge-base/<module>.json`). This is intentional — see below.

## Why knowledge-base is split per module

If everyone shared a single `knowledge-base.json`, every QA touching *any*
test would modify the *same* file, and you'd get git merge conflicts
constantly — even between people working on completely unrelated modules
(AR vs Stock Take, say). Splitting by module means your locator stats only
ever touch `framework/knowledge-base/<your-module>.json`, so two people
working on different modules never collide.

## Adding new test cases

Read **CONTRIBUTING.md** for the git workflow (branching, PRs), and
**CLAUDE.md** for how to generate new tests with AI following this repo's
conventions — including how to handle brand-new screens that don't have
confirmed selectors yet.

## If a test starts failing after a deployment

1. Check `test-results/` for the screenshot, video, and trace of the failure.
2. Check the module's `framework/knowledge-base/<module>.json` — it records
   every selector strategy that was tried and whether it succeeded or
   failed, so you're debugging from a log, not from scratch.
3. If the self-healing fallback also couldn't find the element (fully
   redesigned page, or an icon-only element with no accessible label), use
   `record.bat` to record the new flow and update the page object — see
   CLAUDE.md.
