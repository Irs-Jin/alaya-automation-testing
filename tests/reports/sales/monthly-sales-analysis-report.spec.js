const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { SalesReportPage } = require('../../../framework/pages/salesReportPage');

/**
 * templateName confirmed live: "Monthly Sales Analysis Summary by
 * Customer" (pre-highlighted first row, System owner; other options are
 * "...by Sales Branch/Item/Sales Agent") — a first guess matching just
 * the catalog name failed with a timeout.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Sales > Monthly Sales Analysis', () => {

  test('[Happy Path] views, previews, and prints the Monthly Sales Analysis report', async ({ page }) => {
    // Confirmed live (same lesson as Item Sales Listing (with Profit)):
    // Customer/Item field switching plus render time can exceed the
    // default 90s budget — needs more room.
    test.setTimeout(150000);
    const salesReportPage = new SalesReportPage(page);
    await salesReportPage.goto('Monthly Sales Analysis');

    await salesReportPage.switchCustomerToFilterBySelectionIfAll();
    await salesReportPage.selectFirstCustomerIfNeeded();
    await salesReportPage.switchItemToFilterBySelectionIfAll();
    await salesReportPage.selectFirstItemIfNeeded();
    await salesReportPage.viewGrid();
    await salesReportPage.previewReport('Monthly Sales Analysis Summary by Customer');
    await salesReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await salesReportPage.printReport();
    expect(salesReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/monthly-sales-analysis-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
