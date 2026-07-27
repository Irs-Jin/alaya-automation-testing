const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { InventoryReportPage } = require('../../../framework/pages/inventoryReportPage');

/**
 * First report in the Reports > Inventory category — built from Jin's
 * screenshot of the report catalog only (no per-report "Reports Format"
 * dialog screenshot or recording). templateName confirmed live: "Stock
 * Movement Summary By Warehouse" (pre-highlighted first row) — a first
 * guess matching the catalog name ("Stock Movement") failed with a
 * timeout; corrected from the live Reports Format dialog screenshot.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Inventory > Stock Movement', () => {

  test('[Happy Path] views, previews, and prints the Stock Movement report', async ({ page }) => {
    test.setTimeout(90000);
    const inventoryReportPage = new InventoryReportPage(page);
    await inventoryReportPage.goto('Stock Movement');

    await inventoryReportPage.viewGrid();
    await inventoryReportPage.previewReport('Stock Movement Summary By Warehouse');
    await inventoryReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await inventoryReportPage.printReport();
    expect(inventoryReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/stock-movement-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
