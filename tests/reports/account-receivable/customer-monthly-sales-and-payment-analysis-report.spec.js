const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { AccountReceivableReportPage } = require('../../../framework/pages/accountReceivableReportPage');

/**
 * Built from pattern similarity only — no fresh screenshot/recording for
 * this specific report. By analogy with Account Payable's "Vendor Monthly
 * Purchase And Payment Analysis" (whose real template name had a hidden
 * "- Local Currency" suffix truncated by the dialog's narrow column),
 * templateName below is an UNCONFIRMED GUESS. selectAllCustomersIfNeeded()
 * is called unconditionally (self-skips harmlessly if this report's
 * Customer field defaults to ALL instead of Filter By Selection).
 * If either guess is wrong, expect a live failure with a debug screenshot
 * to correct from — same workflow as Vendor Monthly Purchase And Payment
 * Analysis and Customer Statement Balance before it.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Account Receivable > Customer Monthly Sales and Payment Analysis', () => {

  test('[Happy Path] views, previews, and prints the Customer Monthly Sales and Payment Analysis report', async ({ page }) => {
    test.setTimeout(90000);
    const arReportPage = new AccountReceivableReportPage(page);
    await arReportPage.goto('Customer Monthly Sales and Payment Analysis');

    await arReportPage.selectAllCustomersIfNeeded();
    await arReportPage.viewGrid();
    await arReportPage.previewReport('Customer Monthly Sales And Payment Analysis - Local Currency');
    await arReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await arReportPage.printReport();
    expect(arReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/customer-monthly-sales-and-payment-analysis-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
