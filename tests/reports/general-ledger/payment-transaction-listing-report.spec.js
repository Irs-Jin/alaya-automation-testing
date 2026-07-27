const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { GeneralLedgerReportPage } = require('../../../framework/pages/generalLedgerReportPage');

/**
 * Converted from Jin's manual walkthrough (2026-07-26), not a codegen
 * recording — Grid archetype (like General Ledger / Journal Of
 * Transaction): has a "View Grid" step before "Preview Report", then the
 * usual Reports Format template-picker dialog. Same #sub13 category.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > General Ledger > Payment Transaction Listing', () => {
  test.describe.configure({ retries: 0 });

  test('[Happy Path] views, previews, and prints the Payment Transaction Listing report', async ({ page }) => {
    test.setTimeout(90000);
    const reportPage = new GeneralLedgerReportPage(page);
    await reportPage.goto('Payment Transaction Listing');

    await reportPage.viewGrid();
    await reportPage.previewReport('Payment Transaction Listing');

    const reportTab = await reportPage.printReport();
    expect(reportPage.isReportPageValid(reportTab)).toBe(true);

    await reportTab.screenshot({ path: 'test-results/payment-transaction-listing-report-print.png', fullPage: true }).catch(() => {});
    await reportTab.close().catch(() => {});
  });

});
