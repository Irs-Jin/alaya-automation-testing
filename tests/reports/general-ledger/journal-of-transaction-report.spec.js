const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { GeneralLedgerReportPage } = require('../../../framework/pages/generalLedgerReportPage');

/**
 * Converted directly from a Playwright codegen recording Jin made himself
 * against the live UAT instance (Reports > General Ledger > Journal Of
 * Transaction > View Grid -> Preview Report > Journal Of Transaction
 * template -> Preview -> Print). Same category/nav path as the sibling
 * General Ledger report (#sub13) — reuses GeneralLedgerReportPage as-is,
 * just parametrized with this report's own name; see that page object's
 * header comment for why it covers more than just the literally-named
 * "General Ledger" report, and for the full multi-iframe structure writeup
 * (unchanged here — zero structural differences between the two reports).
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > General Ledger > Journal Of Transaction', () => {
  // Same rationale as the General Ledger report spec: reaching the
  // print-preview tab with real content IS success; report generation is
  // slow, not flaky, so retrying just doubles the wait for no benefit.

  test('[Happy Path] views, previews, and prints the Journal Of Transaction report', async ({ page }) => {
    test.setTimeout(90000);
    const jotReportPage = new GeneralLedgerReportPage(page);
    await jotReportPage.goto('Journal Of Transaction');

    await jotReportPage.viewGrid();
    await jotReportPage.previewReport('Journal Of Transaction');

    const reportTab = await jotReportPage.printReport();
    expect(jotReportPage.isReportPageValid(reportTab)).toBe(true);

    await reportTab.screenshot({ path: 'test-results/journal-of-transaction-report-print.png', fullPage: true }).catch(() => {});
    await reportTab.close().catch(() => {});
  });

});
