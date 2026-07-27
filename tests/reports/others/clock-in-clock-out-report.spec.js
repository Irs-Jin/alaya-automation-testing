const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { OthersReportPage } = require('../../../framework/pages/othersReportPage');

/**
 * templateName confirmed live: "Clock In Clock Out Listing"
 * (pre-highlighted first row, System owner; other options are "Clock Out
 * With Worked Time" and "...and Details") — a first guess matching just
 * the catalog name failed with a timeout. No Staff field on this
 * report's parameter form (Sales Branch/POS Counter/POS Users instead),
 * so switchStaffToFilterBySelectionIfAll()/selectFirstStaffIfNeeded()
 * correctly self-skip.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Others > Clock In Clock Out', () => {

  test('[Happy Path] views, previews, and prints the Clock In Clock Out report', async ({ page }) => {
    test.setTimeout(90000);
    const othersReportPage = new OthersReportPage(page);
    await othersReportPage.goto('Clock In Clock Out');

    await othersReportPage.switchStaffToFilterBySelectionIfAll();
    await othersReportPage.selectFirstStaffIfNeeded();
    await othersReportPage.viewGrid();
    await othersReportPage.previewReport('Clock In Clock Out Listing');
    await othersReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await othersReportPage.printReport();
    expect(othersReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/clock-in-clock-out-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
