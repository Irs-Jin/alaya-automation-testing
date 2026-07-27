const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { StaffReportPage } = require('../../../framework/pages/staffReportPage');

/**
 * First (and so far only) report in the Reports > Staff category — built
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

test.describe('Reports > Staff > Sales Commission Listing', () => {

  test('[Happy Path] views, previews, and prints the Sales Commission Listing report', async ({ page }) => {
    test.setTimeout(90000);
    const staffReportPage = new StaffReportPage(page);
    await staffReportPage.goto('Sales Commission Listing');

    await staffReportPage.switchStaffToFilterBySelectionIfAll();
    await staffReportPage.selectFirstStaffIfNeeded();
    await staffReportPage.viewGrid();
    await staffReportPage.previewReport('Sales Commission Listing');
    await staffReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await staffReportPage.printReport();
    expect(staffReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/sales-commission-listing-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
