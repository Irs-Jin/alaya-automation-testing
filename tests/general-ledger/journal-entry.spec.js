const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { JournalEntryPage } = require('../../framework/pages/journalEntryPage');

/**
 * Converted from Katalon's JEN/JED/JEP/JEPN test cases
 * (Test Cases/Regression Test/General Ledger/Journal Entry). See
 * journalEntryPage.js for the confirmed-vs-carried-over breakdown.
 *
 * CONFIRMED via live run (2026-07-26), including a real bug fix: DR and CR
 * are genuinely separate fields, not one generic "amount" — Post's real
 * failure was "Dr & Cr Amount must be greater than 0" because neither
 * side was ever actually filled under the old generic-amount design. Two
 * lines now correctly split DR then CR (matching Katalon's own JEP/JEPN
 * data and Jin's reference screenshot of a correctly-posted entry).
 *
 * Test data below is Katalon's own ("410-0000" / 1500) — override via env
 * vars if this client's chart of accounts differs:
 *
 *   ALAYA_TEST_ACCOUNT_CODE=<code> ALAYA_TEST_AMOUNT=<amount> npm test
 */
const ACCOUNT_CODE = process.env.ALAYA_TEST_ACCOUNT_CODE || '410-0000';
const AMOUNT = process.env.ALAYA_TEST_AMOUNT || '1500';
const DESCRIPTION = process.env.ALAYA_TEST_JE_DESCRIPTION || 'Accruals Audit Fee';

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('General Ledger > Journal Entry > New', () => {

  test('[Happy Path] fills a journal entry header and one line', async ({ page }) => {
    test.setTimeout(90000);
    const jePage = new JournalEntryPage(page);
    await jePage.goto();

    // Single-line smoke test — matches Katalon's JEN, which only ever
    // filled the CR field (DXEditor12), not a balanced two-sided entry.
    await jePage.createJournalEntry({
      description: DESCRIPTION,
      accountCode: ACCOUNT_CODE,
      cr: AMOUNT,
    });

    const errors = await jePage.getValidationErrors();
    expect(errors.join(' ')).not.toMatch(/required|invalid|error/i);

    await jePage.clickNew();
    await jePage.clickBack();
  });

  test('[Save Draft] fills a journal entry and saves it as draft', async ({ page }) => {
    test.setTimeout(90000);
    const jePage = new JournalEntryPage(page);
    await jePage.goto();

    await jePage.createJournalEntry({
      description: DESCRIPTION,
      accountCode: ACCOUNT_CODE,
      cr: AMOUNT,
    });

    await jePage.clickSaveDraft();
    await jePage.clickBack();
  });

  test('[Post] posts a journal entry with two lines and reaches the Journal Voucher report', async ({ page }) => {
    test.setTimeout(90000);
    const jePage = new JournalEntryPage(page);
    await jePage.goto();

    // A real balanced double-entry line: DR one account, CR another —
    // matches Katalon's JEP data exactly (410-0000 DR / 200-3005 CR).
    await jePage.createJournalEntry({
      description: 'Audit Fee',
      lines: [
        { accountCode: ACCOUNT_CODE, dr: AMOUNT },
        { accountCode: process.env.ALAYA_TEST_ACCOUNT_CODE_2 || '200-3005', cr: AMOUNT },
      ],
    });

    // Catches the "Dr & Cr Amount must be greater than 0" failure mode
    // before it silently blocks Post (this is exactly what slipped through
    // undetected in [Post & New] before this check existed).
    const preErrors = await jePage.getValidationErrors();
    expect(preErrors.join(' ')).not.toMatch(/greater than 0|required|invalid/i);

    await jePage.clickPost();

    const postErrors = await jePage.getValidationErrors();
    expect(postErrors.join(' ')).not.toMatch(/greater than 0|not saved/i);

    const reportResult = await jePage.printReport();
    expect(jePage.isReportPageValid(reportResult)).toBe(true);
    // printReport() returns a Playwright Download in the common case (a
    // real page navigation is the exception) - handle both.
    if (typeof reportResult.suggestedFilename === 'function') {
      await reportResult.saveAs('test-results/journal-entry-post-report.pdf').catch(() => {});
    } else {
      await reportResult.screenshot({ path: 'test-results/journal-entry-post-report.png', fullPage: true }).catch(() => {});
      await reportResult.close().catch(() => {});
    }
  });

  test('[Post & New] posts a journal entry with two lines then resets for the next entry', async ({ page }) => {
    test.setTimeout(90000);
    const jePage = new JournalEntryPage(page);
    await jePage.goto();

    // Matches Katalon's JEPN data (410-0000 DR / 200-4005 CR) and Jin's
    // reference screenshot of a correctly-posted JE-00001188.
    await jePage.createJournalEntry({
      description: 'Audit Fee',
      lines: [
        { accountCode: ACCOUNT_CODE, dr: AMOUNT },
        { accountCode: process.env.ALAYA_TEST_ACCOUNT_CODE_3 || '200-4005', cr: AMOUNT },
      ],
    });

    await jePage.clickPostAndNew();

    // This test previously had NO assertion here at all — it silently
    // "passed" even while hitting the exact same "Dr & Cr Amount must be
    // greater than 0" failure the [Post] test surfaced. Never leave a
    // Post-family test with no success/failure check again.
    const errors = await jePage.getValidationErrors();
    expect(errors.join(' ')).not.toMatch(/greater than 0|not saved/i);

    await jePage.clickBack();
  });
});
