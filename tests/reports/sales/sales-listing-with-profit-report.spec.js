const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { SalesReportPage } = require('../../../framework/pages/salesReportPage');

/**
 * Built from Jin's screenshot of the parameter form — this report has a
 * "Show Cost" checkbox (highlighted) that must be ticked before
 * previewing, per Jin's explicit instruction; confirmed live it ticks
 * correctly via checkShowCostIfPresent(). templateName confirmed live:
 * "Sales Listing (with Profit) by Customer" (pre-highlighted first row,
 * System owner; other options are "...by Sales Agent/Sales Branch/Date")
 * — a first guess matching just the catalog name failed with a timeout.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Sales > Sales Listing (with Profit)', () => {

  test('[Happy Path] views, previews, and prints the Sales Listing (with Profit) report', async ({ page }) => {
    test.setTimeout(90000);
    const salesReportPage = new SalesReportPage(page);
    await salesReportPage.goto('Sales Listing (with Profit)');

    await salesReportPage.checkShowCostIfPresent();
    await salesReportPage.switchCustomerToFilterBySelectionIfAll();
    await salesReportPage.selectFirstCustomerIfNeeded();
    await salesReportPage.viewGrid();
    await salesReportPage.previewReport('Sales Listing (with Profit) by Customer');
    await salesReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await salesReportPage.printReport();
    expect(salesReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/sales-listing-with-profit-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
