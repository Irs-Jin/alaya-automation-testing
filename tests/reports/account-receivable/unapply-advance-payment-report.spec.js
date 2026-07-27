const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { AccountReceivableReportPage } = require('../../../framework/pages/accountReceivableReportPage');

/**
 * Built from Jin's screenshot of the "Reports Format" dialog — template
 * default is "Unapply Advance Payment By Summary" (pre-highlighted, first
 * row; the catalog has several duplicate System/ADMIN-owned rows with the
 * same name, so previewReport()'s first-match click lands on the
 * pre-highlighted default). `handleAsyncReportOutputIfPresent()` called
 * unconditionally per the established convention for this category.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Account Receivable > Unapply Advance Payment', () => {

  test('[Happy Path] views, previews, and prints the Unapply Advance Payment report', async ({ page }) => {
    test.setTimeout(90000);
    const arReportPage = new AccountReceivableReportPage(page);
    await arReportPage.goto('Unapply Advance Payment');

    await arReportPage.viewGrid();
    await arReportPage.previewReport('Unapply Advance Payment By Summary');
    await arReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await arReportPage.printReport();
    expect(arReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/unapply-advance-payment-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
