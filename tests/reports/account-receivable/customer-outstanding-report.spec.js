const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { AccountReceivableReportPage } = require('../../../framework/pages/accountReceivableReportPage');

/**
 * First report in the Reports > Account Receivable category — built from
 * Jin's own screenshots (no codegen recording). Same `ReportFrameWork1`
 * shape as General Ledger / Account Payable. Template default is
 * "Customer Outstanding By Customer" (pre-highlighted; the other option
 * is "...By Sales Agent"), plain naming with no slash quirk this time.
 * See framework/pages/accountReceivableReportPage.js for the structure.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Account Receivable > Customer Outstanding', () => {
  test.describe.configure({ retries: 0 });

  test('[Happy Path] views, previews, and prints the Customer Outstanding report', async ({ page }) => {
    test.setTimeout(90000);
    const arReportPage = new AccountReceivableReportPage(page);
    await arReportPage.goto('Customer Outstanding');

    await arReportPage.viewGrid();
    await arReportPage.previewReport('Customer Outstanding By Customer');
    await arReportPage.handleAsyncReportOutputIfPresent(); // self-skips — this report renders synchronously

    const reportPage = await arReportPage.printReport();
    expect(arReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/customer-outstanding-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
