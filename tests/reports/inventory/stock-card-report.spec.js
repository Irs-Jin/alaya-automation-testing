const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { InventoryReportPage } = require('../../../framework/pages/inventoryReportPage');

/**
 * templateName confirmed live: "Stock Card Summary By Warehouse & Item"
 * (pre-highlighted first row, System owner) — a first guess matching just
 * the catalog name failed with a timeout; corrected from the live Reports
 * Format dialog screenshot.
 *
 * Warehouse=ALL + Item=ALL was confirmed live to be genuinely too heavy
 * (5+ minutes, never finished even with generous timeouts) — and
 * narrowing Warehouse alone to one row still wasn't enough (Item=ALL was
 * still scanning every item). Per Jin: switch BOTH Warehouse and Item
 * from "ALL" to "Filter By Selection" and pick just a few rows in each —
 * same "select some, not all" lesson as Stock Aging, applied to both
 * fields this report exposes.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Inventory > Stock Card', () => {

  test('[Happy Path] views, previews, and prints the Stock Card report', async ({ page }) => {
    test.setTimeout(90000);
    const inventoryReportPage = new InventoryReportPage(page);
    await inventoryReportPage.goto('Stock Card');

    await inventoryReportPage.switchWarehouseToFilterBySelectionIfAll();
    await inventoryReportPage.selectFirstWarehouseIfNeeded();
    await inventoryReportPage.switchItemToFilterBySelectionIfAll();
    await inventoryReportPage.selectFirstItemIfNeeded();
    await inventoryReportPage.viewGrid();
    await inventoryReportPage.previewReport('Stock Card Summary By Warehouse & Item');
    await inventoryReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await inventoryReportPage.printReport();
    expect(inventoryReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/stock-card-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
