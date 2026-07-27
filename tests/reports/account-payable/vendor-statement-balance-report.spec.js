const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { AccountPayableReportPage } = require('../../../framework/pages/accountPayableReportPage');

/**
 * CONFIRMED via live run (2026-07-26) — Jin asked for this one from
 * pattern alone ("大同小异", no codegen/screenshot this time), unlike
 * Vendor Outstanding/Aging/Balance which all came from his own
 * recordings. Built on the "one core shape" pattern first, then verified
 * live myself since there was no recording as a safety net.
 *
 * One guess was wrong, fixed from the real dialog, not re-guessed: the
 * "Reports Format" template options here are "Vendor Statement 6 Month"
 * (pre-highlighted default) and "Vendor Statement 12 Month" — NOT
 * "Vendor Statement Balance" (the catalog/report name), which was the
 * naive first guess and doesn't exist as a template option. Same
 * "6 Month / 12 Month" naming shape as Vendor Aging's "- 4/6/12 Months".
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Account Payable > Vendor Statement Balance', () => {

  test('[Happy Path] views, previews, and prints the Vendor Statement Balance report', async ({ page }) => {
    test.setTimeout(90000);
    const apReportPage = new AccountPayableReportPage(page);
    await apReportPage.goto('Vendor Statement Balance');

    await apReportPage.viewGrid();
    await apReportPage.previewReport('Vendor Statement 6 Month');

    const reportPage = await apReportPage.printReport();
    expect(apReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/vendor-statement-balance-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
