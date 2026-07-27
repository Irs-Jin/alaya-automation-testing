const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { GeneralLedgerReportPage } = require('../../../framework/pages/generalLedgerReportPage');

/**
 * Converted directly from a Playwright codegen recording Jin made himself
 * against the live UAT instance (Reports > General Ledger > View Grid ->
 * Preview Report > General Ledger template > Preview > Print) — this
 * module has no Katalon equivalent to fall back on, so the codegen
 * recording IS the ground truth. See
 * framework/pages/generalLedgerReportPage.js for the full structure
 * writeup (multi-iframe flow, why literal iframe names from the recording
 * aren't hardcoded).
 *
 * Success criterion mirrors what Jin manually confirmed: the flow isn't
 * "done" until clicking Print actually opens a real print-preview tab —
 * same bar as the Cash Sales Post pilot's printReport() check.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > General Ledger', () => {
  // Confirmed live (Jin, 2026-07-26): reaching the print-preview tab with
  // real report content IS the success bar here — a multi-page report is
  // just slow to generate server-side, not flaky, so retrying only doubles
  // that wait for no benefit. No retries for this test.
  test.describe.configure({ retries: 0 });

  test('[Happy Path] views, previews, and prints the General Ledger report', async ({ page }) => {
    // The repeated timeouts here were never really about duration — see
    // generalLedgerReportPage.js's printReport() comment: it was listening
    // for a `browserContext` event ('popup') that doesn't exist, so it was
    // guaranteed to time out no matter the value. Fixed to the correct
    // event ('page'), which should resolve quickly. Kept a generous
    // overall budget anyway since report render time does still vary.
    test.setTimeout(90000);
    const glReportPage = new GeneralLedgerReportPage(page);
    await glReportPage.goto('General Ledger');

    await glReportPage.viewGrid();
    await glReportPage.previewReport('General Ledger');

    const reportPage = await glReportPage.printReport();
    expect(glReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/general-ledger-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });

});
