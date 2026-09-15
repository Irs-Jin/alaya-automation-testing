# Test Report Email Pipeline — instructions for AI agents

This file is for an AI agent (Claude or otherwise) helping a QA teammate run
their local test suite with the "email a report to the QA team when done"
pipeline. If a user asks you to "run my test bat file", "run tests and email
the report", or points you at this repo to set this up, read this file
first.

## The pattern: everyone has their OWN bat/ps1 pair

Each QA has a personal runner, named after themselves:

```
run-<name>-selected-tests.bat
run-<name>-selected-tests.ps1
```

e.g. `run-jin-selected-tests.bat` / `run-jin-selected-tests.ps1`. These are
**not interchangeable between people** — each one runs that person's own
selected subset of tests. There is no single shared "the" runner.

`run-example-selected-tests.bat` / `.ps1` in the repo root is a **template**
— Jin's original runner, kept only as a copyable example (see "Setting up
your own copy" below). Don't run it expecting it to be yours; copy it first.

**If a user asks you to run "the" test bat file, do NOT guess which one.**
List the `run-*-selected-tests.bat` files present in the repo root and ask
the user which one is theirs. If none exist yet for them, offer to create
one — see "Setting up your own copy" below.

## What the pipeline actually does (so you can explain it to the user)

1. Runs the selected Playwright spec files.
2. Opens the HTML report.
3. If any test is still failing after Playwright's own automatic retry, pops
   up a Yes/No dialog asking whether to rerun just those failing tests
   before building the final report.
4. Builds a report (Module/Action breakdown, pass/fail/flaky/skipped counts,
   time used) and pops up a Yes/No dialog asking whether to email it to the
   QA team.
5. If Yes, pops up a small form asking for **the person currently running
   it**'s own email + password, plus which outgoing (SMTP) server to send
   through - a dropdown offers the company mail server, Gmail, Yahoo Mail,
   and Outlook/Hotmail as presets (auto-filling server/port/security mode),
   or "Custom / other" to type any provider's settings by hand. Useful if
   the office IP ever gets blocked by the company mail server - switch to a
   personal account instead without editing the script. There's a
   "Remember these settings on this PC" checkbox to save all of it
   (including the password) for next time.
6. Sends the report by SMTP using those settings.

## Credentials — what to tell the user, and what NOT to do

- The email popup asks for **the runner's own** webmail login (e.g.
  `firstname@irs.com.my`), not any shared account. Each person enters their
  own.
- If "Remember password on this PC" is checked, the password is encrypted
  with Windows DPAPI (`CurrentUser` scope) into a local file named after the
  script itself, `.send-report-credential.<scriptname>.dat`, next to it —
  each person's copy gets its own cache file, so they don't collide in a
  shared checkout. That encryption key is tied to that specific Windows
  login on that specific machine — the file is useless if copied elsewhere.
  It's listed in `.gitignore` (as a wildcard, `.send-report-credential*.dat`)
  and must never be committed.
- **You (the AI) must never ask the user to paste their password into chat,
  and must never write a password into any file yourself.** The popup is a
  real Windows GUI dialog — tell the user to expect it and fill it in
  themselves. If Chrome/PowerShell windows or this popup don't appear on
  screen, that usually means the script got launched in a non-interactive
  session (see the troubleshooting note at the bottom).
- The QA-team recipient list (`$recipients` in the `.ps1`) is shared
  infrastructure config, not a secret — safe to keep as-is in a personal
  copy unless the user says otherwise.

## Setting up your own copy

1. Copy the template pair as a starting point:
   ```
   copy run-example-selected-tests.ps1 run-<yourname>-selected-tests.ps1
   copy run-example-selected-tests.bat run-<yourname>-selected-tests.bat
   ```
2. In the new `.ps1`, edit the `npx playwright test ...` line (and the
   `$smokeSpecFiles` list, if you want your own quick smoke-test slice) to
   point at whichever spec files/folders are *your* selected set — same idea
   as the comment block at the top of `run-example-selected-tests.bat`
   documenting Jin's own selection. Report/email text, and the
   credential-cache/log/JSON-scratch filenames, all derive automatically
   from the script's own filename — no need to hand-edit those.
3. Leave `$recipients` pointing at the shared QA team list unless told
   otherwise.
4. In the new `.bat`, update the `-File "%~dp0..."` path to point at your
   new `.ps1` filename.
5. Before your first real run, consider doing a quick pass with `-Smoke`
   (a small slice of test cases) to confirm the report/email/rerun flow
   works end to end before trusting a full run — see the `-Smoke` switch
   documented at the top of `run-example-selected-tests.ps1`.

## Troubleshooting: "I don't see any popup"

If the script appears to run (or even reports success) but no window or
popup was ever visible on screen, it was almost certainly launched in a
detached/non-interactive process (e.g. `Start-Process` from a script or a
background shell) that has no access to the real desktop. GUI calls from
such a process can hang indefinitely without ever showing anything, or
silently succeed using a cached/remembered credential without the user ever
seeing a dialog. Relaunch it as a normal foreground process from a real,
interactive terminal window instead (double-click the `.bat`, or run it from
a terminal the user is actually looking at).
