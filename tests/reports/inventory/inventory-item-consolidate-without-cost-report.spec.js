const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { InventoryReportPage } = require('../../../framework/pages/inventoryReportPage');

/**
 * Built from Jin's screenshot of the "Reports Format" dialog — template
 * default is "Inventory Item Consolidate Detail (without Cost)"
 * (pre-highlighted first row, System owner; other option is
 * "...Summary (without Cost)") — same Detail/Summary pattern as the
 * regular Inventory Item Consolidate report.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Inventory > Inventory Item Consolidate (without Cost)', () => {

  test('[Happy Path] views, previews, and prints the Inventory Item Consolidate (without Cost) report', async ({ page }) => {
    test.setTimeout(90000);
    const inventoryReportPage = new InventoryReportPage(page);
    await inventoryReportPage.goto('Inventory Item Consolidate (without Cost)');

    await inventoryReportPage.selectFirstWarehouseIfNeeded();
    await inventoryReportPage.viewGrid();
    await inventoryReportPage.previewReport('Inventory Item Consolidate Detail (without Cost)');
    await inventoryReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await inventoryReportPage.printReport();
    expect(inventoryReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/inventory-item-consolidate-without-cost-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
