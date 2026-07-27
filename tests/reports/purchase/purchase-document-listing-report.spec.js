const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { PurchaseReportPage } = require('../../../framework/pages/purchaseReportPage');

/**
 * templateName confirmed live: "Purchase Document Listing By Item
 * Detail" (the only option, System owner) — a first guess matching just
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

test.describe('Reports > Purchase > Purchase Document Listing', () => {

  test('[Happy Path] views, previews, and prints the Purchase Document Listing report', async ({ page }) => {
    test.setTimeout(90000);
    const purchaseReportPage = new PurchaseReportPage(page);
    await purchaseReportPage.goto('Purchase Document Listing');

    await purchaseReportPage.switchVendorToFilterBySelectionIfAll();
    await purchaseReportPage.selectFirstVendorIfNeeded();
    await purchaseReportPage.switchItemToFilterBySelectionIfAll();
    await purchaseReportPage.selectFirstItemIfNeeded();
    await purchaseReportPage.viewGrid();
    await purchaseReportPage.previewReport('Purchase Document Listing By Item Detail');
    await purchaseReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await purchaseReportPage.printReport();
    expect(purchaseReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/purchase-document-listing-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
