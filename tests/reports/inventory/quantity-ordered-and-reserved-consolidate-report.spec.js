const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { InventoryReportPage } = require('../../../framework/pages/inventoryReportPage');

/**
 * templateName confirmed live: "Quantity Ordered and Reserved Consolidate
 * Detail" (pre-highlighted first row, System owner; other option is
 * "...Summary") — same Detail/Summary pattern as Inventory Item
 * Consolidate. A first guess matching just the catalog name failed with
 * a timeout; corrected from the live Reports Format dialog screenshot.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Inventory > Quantity Ordered and Reserved Consolidate', () => {

  test('[Happy Path] views, previews, and prints the Quantity Ordered and Reserved Consolidate report', async ({ page }) => {
    test.setTimeout(90000);
    const inventoryReportPage = new InventoryReportPage(page);
    await inventoryReportPage.goto('Quantity Ordered and Reserved Consolidate');

    await inventoryReportPage.selectFirstWarehouseIfNeeded();
    await inventoryReportPage.viewGrid();
    await inventoryReportPage.previewReport('Quantity Ordered and Reserved Consolidate Detail');
    await inventoryReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await inventoryReportPage.printReport();
    expect(inventoryReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/quantity-ordered-and-reserved-consolidate-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
