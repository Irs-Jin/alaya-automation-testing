const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { InventoryReportPage } = require('../../../framework/pages/inventoryReportPage');

/**
 * Built from Jin's screenshot of the report catalog only (no per-report
 * "Reports Format" dialog screenshot or recording). templateName is an
 * UNCONFIRMED GUESS matching the catalog name — if wrong, expect a live
 * failure with a debug screenshot to correct it from.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Inventory > Stock Expiry Listing', () => {

  test('[Happy Path] views, previews, and prints the Stock Expiry Listing report', async ({ page }) => {
    // Large-data report — same slow-render lesson as Vendor Aging/Customer
    // Aging, needs more than the default 90s.
    test.setTimeout(150000);
    const inventoryReportPage = new InventoryReportPage(page);
    await inventoryReportPage.goto('Stock Expiry Listing');

    await inventoryReportPage.viewGrid();
    await inventoryReportPage.previewReport('Stock Expiry Listing');
    await inventoryReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await inventoryReportPage.printReport();
    expect(inventoryReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/stock-expiry-listing-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
