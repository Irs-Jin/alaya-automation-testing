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

test.describe('Reports > Sales > Slow Movement Listing', () => {

  test('[Happy Path] views, previews, and prints the Slow Movement Listing report', async ({ page }) => {
    test.setTimeout(90000);
    const salesReportPage = new SalesReportPage(page);
    await salesReportPage.goto('Slow Movement Listing');

    // Confirmed live (2026-07-28): this report's parameter form has
    // neither a Customer nor an Item field — only From/To Date, Quantity
    // Sold, Export To. Removed the dead switchItemToFilterBySelectionIfAll()/
    // selectFirstItemIfNeeded() calls.
    await salesReportPage.viewGrid();
    await salesReportPage.previewReport('Slow Movement Listing');
    await salesReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await salesReportPage.printReport();
    expect(salesReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/slow-movement-listing-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
