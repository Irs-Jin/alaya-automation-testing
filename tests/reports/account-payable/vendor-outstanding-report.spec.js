const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { AccountPayableReportPage } = require('../../../framework/pages/accountPayableReportPage');

/**
 * Converted directly from a Playwright codegen recording Jin made himself
 * (Reports > Account Payable > View Grid -> Preview Report -> "Vendor
 * Outstanding By Vendor" template -> Preview -> Print) — same shape as
 * the Reports > General Ledger category, just a different catalog. See
 * framework/pages/accountPayableReportPage.js for the structure writeup.
 *
 * Success criterion mirrors the General Ledger reports: reaching a real
 * print-preview tab IS success — a slow-to-render report isn't flaky.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Account Payable > Vendor Outstanding', () => {
  test.describe.configure({ retries: 0 });

  test('[Happy Path] views, previews, and prints the Vendor Outstanding report', async ({ page }) => {
    test.setTimeout(90000);
    const apReportPage = new AccountPayableReportPage(page);
    await apReportPage.goto('Vendor Outstanding');

    await apReportPage.viewGrid();
    await apReportPage.previewReport('Vendor Outstanding By Vendor');

    const reportPage = await apReportPage.printReport();
    expect(apReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/vendor-outstanding-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
