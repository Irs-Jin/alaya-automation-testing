const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { InventoryReportPage } = require('../../../framework/pages/inventoryReportPage');

/**
 * Built from Jin's screenshots + corrected codegen recording — Warehouse
 * defaults to "Filter By Selection" with an empty Selection grid, same
 * quirk as Account Receivable's Customer Statement Balance but for
 * Warehouse instead of Customer. Per Jin: select just ONE warehouse
 * (selectFirstWarehouseIfNeeded() ticks the first row), not "Select All"
 * — selecting every warehouse turned this into a multi-minute
 * cross-warehouse aggregation. Template default is "Stock Aging"
 * (pre-highlighted first row, System owner), plain naming with no slash
 * quirk.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Inventory > Stock Aging', () => {

  test('[Happy Path] views, previews, and prints the Stock Aging report', async ({ page }) => {
    test.setTimeout(90000);
    const inventoryReportPage = new InventoryReportPage(page);
    await inventoryReportPage.goto('Stock Aging');

    await inventoryReportPage.selectFirstWarehouseIfNeeded();
    await inventoryReportPage.viewGrid();
    await inventoryReportPage.previewReport('Stock Aging');
    await inventoryReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await inventoryReportPage.printReport();
    expect(inventoryReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/stock-aging-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
