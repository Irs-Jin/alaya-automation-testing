const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { GeneralLedgerReportPage } = require('../../../framework/pages/generalLedgerReportPage');

/**
 * Converted from Jin's manual walkthrough (2026-07-26), not a codegen
 * recording — same Form archetype as Trial Balance (no View Grid, straight
 * to a parameter form + "Preview Report" button), same #sub13 category.
 * See generalLedgerReportPage.js for the shared structure writeup.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > General Ledger > Profit And Loss Statement', () => {
  test.describe.configure({ retries: 0 });

  test('[Happy Path] views, previews, and prints the Profit And Loss Statement report', async ({ page }) => {
    test.setTimeout(90000);
    const reportPage = new GeneralLedgerReportPage(page);
    await reportPage.goto('Profit And Loss Statement');

    await reportPage.viewGrid(); // no-ops here — no View Grid step for this report
    await reportPage.previewReport('This Year');

    const reportTab = await reportPage.printReport();
    expect(reportPage.isReportPageValid(reportTab)).toBe(true);

    await reportTab.screenshot({ path: 'test-results/profit-and-loss-statement-report-print.png', fullPage: true }).catch(() => {});
    await reportTab.close().catch(() => {});
  });

});
