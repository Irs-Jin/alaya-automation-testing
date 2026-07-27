const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { GeneralLedgerReportPage } = require('../../../framework/pages/generalLedgerReportPage');

/**
 * Converted from Jin's manual walkthrough (2026-07-26), not a codegen
 * recording — same core shape as every other report here (see the
 * corrected archetype note in generalLedgerReportPage.js), plus one
 * report-specific prerequisite: a Bank must be selected via a search popup
 * first (selectBank() — UNCONFIRMED, no recording yet; same shape as Cash
 * Sales's customer/item popups). `viewGrid()` is still called for
 * consistency with every other spec — self-skips if this report has no
 * such button, matching what was actually seen in Jin's screenshot (no
 * View Grid on this form). The terminal step also differs: there is NO
 * print step at all — success is just reaching a plain instructional
 * message ("Please do bank reconciliation for related month."), not a
 * rendered/printed report.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > General Ledger > Bank Reconciliations', () => {

  test('[Happy Path] reaches the Bank Reconciliation report message', async ({ page }) => {
    test.setTimeout(90000);
    const reportPage = new GeneralLedgerReportPage(page);
    await reportPage.goto('Bank Reconciliations');

    await reportPage.selectBank('310-0000');
    await reportPage.viewGrid();
    await reportPage.previewReport('Bank Reconciliation');

    // No printReport() here — this report doesn't produce a print/PDF flow,
    // just an instructional message. Reaching it IS success (per Jin).
    const reached = await reportPage.expectReportMessage(/Please do bank reconciliation for related month\./i);
    expect(reached).toBe(true);
  });

});
