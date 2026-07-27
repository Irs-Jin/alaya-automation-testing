const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { GeneralLedgerReportPage } = require('../../../framework/pages/generalLedgerReportPage');

/**
 * Needs the Date switched to the previous month first (goToPreviousMonth()
 * — confirmed via a follow-up codegen recording, 2026-07-26, after an
 * earlier manual-description-only guess was wrong; see its comment in
 * generalLedgerReportPage.js), then View Grid, then "Preview Report".
 *
 * CORRECTED (Jin, 2026-07-26): this does NOT skip the Reports Format
 * dialog — an earlier guess based on incomplete manual screenshots assumed
 * it did, but Jin's actual run showed the dialog appearing (with a single
 * option literally named "Bank book analysis", lowercase b/a), stuck open
 * because `previewReport()` was called with no argument and defaulted to
 * hunting for "General Ledger" instead — a name that doesn't exist in
 * this dialog, so nothing ever got clicked. Same #sub13 category, same
 * Grid/Form-with-dialog shape as every other report here — just pass the
 * right template name, same as any of them.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > General Ledger > Bank Book Analysis', () => {
  test.describe.configure({ retries: 0 });

  test('[Happy Path] views, previews, and prints the Bank Book Analysis report', async ({ page }) => {
    test.setTimeout(90000);
    const reportPage = new GeneralLedgerReportPage(page);
    await reportPage.goto('Bank Book Analysis');

    await reportPage.goToPreviousMonth();
    await reportPage.viewGrid();
    await reportPage.previewReport('Bank book analysis');

    const reportTab = await reportPage.printReport();
    expect(reportPage.isReportPageValid(reportTab)).toBe(true);

    await reportTab.screenshot({ path: 'test-results/bank-book-analysis-report-print.png', fullPage: true }).catch(() => {});
    await reportTab.close().catch(() => {});
  });

});
