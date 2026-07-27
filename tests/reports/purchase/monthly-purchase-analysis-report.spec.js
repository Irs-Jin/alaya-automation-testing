const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { PurchaseReportPage } = require('../../../framework/pages/purchaseReportPage');

/**
 * First report in the Reports > Purchase category. templateName
 * confirmed live: "Monthly Purchase Analysis Summary by Vendor" (the
 * only option, System owner) — a first guess matching just the catalog
 * name failed with a timeout; corrected from the live Reports Format
 * dialog screenshot. This report's parameter form only has
 * Warehouse/Date (no Vendor/Item fields), so switchVendor.../
 * selectFirstVendor.../switchItem.../selectFirstItem... all correctly
 * self-skip.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Purchase > Monthly Purchase Analysis', () => {

  test('[Happy Path] views, previews, and prints the Monthly Purchase Analysis report', async ({ page }) => {
    test.setTimeout(90000);
    const purchaseReportPage = new PurchaseReportPage(page);
    await purchaseReportPage.goto('Monthly Purchase Analysis');

    await purchaseReportPage.switchVendorToFilterBySelectionIfAll();
    await purchaseReportPage.selectFirstVendorIfNeeded();
    await purchaseReportPage.switchItemToFilterBySelectionIfAll();
    await purchaseReportPage.selectFirstItemIfNeeded();
    await purchaseReportPage.viewGrid();
    await purchaseReportPage.previewReport('Monthly Purchase Analysis Summary by Vendor');
    await purchaseReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await purchaseReportPage.printReport();
    expect(purchaseReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/monthly-purchase-analysis-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
