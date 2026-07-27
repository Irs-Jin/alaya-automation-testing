const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { AccountPayableReportPage } = require('../../../framework/pages/accountPayableReportPage');

/**
 * Built from Jin's screenshot of the "Reports Format" dialog (no full
 * codegen recording), then verified live myself and fixed once from a
 * real DOM dump: the template's FULL text is **"Vendor Monthly Purchase
 * And Payment Analysis - Local Currency"** — the screenshot's narrow
 * column visually truncated the " - Local Currency" suffix (matching
 * the underlying form's own "Local/Original Currency" dropdown,
 * defaulted to "Local Currency"), so the naive guess using just the
 * catalog/report name failed all three of previewReport()'s matching
 * strategies (exact `td` text, cell role, plain text) — none matched
 * because none of them were searching for the actual full string.
 * Root-caused via a live `td` text dump rather than re-guessing a 4th
 * selector variant. Same `goto -> viewGrid -> previewReport ->
 * printReport` shape as every other report in this category.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Account Payable > Vendor Monthly Purchase And Payment Analysis', () => {
  test.describe.configure({ retries: 0 });

  test('[Happy Path] views, previews, and prints the Vendor Monthly Purchase And Payment Analysis report', async ({ page }) => {
    test.setTimeout(90000);
    const apReportPage = new AccountPayableReportPage(page);
    await apReportPage.goto('Vendor Monthly Purchase And Payment Analysis');

    await apReportPage.viewGrid();
    await apReportPage.previewReport('Vendor Monthly Purchase And Payment Analysis - Local Currency');

    const reportPage = await apReportPage.printReport();
    expect(apReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/vendor-monthly-purchase-and-payment-analysis-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
