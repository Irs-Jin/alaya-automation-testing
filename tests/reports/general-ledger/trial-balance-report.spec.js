const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { GeneralLedgerReportPage } = require('../../../framework/pages/generalLedgerReportPage');

/**
 * Converted directly from a Playwright codegen recording Jin made himself
 * against the live UAT instance (Reports > General Ledger > Trial Balance).
 * Same category/nav path as General Ledger / Journal Of Transaction
 * (#sub13), but a DIFFERENT archetype: Trial Balance lands directly on a
 * parameter form (Date / Trial Balance Type / Report Format / Export To)
 * with NO "View Grid" step at all. `GeneralLedgerReportPage.viewGrid()`
 * self-skips when that button is absent, so the exact same call sequence
 * as the other two reports still applies here — see that page object's
 * header comment for the full two-archetype writeup.
 *
 * The "confirm a value" step after Preview Report uses "This Year" (the
 * Report Format already selected on the form) rather than a report name —
 * functionally the same step as the grid archetype's template pick,
 * just a different field semantically. Same `previewReport(value)` method.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > General Ledger > Trial Balance', () => {
  // Same rationale as the sibling report specs: reaching the print-preview
  // tab with real content IS success; report generation is slow, not
  // flaky, so retrying just doubles the wait for no benefit.

  test('[Happy Path] views, previews, and prints the Trial Balance report', async ({ page }) => {
    test.setTimeout(90000);
    const tbReportPage = new GeneralLedgerReportPage(page);
    await tbReportPage.goto('Trial Balance');

    await tbReportPage.viewGrid(); // no-ops here — Trial Balance has no View Grid step
    await tbReportPage.previewReport('This Year');

    const reportTab = await tbReportPage.printReport();
    expect(tbReportPage.isReportPageValid(reportTab)).toBe(true);

    await reportTab.screenshot({ path: 'test-results/trial-balance-report-print.png', fullPage: true }).catch(() => {});
    await reportTab.close().catch(() => {});
  });

});
