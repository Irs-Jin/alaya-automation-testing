const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { InventoryReportPage } = require('../../../framework/pages/inventoryReportPage');

/**
 * templateName confirmed live: "Item Reorder Point By Item"
 * (pre-highlighted first row, System owner; other options are "...By
 * Warehouse" and "...By Warehouse Category") — a first guess matching
 * just the catalog name failed with a timeout; corrected from the live
 * Reports Format dialog screenshot. Warehouse defaults to "Filter By
 * Selection", handled by switchWarehouseToFilterBySelectionIfAll() +
 * selectFirstWarehouseIfNeeded().
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Inventory > Item Reorder Point', () => {

  test('[Happy Path] views, previews, and prints the Item Reorder Point report', async ({ page }) => {
    test.setTimeout(90000);
    const inventoryReportPage = new InventoryReportPage(page);
    await inventoryReportPage.goto('Item Reorder Point');

    await inventoryReportPage.switchWarehouseToFilterBySelectionIfAll();
    await inventoryReportPage.selectFirstWarehouseIfNeeded();
    await inventoryReportPage.viewGrid();
    await inventoryReportPage.previewReport('Item Reorder Point By Item');
    await inventoryReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await inventoryReportPage.printReport();
    expect(inventoryReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/item-reorder-point-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
