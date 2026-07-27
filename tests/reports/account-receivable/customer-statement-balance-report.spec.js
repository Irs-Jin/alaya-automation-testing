const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { AccountReceivableReportPage } = require('../../../framework/pages/accountReceivableReportPage');

/**
 * Built from Jin's screenshots + codegen recording (2026-07-27). NEW shape
 * for this category: Customer defaults to "Filter By Selection" with an
 * empty Selection grid — selectAllCustomersIfNeeded() ticks "Select All"
 * before View Grid, per Jin's recording.
 *
 * templateName confirmed live: "Customer Statement 6 Months" (plural
 * "Months", pre-highlighted first row) — a first guess of "...6 Month"
 * (singular), by analogy with Account Payable's "Vendor Statement Balance"
 * naming, failed with a timeout; corrected from the live Reports Format
 * dialog screenshot.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Account Receivable > Customer Statement Balance', () => {

  test('[Happy Path] views, previews, and prints the Customer Statement Balance report', async ({ page }) => {
    test.setTimeout(90000);
    const arReportPage = new AccountReceivableReportPage(page);
    await arReportPage.goto('Customer Statement Balance');

    await arReportPage.selectAllCustomersIfNeeded();
    await arReportPage.viewGrid();
    await arReportPage.previewReport('Customer Statement 6 Months');
    await arReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await arReportPage.printReport();
    expect(arReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/customer-statement-balance-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
