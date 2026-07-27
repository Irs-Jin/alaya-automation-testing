const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { AccountReceivableReportPage } = require('../../../framework/pages/accountReceivableReportPage');

/**
 * Built from Jin's screenshot of the "Reports Format" dialog — template
 * default is "Customer Last Visit Listing" (pre-highlighted first row,
 * System owner), plain naming with no slash quirk. Customer field
 * defaults to ALL, so selectAllCustomersIfNeeded() self-skips.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Account Receivable > Customer Last Visit Listing', () => {

  test('[Happy Path] views, previews, and prints the Customer Last Visit Listing report', async ({ page }) => {
    test.setTimeout(90000);
    const arReportPage = new AccountReceivableReportPage(page);
    await arReportPage.goto('Customer Last Visit Listing');

    await arReportPage.selectAllCustomersIfNeeded();
    await arReportPage.viewGrid();
    await arReportPage.previewReport('Customer Last Visit Listing');
    await arReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await arReportPage.printReport();
    expect(arReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/customer-last-visit-listing-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
