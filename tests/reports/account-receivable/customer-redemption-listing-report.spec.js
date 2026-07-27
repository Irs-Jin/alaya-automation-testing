const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { AccountReceivableReportPage } = require('../../../framework/pages/accountReceivableReportPage');

/**
 * Built from Jin's screenshot of the "Reports Format" dialog — template
 * default is "Customer Redemption Listing by Details" (pre-highlighted;
 * the other option is "...by Summary"), no truncation/slash quirk.
 * `handleAsyncReportOutputIfPresent()` called unconditionally between
 * previewReport() and printReport() per the established convention for
 * this category — self-skips if this report turns out synchronous like
 * Customer Outstanding, or polls Refresh List if it's async like
 * Customer Point Statement.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Account Receivable > Customer Redemption Listing', () => {
  test.describe.configure({ retries: 0 });

  test('[Happy Path] views, previews, and prints the Customer Redemption Listing report', async ({ page }) => {
    test.setTimeout(90000);
    const arReportPage = new AccountReceivableReportPage(page);
    await arReportPage.goto('Customer Redemption Listing');

    await arReportPage.viewGrid();
    await arReportPage.previewReport('Customer Redemption Listing by Details');
    await arReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await arReportPage.printReport();
    expect(arReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/customer-redemption-listing-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
