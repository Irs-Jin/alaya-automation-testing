const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { PurchaseReportPage } = require('../../../framework/pages/purchaseReportPage');

/**
 * templateName confirmed live: "Item Purchase Summary by Item Group"
 * (pre-highlighted first row, System owner; other options include
 * "...Detail by Item Group/Category", "...Summary by Item
 * Category/Vendor", "...Detail by Vendor") — a first guess matching just
 * the catalog name failed with a timeout; corrected from the live
 * Reports Format dialog screenshot.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Purchase > Item Purchase Listing', () => {

  test('[Happy Path] views, previews, and prints the Item Purchase Listing report', async ({ page }) => {
    test.setTimeout(90000);
    const purchaseReportPage = new PurchaseReportPage(page);
    await purchaseReportPage.goto('Item Purchase Listing');

    await purchaseReportPage.switchVendorToFilterBySelectionIfAll();
    await purchaseReportPage.selectFirstVendorIfNeeded();
    await purchaseReportPage.switchItemToFilterBySelectionIfAll();
    await purchaseReportPage.selectFirstItemIfNeeded();
    await purchaseReportPage.viewGrid();
    await purchaseReportPage.previewReport('Item Purchase Summary by Item Group');
    await purchaseReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await purchaseReportPage.printReport();
    expect(purchaseReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/item-purchase-listing-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
