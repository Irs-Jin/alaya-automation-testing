const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { AccountPayableReportPage } = require('../../../framework/pages/accountPayableReportPage');

/**
 * Converted directly from a Playwright codegen recording Jin made himself
 * (Reports > Account Payable > View Grid -> Preview Report -> Preview ->
 * Print) — same shape as Vendor Outstanding, one difference: this
 * recording never explicitly clicked a template row before "Preview".
 * The "Reports Format" dialog's first row ("Vendor Aging - 4 Months")
 * comes pre-highlighted, and clicking Preview directly confirms whatever
 * is already selected — confirmed by the resulting PDF title, "Vendor
 * Aging (4-Months) As At 26/07/2026". `previewReport()`'s existing
 * template-cell click still works fine here (clicking an already-
 * highlighted row is harmless), so no page-object change was needed —
 * just call it with the matching template name explicitly rather than
 * relying on the dialog's default going unclicked.
 *
 * Print button lives in a frame literally named " 4 Months Report" (note
 * the leading space) in this recording — not hardcoded, same as every
 * other report here; `printReport()` already scans all frames generically.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Account Payable > Vendor Aging', () => {
  test.describe.configure({ retries: 0 });

  test('[Happy Path] views, previews, and prints the Vendor Aging report', async ({ page }) => {
    // Bumped past the usual 90s (see accountPayableReportPage.js's
    // printReport() comment) — this report's data volume genuinely needs
    // longer to render than Vendor Outstanding did.
    test.setTimeout(150000);
    const apReportPage = new AccountPayableReportPage(page);
    await apReportPage.goto('Vendor Aging');

    await apReportPage.viewGrid();
    await apReportPage.previewReport('Vendor Aging - 4 Months');

    const reportPage = await apReportPage.printReport();
    expect(apReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/vendor-aging-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
