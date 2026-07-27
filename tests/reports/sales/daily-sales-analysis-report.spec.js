const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { SalesReportPage } = require('../../../framework/pages/salesReportPage');

/**
 * templateName confirmed live: "Daily Sales Analysis By Day" (the only
 * option, System owner) — a first guess matching just the catalog name
 * failed with a timeout. No Customer field on this report (Sales
 * Branch/Warehouse/Document Type only).
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Sales > Daily Sales Analysis', () => {

  test('[Happy Path] views, previews, and prints the Daily Sales Analysis report', async ({ page }) => {
    test.setTimeout(90000);
    const salesReportPage = new SalesReportPage(page);
    await salesReportPage.goto('Daily Sales Analysis');

    await salesReportPage.switchCustomerToFilterBySelectionIfAll();
    await salesReportPage.selectFirstCustomerIfNeeded();
    await salesReportPage.viewGrid();
    await salesReportPage.previewReport('Daily Sales Analysis By Day');
    await salesReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await salesReportPage.printReport();
    expect(salesReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/daily-sales-analysis-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
