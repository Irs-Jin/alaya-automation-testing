const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { AccountReceivableReportPage } = require('../../../framework/pages/accountReceivableReportPage');

/**
 * Built from Jin's screenshot of the "Reports Format" dialog — catalog nav
 * entry is "AR Credit Note Analysis" (no slash), but the pre-highlighted
 * default template row is "A/R Credit Note Analysis" (WITH slash) — same
 * "A/P" vs "AP" naming quirk seen on Account Payable's Credit/Debit Note
 * Analysis reports, mirrored here as "A/R" vs "AR". Customer field
 * defaults to ALL, so selectAllCustomersIfNeeded() self-skips.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Account Receivable > AR Credit Note Analysis', () => {

  test('[Happy Path] views, previews, and prints the AR Credit Note Analysis report', async ({ page }) => {
    test.setTimeout(90000);
    const arReportPage = new AccountReceivableReportPage(page);
    await arReportPage.goto('AR Credit Note Analysis');

    await arReportPage.selectAllCustomersIfNeeded();
    await arReportPage.viewGrid();
    await arReportPage.previewReport('A/R Credit Note Analysis');
    await arReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await arReportPage.printReport();
    expect(arReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/ar-credit-note-analysis-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
