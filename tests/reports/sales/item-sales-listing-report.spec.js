const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { SalesReportPage } = require('../../../framework/pages/salesReportPage');

/**
 * templateName confirmed live: "Item Sales Summary by Item Group"
 * (pre-highlighted first row, System owner; many variants exist —
 * Summary/Detail by Item Group/Category/Sales Agent/Sales Branch, plus
 * "Salesperson Sales Listing By Item (Summary)") — a first guess
 * matching just the catalog name failed with a timeout.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Sales > Item Sales Listing', () => {

  test('[Happy Path] views, previews, and prints the Item Sales Listing report', async ({ page }) => {
    // Item field defaults to "Filter By Selection" (300+ items) — same
    // slow-switch lesson as other Item-field reports in this category.
    test.setTimeout(150000);
    const salesReportPage = new SalesReportPage(page);
    await salesReportPage.goto('Item Sales Listing');

    await salesReportPage.switchCustomerToFilterBySelectionIfAll();
    await salesReportPage.selectFirstCustomerIfNeeded();
    await salesReportPage.switchItemToFilterBySelectionIfAll();
    await salesReportPage.selectFirstItemIfNeeded();
    await salesReportPage.viewGrid();
    await salesReportPage.previewReport('Item Sales Summary by Item Group');
    await salesReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await salesReportPage.printReport();
    expect(salesReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/item-sales-listing-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
