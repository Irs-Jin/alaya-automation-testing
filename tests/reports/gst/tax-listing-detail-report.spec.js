const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { GstReportPage } = require('../../../framework/pages/gstReportPage');

/**
 * First (and so far only) report in the Reports > GST category — built
 * from Jin's screenshot of the catalog only (no per-report "Reports
 * Format" dialog screenshot or recording). templateName is an
 * UNCONFIRMED GUESS matching the catalog name. If wrong, expect a live
 * failure with a debug screenshot to correct it from.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > GST > Tax Listing Detail', () => {

  test('[Happy Path] views, previews, and prints the Tax Listing Detail report', async ({ page }) => {
    test.setTimeout(90000);
    const gstReportPage = new GstReportPage(page);
    await gstReportPage.goto('Tax Listing Detail');

    await gstReportPage.switchCustomerToFilterBySelectionIfAll();
    await gstReportPage.selectFirstCustomerIfNeeded();
    await gstReportPage.viewGrid();
    await gstReportPage.previewReport('Tax Listing Detail');
    await gstReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await gstReportPage.printReport();
    expect(gstReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/tax-listing-detail-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
