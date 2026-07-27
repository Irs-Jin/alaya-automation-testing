const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { SalesReportPage } = require('../../../framework/pages/salesReportPage');

/**
 * templateName confirmed live: "Sales Document Listing By Item Detail"
 * (pre-highlighted first row, System owner; other option is "...
 * Summary") — a first guess matching just the catalog name failed with
 * a timeout.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Sales > Sales Document Listing', () => {

  test('[Happy Path] views, previews, and prints the Sales Document Listing report', async ({ page }) => {
    test.setTimeout(90000);
    const salesReportPage = new SalesReportPage(page);
    await salesReportPage.goto('Sales Document Listing');

    await salesReportPage.switchCustomerToFilterBySelectionIfAll();
    await salesReportPage.selectFirstCustomerIfNeeded();
    await salesReportPage.viewGrid();
    await salesReportPage.previewReport('Sales Document Listing By Item Detail');
    await salesReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await salesReportPage.printReport();
    expect(salesReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/sales-document-listing-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
