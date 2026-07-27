const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { AccountPayableReportPage } = require('../../../framework/pages/accountPayableReportPage');

/**
 * Built from Jin's screenshot of the "Reports Format" dialog (no full
 * codegen recording) — this time the column is visibly wide enough that
 * "Vendor Analysis By Document" isn't truncated (unlike the Vendor
 * Monthly Purchase And Payment Analysis case, which had a hidden
 * " - Local Currency" suffix cut off by a narrow column). Still verified
 * live before trusting it, per that same lesson. Same
 * `goto -> viewGrid -> previewReport -> printReport` shape as every
 * other report in this category.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Account Payable > Vendor Analysis By Document', () => {

  test('[Happy Path] views, previews, and prints the Vendor Analysis By Document report', async ({ page }) => {
    test.setTimeout(90000);
    const apReportPage = new AccountPayableReportPage(page);
    await apReportPage.goto('Vendor Analysis By Document');

    await apReportPage.viewGrid();
    await apReportPage.previewReport('Vendor Analysis By Document');

    const reportPage = await apReportPage.printReport();
    expect(apReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/vendor-analysis-by-document-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
