const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { AccountPayableReportPage } = require('../../../framework/pages/accountPayableReportPage');

/**
 * Converted directly from a Playwright codegen recording Jin made himself
 * (Reports > Account Payable > View Grid -> Preview Report -> Preview ->
 * Print) — same shape as Vendor Aging: the "Reports Format" dialog's
 * first row ("Vendor Balance") comes pre-highlighted (the only other
 * option is "Vendor Balance Summary"), and the recording clicks Preview
 * directly with no explicit template-row click. `previewReport()` is
 * still called with the matching name explicitly (clicking an
 * already-highlighted row is harmless), same reasoning as Vendor Aging.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Account Payable > Vendor Balance', () => {

  test('[Happy Path] views, previews, and prints the Vendor Balance report', async ({ page }) => {
    test.setTimeout(90000);
    const apReportPage = new AccountPayableReportPage(page);
    await apReportPage.goto('Vendor Balance');

    await apReportPage.viewGrid();
    await apReportPage.previewReport('Vendor Balance');

    const reportPage = await apReportPage.printReport();
    expect(apReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/vendor-balance-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
