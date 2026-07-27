const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { AccountReceivableReportPage } = require('../../../framework/pages/accountReceivableReportPage');

/**
 * Built from Jin's screenshot of the "Reports Format" dialog — template
 * default is "Warranty Due Listing" (pre-highlighted first row, System
 * owner), plain naming with no slash quirk. Customer field defaults to
 * ALL, so selectAllCustomersIfNeeded() self-skips.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Account Receivable > Warranty Due Listing', () => {

  test('[Happy Path] views, previews, and prints the Warranty Due Listing report', async ({ page }) => {
    // Confirmed live: the loading panel can intercept the Preview Report
    // click for well over 20s on this report — needs more than the
    // default 90s budget.
    test.setTimeout(150000);
    const arReportPage = new AccountReceivableReportPage(page);
    await arReportPage.goto('Warranty Due Listing');

    await arReportPage.selectAllCustomersIfNeeded();
    await arReportPage.viewGrid();
    await arReportPage.previewReport('Warranty Due Listing');
    await arReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await arReportPage.printReport();
    expect(arReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/warranty-due-listing-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
