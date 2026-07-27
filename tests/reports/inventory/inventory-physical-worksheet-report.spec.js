const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { InventoryReportPage } = require('../../../framework/pages/inventoryReportPage');

/**
 * Built from Jin's screenshot of the "Reports Format" dialog — Warehouse
 * defaults to "Filter By Selection" (same quirk as Stock Aging),
 * selectFirstWarehouseIfNeeded() ticks just one warehouse per Jin's
 * instruction. Template default is "Inventory Physical WorkSheet By
 * Warehouse" (pre-highlighted first row, System owner).
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Inventory > Inventory Physical WorkSheet', () => {

  test('[Happy Path] views, previews, and prints the Inventory Physical WorkSheet report', async ({ page }) => {
    test.setTimeout(90000);
    const inventoryReportPage = new InventoryReportPage(page);
    await inventoryReportPage.goto('Inventory Physical WorkSheet');

    await inventoryReportPage.selectFirstWarehouseIfNeeded();
    await inventoryReportPage.viewGrid();
    await inventoryReportPage.previewReport('Inventory Physical WorkSheet By Warehouse');
    await inventoryReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await inventoryReportPage.printReport();
    expect(inventoryReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/inventory-physical-worksheet-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
