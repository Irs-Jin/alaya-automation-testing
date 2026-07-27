const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { MembershipVoucherReportPage } = require('../../../framework/pages/membershipVoucherReportPage');

/**
 * First (and so far only) report in the Reports > Membership Voucher
 * category — built from Jin's screenshot of the catalog only (no
 * per-report "Reports Format" dialog screenshot or recording).
 * templateName is an UNCONFIRMED GUESS matching the catalog name. If
 * wrong, expect a live failure with a debug screenshot to correct it
 * from.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Membership Voucher > Voucher Utilization', () => {

  test('[Happy Path] views, previews, and prints the Voucher Utilization report', async ({ page }) => {
    test.setTimeout(90000);
    const membershipVoucherReportPage = new MembershipVoucherReportPage(page);
    await membershipVoucherReportPage.goto('Voucher Utilization');

    await membershipVoucherReportPage.switchCustomerToFilterBySelectionIfAll();
    await membershipVoucherReportPage.selectFirstCustomerIfNeeded();
    await membershipVoucherReportPage.viewGrid();
    await membershipVoucherReportPage.previewReport('Voucher Utilization');
    await membershipVoucherReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await membershipVoucherReportPage.printReport();
    expect(membershipVoucherReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/voucher-utilization-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
