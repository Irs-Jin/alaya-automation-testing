const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { SalesReportPage } = require('../../../framework/pages/salesReportPage');

/**
 * Built from pattern similarity only — no screenshot/recording for this
 * specific report's "Reports Format" dialog. templateName is an
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

test.describe('Reports > Sales > Preferred Vendor Product Sales Listing', () => {

  test('[Happy Path] views, previews, and prints the Preferred Vendor Product Sales Listing report', async ({ page }) => {
    test.setTimeout(90000);
    const salesReportPage = new SalesReportPage(page);
    await salesReportPage.goto('Preferred Vendor Product Sales Listing');

    await salesReportPage.switchCustomerToFilterBySelectionIfAll();
    await salesReportPage.selectFirstCustomerIfNeeded();
    await salesReportPage.switchItemToFilterBySelectionIfAll();
    await salesReportPage.selectFirstItemIfNeeded();
    await salesReportPage.viewGrid();
    await salesReportPage.previewReport('Preferred Vendor Product Sales Listing');

    // REVERTED (2026-07-28): tried removing this, reasoning it was just
    // timing out uselessly (per a diagnostic showing ~21s spent here) —
    // WRONG, confirmed live: removing it made the test fail outright
    // (Test timeout of 90000ms exceeded, print button never found at
    // all). This report genuinely DOES use the async "Report Output
    // Listing" pattern; the ~21s is real, necessary work (Click Here ->
    // Refresh List polling -> Preview cell), not a wasted race timeout —
    // don't remove this again without re-confirming against a live run.
    await salesReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await salesReportPage.printReport();
    expect(salesReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/preferred-vendor-product-sales-listing-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
