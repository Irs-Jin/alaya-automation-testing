const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { SalesReportPage } = require('../../../framework/pages/salesReportPage');

/**
 * templateName confirmed live: "Item Sales Summary (With Profit) by Item
 * Group" (pre-highlighted first row, System owner; many other variants
 * exist — Summary/Detail by Item Group/Category/Sales Agent/Sales
 * Branch/Matrix Item). No "Show Cost" checkbox on this report (unlike
 * Sales Listing (with Profit)) — checkShowCostIfPresent() self-skips.
 * Customer and Item fields both default to "Filter By Selection", with
 * Customer nested inside a collapsible "Additional Option" panel whose
 * wrapper intercepted a plain click — switchCustomerToFilterBySelectionIfAll()
 * now uses force:true to work around it (see salesReportPage.js).
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Sales > Item Sales Listing (with Profit)', () => {

  test('[Happy Path] views, previews, and prints the Item Sales Listing (with Profit) report', async ({ page }) => {
    // Confirmed live: the force-click retries on Customer/Item field
    // switching plus this report's own render time ate into the default
    // 90s budget before printReport() got its own window — needs more room.
    test.setTimeout(150000);
    const salesReportPage = new SalesReportPage(page);
    await salesReportPage.goto('Item Sales Listing (with Profit)');

    await salesReportPage.checkShowCostIfPresent();
    await salesReportPage.switchCustomerToFilterBySelectionIfAll();
    await salesReportPage.selectFirstCustomerIfNeeded();
    await salesReportPage.switchItemToFilterBySelectionIfAll();
    await salesReportPage.selectFirstItemIfNeeded();
    await salesReportPage.viewGrid();
    await salesReportPage.previewReport('Item Sales Summary (With Profit) by Item Group');
    await salesReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await salesReportPage.printReport();
    expect(salesReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/item-sales-listing-with-profit-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
