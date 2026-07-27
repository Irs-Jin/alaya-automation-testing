# Onboarding: ALAYA Automation Testing

Welcome! This guide gets you from "just joined" to "ran a real test against
ALAYA and understood the result" in one sitting. It intentionally doesn't try
to explain everything — just enough to get moving. Deeper references are
linked at the bottom.

## What this actually is

A Playwright test suite for ALAYA (the ERP app your team tests). Each test
drives a real browser against a real ALAYA environment (usually a UAT/SIT
instance, not production) and checks that a specific flow — creating a
customer, posting a cash sale, generating a report — actually works.

The one thing that makes this suite different from a typical Playwright
project: it uses a **self-healing locator system**. Instead of one hardcoded
selector per element, each important element has a ranked list of selector
strategies plus a fuzzy-text fallback, and the system remembers which
strategies have worked in the past (`framework/knowledge-base.json`). You
don't need to understand the internals to use the suite — just know that
file exists, gets smarter over time, and should be committed along with your
changes.

## Day 1 checklist

1. **Get access**: make sure you have credentials for the ALAYA test
   environment (Client ID / Username / Password) and can reach it in a
   normal browser first — confirm the app itself loads before troubleshooting
   the test suite.
2. **Clone and install**:
   ```bash
   git clone https://github.com/Irs-Jin/alaya-automation-testing.git
   cd alaya-automation-testing
   npm install
   npx playwright install --with-deps chromium
   ```
3. **Configure your environment**:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and fill in your real `ALAYA_BASE_URL`, `ALAYA_CLIENT_ID`,
   `ALAYA_USERNAME`, `ALAYA_PASSWORD`. This file is git-ignored — it's yours,
   never gets committed, never share it in chat/screenshots either.
4. **Run one test, headed, so you can watch it**:
   ```bash
   npx playwright test tests/pos/birthday-setting.spec.js --headed
   ```
   You should see a real Chrome window open, log in, navigate, and finish
   with `1 passed` in the terminal. If it fails here, it's almost certainly
   an environment/credentials issue, not the test itself — double check
   `.env` and that you can reach the URL in a normal browser.
5. **Look at the HTML report**:
   ```bash
   npm run report
   ```
   This is what you'll use daily once you're running larger batches.
6. **Try the double-click runners**: open the `runners/` folder, pick any
   `.bat` file, double-click it. Same thing as step 4, but pre-configured —
   this is what you'll hand to a non-technical teammate if they ever need to
   run one themselves.

## Running things day-to-day

```bash
npm test                              # entire suite, headless
npm run test:headed                   # entire suite, watch it happen
npx playwright test tests/sales       # just one module
npx playwright test -g "Cash Sales"   # just tests matching a name
```

`run-all-tests.bat` at the repo root runs literally everything (~90 tests) —
takes 45-90+ minutes, so kick it off and go do something else; it opens the
HTML report automatically when it's done.

## Reading a failure

Every failed test leaves a folder under `test-results/<test-name>/` with:
- `test-failed-1.png` — screenshot at the exact moment of failure. **Look at
  this first**, always, before assuming anything about the cause.
- `video.webm` — full recording of that test run.
- `trace.zip` — open with `npx playwright show-trace <path>` for a full
  step-by-step timeline (network, DOM, console, everything).
- `error-context.md` — the error message plus an accessibility-tree snapshot
  of the page at that moment. Genuinely useful for figuring out what a
  selector actually matched vs. what you expected.

One more thing worth knowing before you panic at a red result: failed tests
**auto-retry once**. If you see a test marked "flaky" in the report (failed,
then passed on retry), that's usually the ALAYA server being slow under
load, not a broken test — still worth a glance, but not an emergency.

## When you're ready to add your own test case

Read **[CONTRIBUTING.md](CONTRIBUTING.md)** — it covers file layout, the
page-object pattern every screen follows, timeout conventions, and (import-
ant) the safety rules around anything that deletes or modifies real data.

If you're going to use an AI agent (Claude Code or similar) to help write
the test, it should automatically pick up **[CLAUDE.md](CLAUDE.md)** in this
repo — that file encodes the same conventions as direct instructions for the
agent, distilled from real debugging incidents in this project. Don't let it
skip that file.

## Who to ask

If something in this guide is out of date, or you hit something not covered
here, that's worth flagging to whoever's maintaining the suite — this
document should stay accurate as the project grows, not become one more
stale README nobody trusts.
