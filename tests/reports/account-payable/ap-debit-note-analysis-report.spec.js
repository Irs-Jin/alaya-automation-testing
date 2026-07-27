const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { AccountPayableReportPage } = require('../../../framework/pages/accountPayableReportPage');

/**
 * Built from Jin's screenshot of the "Reports Format" dialog (no full
 * codegen recording). Same "A/P" vs "AP" naming gap predicted after AP
 * Credit Note Analysis, confirmed here too: the template name is
 * **"A/P Debit Note Analysis"** (with a slash) — not "AP Debit Note
 * Analysis" like the nav/catalog entry. Verified live before trusting
 * it. Same `goto -> viewGrid -> previewReport -> printReport` shape as
 * every other report in this category.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Account Payable > AP Debit Note Analysis', () => {
  test.describe.configure({ retries: 0 });

  test('[Happy Path] views, previews, and prints the AP Debit Note Analysis report', async ({ page }) => {
    test.setTimeout(90000);
    const apReportPage = new AccountPayableReportPage(page);
    await apReportPage.goto('AP Debit Note Analysis');

    await apReportPage.viewGrid();
    await apReportPage.previewReport('A/P Debit Note Analysis');

    const reportPage = await apReportPage.printReport();
    expect(apReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/ap-debit-note-analysis-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
