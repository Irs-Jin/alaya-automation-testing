const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { InventoryReportPage } = require('../../../framework/pages/inventoryReportPage');

/**
 * Built from Jin's screenshot of the "Reports Format" dialog — template
 * default is "Inventory Item Consolidate Detail" (pre-highlighted first
 * row, System owner; other option is "...Summary"). Warehouse defaults to
 * ALL, so selectFirstWarehouseIfNeeded() self-skips.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Inventory > Inventory Item Consolidate', () => {

  test('[Happy Path] views, previews, and prints the Inventory Item Consolidate report', async ({ page }) => {
    // Async report-output archetype with multiple Refresh List polls
    // (confirmed live: needed 3) eats into the default 90s budget before
    // the final print click even starts — needs more room.
    test.setTimeout(150000);
    const inventoryReportPage = new InventoryReportPage(page);
    await inventoryReportPage.goto('Inventory Item Consolidate');

    await inventoryReportPage.selectFirstWarehouseIfNeeded();
    await inventoryReportPage.viewGrid();
    await inventoryReportPage.previewReport('Inventory Item Consolidate Detail');
    await inventoryReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await inventoryReportPage.printReport();
    expect(inventoryReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/inventory-item-consolidate-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
