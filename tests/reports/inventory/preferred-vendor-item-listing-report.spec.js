const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { InventoryReportPage } = require('../../../framework/pages/inventoryReportPage');

/**
 * Built from pattern similarity only — no screenshot/recording for this
 * specific report's "Reports Format" dialog. templateName is an
 * UNCONFIRMED GUESS matching the catalog name. If wrong, expect a live
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

test.describe('Reports > Inventory > Preferred Vendor Item Listing', () => {

  test('[Happy Path] views, previews, and prints the Preferred Vendor Item Listing report', async ({ page }) => {
    test.setTimeout(90000);
    const inventoryReportPage = new InventoryReportPage(page);
    await inventoryReportPage.goto('Preferred Vendor Item Listing');

    await inventoryReportPage.selectFirstWarehouseIfNeeded();
    await inventoryReportPage.viewGrid();
    await inventoryReportPage.previewReport('Preferred Vendor Item Listing');
    await inventoryReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await inventoryReportPage.printReport();
    expect(inventoryReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/preferred-vendor-item-listing-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
