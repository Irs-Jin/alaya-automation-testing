const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { AccountPayableReportPage } = require('../../../framework/pages/accountPayableReportPage');

/**
 * Built from Jin's screenshot of the "Reports Format" dialog (no full
 * codegen recording). BREAKS the "A/P" vs "AP" naming prediction that
 * held for Credit/Debit Note Analysis — this one uses plain "AP" (no
 * slash), matching the catalog name style: template name is
 * **"AP Payment Listing Summary By Project & Date"** (pre-highlighted
 * default; the other option is "AP Payment Listing Detail By Project &
 * Date"). Confirms the "A/P" naming gap is per-report, not a blanket
 * rule for the whole AP-prefixed family — don't assume it applies
 * without checking each screenshot. Same
 * `goto -> viewGrid -> previewReport -> printReport` shape as every
 * other report in this category.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Account Payable > AP Payment Listing', () => {

  test('[Happy Path] views, previews, and prints the AP Payment Listing report', async ({ page }) => {
    test.setTimeout(90000);
    const apReportPage = new AccountPayableReportPage(page);
    await apReportPage.goto('AP Payment Listing');

    await apReportPage.viewGrid();
    await apReportPage.previewReport('AP Payment Listing Summary By Project & Date');

    const reportPage = await apReportPage.printReport();
    expect(apReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/ap-payment-listing-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
