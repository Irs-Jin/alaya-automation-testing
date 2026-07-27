const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { AccountReceivableReportPage } = require('../../../framework/pages/accountReceivableReportPage');

/**
 * Built from Jin's screenshot of the "Reports Format" dialog — template
 * default is "AR Payment Listing Summary By Project & Date" (pre-highlighted
 * first row, System owner). Plain "AR" naming, no "A/R" slash quirk.
 * `handleAsyncReportOutputIfPresent()` called unconditionally per the
 * established convention for this category.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Account Receivable > AR Payment Listing', () => {

  test('[Happy Path] views, previews, and prints the AR Payment Listing report', async ({ page }) => {
    test.setTimeout(90000);
    const arReportPage = new AccountReceivableReportPage(page);
    await arReportPage.goto('AR Payment Listing');

    await arReportPage.viewGrid();
    await arReportPage.previewReport('AR Payment Listing Summary By Project & Date');
    await arReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await arReportPage.printReport();
    expect(arReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/ar-payment-listing-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
