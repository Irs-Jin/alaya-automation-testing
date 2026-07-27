const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { SalesReportPage } = require('../../../framework/pages/salesReportPage');

/**
 * templateName confirmed live: "Sales Profit by Month & Year" (the only
 * option, System owner) — a first guess matching just the catalog name
 * failed with a timeout. No "Show Cost" checkbox on this report's
 * parameter form, so checkShowCostIfPresent() correctly self-skips.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Sales > Sales Profit', () => {

  test('[Happy Path] views, previews, and prints the Sales Profit report', async ({ page }) => {
    test.setTimeout(90000);
    const salesReportPage = new SalesReportPage(page);
    await salesReportPage.goto('Sales Profit');

    await salesReportPage.checkShowCostIfPresent();
    await salesReportPage.switchCustomerToFilterBySelectionIfAll();
    await salesReportPage.selectFirstCustomerIfNeeded();
    await salesReportPage.viewGrid();
    await salesReportPage.previewReport('Sales Profit by Month & Year');
    await salesReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await salesReportPage.printReport();
    expect(salesReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/sales-profit-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
