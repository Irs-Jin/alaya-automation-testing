const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { AccountReceivableReportPage } = require('../../../framework/pages/accountReceivableReportPage');

/**
 * Built from Jin's screenshot of the "Reports Format" dialog — template
 * default is "Customer Balance" (pre-highlighted first row, System owner;
 * other options are "...Summary" plus two ADMIN-owned variants).
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

test.describe('Reports > Account Receivable > Customer Balance', () => {

  test('[Happy Path] views, previews, and prints the Customer Balance report', async ({ page }) => {
    test.setTimeout(90000);
    const arReportPage = new AccountReceivableReportPage(page);
    await arReportPage.goto('Customer Balance');

    await arReportPage.viewGrid();
    await arReportPage.previewReport('Customer Balance');
    await arReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await arReportPage.printReport();
    expect(arReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/customer-balance-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
