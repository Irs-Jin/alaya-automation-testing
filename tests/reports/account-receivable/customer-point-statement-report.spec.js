const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { AccountReceivableReportPage } = require('../../../framework/pages/accountReceivableReportPage');

/**
 * Built from Jin's screenshot of the "Reports Format" dialog (template
 * name matches the catalog name exactly: "Customer Point Statement"),
 * then a real codegen recording after the first live run revealed a NEW
 * archetype: this report generates ASYNCHRONOUSLY — Preview lands on a
 * "Your report is being processed." page, not the rendered report
 * directly. `handleAsyncReportOutputIfPresent()` handles the extra
 * "Click here to view Report Output Listing" -> click the newest row's
 * preview action steps — see accountReceivableReportPage.js for the
 * full breakdown. Self-skips for synchronous reports (like Customer
 * Outstanding), so it's safe to call unconditionally for every future
 * report in this category too.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Account Receivable > Customer Point Statement', () => {

  test('[Happy Path] views, previews, and prints the Customer Point Statement report', async ({ page }) => {
    test.setTimeout(90000);
    const arReportPage = new AccountReceivableReportPage(page);
    await arReportPage.goto('Customer Point Statement');

    await arReportPage.viewGrid();
    await arReportPage.previewReport('Customer Point Statement');
    await arReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await arReportPage.printReport();
    expect(arReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/customer-point-statement-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
