const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { CashSalesPage } = require('../../framework/pages/cashSalesPage');

/**
 * PILOT (Jin, 2026-07-24): converted from the Katalon "CSN" (Cash Sales New)
 * test case, then actually RUN against the real SIT instance
 * (sit.irsbizsuite.com.my) to validate the conversion approach. Scope is
 * deliberately narrow — select a customer, add one item line, stop there.
 * Draft/Post/Copy-From-DO-SO-SQ and MultiPayment are NOT converted yet; see
 * framework/pages/cashSalesPage.js for the full confirmed-vs-open
 * breakdown, including the important correction that "New" does not save
 * (it resets the form) — persistence needs Save Draft + MultiPayment,
 * out of scope for this pass.
 *
 * STATUS: both cases below PASS cleanly against client UAT (user admin)
 * using the original Katalon test data ("000001" / "BISKUT PLANTA") — that
 * data turns out to be real in UAT specifically (customer "000001" =
 * "YEONG", matching the Katalon Object Repository's recorded neighbor text).
 * Run it there with:
 *
 *   ALAYA_CLIENT_ID=UAT ALAYA_USERNAME=admin ALAYA_PASSWORD=<pw> \
 *   ALAYA_TEST_CUSTOMER_CODE=000001 ALAYA_TEST_ITEM_DESCRIPTION="BISKUT PLANTA" \
 *   npx playwright test tests/sales/cash-sales.spec.js
 *
 * customerCode / itemDescription default below to values confirmed to exist
 * in qa3 instead (qa3 is .env's default client) — qa3's customer codes are
 * 9-digit (e.g. "000000002") and its 300 seeded items are test junk like
 * "RRR", "www0www"; it does NOT have "000001"/"BISKUT PLANTA". Different
 * clients have entirely different master data — override via env vars
 * rather than editing this file when pointing at yet another client:
 *
 *   ALAYA_TEST_CUSTOMER_CODE=<code> ALAYA_TEST_ITEM_DESCRIPTION=<name> npm test
 */
const CUSTOMER_CODE = process.env.ALAYA_TEST_CUSTOMER_CODE || '000000002';
const ITEM_DESCRIPTION = process.env.ALAYA_TEST_ITEM_DESCRIPTION || 'www0www';

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Sales > Cash Sales > New', () => {

  test('[Happy Path] adds a customer and one item line to a new cash sales entry', async ({ page }) => {
    // BUG FIXED (2026-07-27): this test never had an explicit timeout,
    // silently relying on the global 30s default. Confirmed live: fails
    // deep into the full suite run under sustained server load ("Test
    // timeout of 30000ms exceeded" while waiting for the customer-picker
    // popup's cell) — and failed identically on the automatic retry too,
    // since the same load conditions were still in effect. Not a selector
    // bug; matches the same "too tight once the server is under load"
    // class of issue already fixed in the report-printing timeouts.
    test.setTimeout(90000);
    const cashSalesPage = new CashSalesPage(page);
    await cashSalesPage.goto();

    await cashSalesPage.createCashSales({
      customerCode: CUSTOMER_CODE,
      itemDescription: ITEM_DESCRIPTION,
    });

    expect(await cashSalesPage.hasItemRow(ITEM_DESCRIPTION)).toBe(true);
  });

  test('[Happy Path] posts a new cash sales entry with CASH payment', async ({ page }) => {
    test.setTimeout(90000);
    const cashSalesPage = new CashSalesPage(page);
    await cashSalesPage.goto();

    await cashSalesPage.postCashSales({
      customerCode: CUSTOMER_CODE,
      itemDescription: ITEM_DESCRIPTION,
      paymentMode: 'CASH',
    });

    const posted = await cashSalesPage.expectPostSuccess();
    expect(posted).toBe(true);

    // Strongest available proof the Post actually worked, not just an
    // internal field check: click "Print" on the auto-opened GST report
    // and confirm a real print-preview tab opens — this is Katalon CSP.tc's
    // own final verification step (it clicks the same button next), now
    // made an explicit assertion instead of an unchecked afterthought.
    const reportPage = await cashSalesPage.printReport();
    expect(cashSalesPage.isReportPageValid(reportPage)).toBe(true);

    // Config only auto-captures screenshots on failure — take one here
    // regardless of outcome, of the actual rendered report PDF (the
    // strongest visual proof), not just the dimmed main form.
    await reportPage.screenshot({ path: 'test-results/cash-sales-post-report.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });

  test('[Negative] item search is blocked until a customer is selected', async ({ page }) => {
    test.setTimeout(60000);
    const cashSalesPage = new CashSalesPage(page);
    await cashSalesPage.goto();

    // Confirmed live: clicking the item search trigger before a customer is
    // chosen doesn't open the item popup at all — it just re-surfaces the
    // "Customer is required" validation banner. Don't call selectItem()
    // here — it would hang waiting for a popup that never opens.
    const f = await cashSalesPage.fields();
    await f.itemTrigger.click();

    const errors = await cashSalesPage.getValidationErrors();
    expect(errors.join(' ')).toMatch(/customer/i);
  });

});
