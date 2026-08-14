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
// BUG FIXED (2026-08-14): "www0www" no longer exists in qa3's item catalog
// for the SHANTHI QA BIZ 69 company (confirmed live via the item picker's
// own browsable grid — 300 items, "www0www" not among them). Replaced
// with "stock item 01" (item code 000014, qty available 81), confirmed
// present and unambiguous (unlike "RRR", which this catalog has three of).
const ITEM_DESCRIPTION = process.env.ALAYA_TEST_ITEM_DESCRIPTION || 'stock item 01';

// BUG FIXED (2026-08-14): selecting a customer does NOT auto-fill Sales
// Branch / Warehouse for the SHANTHI QA BIZ 69 company (qa3/yew) — Post/
// Save Draft fail outright without them ("Sales Branch is required" /
// "Warehouse is required"). CashSalesPage.ensureComboSelected() only fills
// these in when they're genuinely still empty, so this is a no-op on
// accounts where auto-fill already works. Values confirmed live via each
// combo's own dropdown listbox (Code column) for qa3 specifically —
// override via env vars the same way as CUSTOMER_CODE/ITEM_DESCRIPTION
// when pointing at yet another client.
const SALES_BRANCH_CODE = process.env.ALAYA_TEST_SALES_BRANCH_CODE || 'SHAQABIZ69';
const WAREHOUSE_CODE = process.env.ALAYA_TEST_WAREHOUSE_CODE || 'PRIMARY';

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Sales > Cash Sales > New', () => {

  const testData = {
    customerCode: CUSTOMER_CODE,
    itemDescription: ITEM_DESCRIPTION,
    salesBranchCode: SALES_BRANCH_CODE,
    warehouseCode: WAREHOUSE_CODE,
    paymentMode: 'CASH',
  };

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

    await cashSalesPage.createCashSales(testData);

    expect(await cashSalesPage.hasItemRow(testData.itemDescription)).toBe(true);
  });

  test('[Happy Path] posts a new cash sales entry with CASH payment', async ({ page }) => {
    test.setTimeout(90000);
    const cashSalesPage = new CashSalesPage(page);
    await cashSalesPage.goto();

    await cashSalesPage.postCashSales(testData);

    const posted = await cashSalesPage.expectPostSuccess();
    expect(posted).toBe(true);

    // Strongest available proof the Post actually worked, not just an
    // internal field check: click "Print" on the auto-opened GST report
    // and confirm a real print-preview tab opens — this is Katalon CSP.tc's
    // own final verification step (it clicks the same button next), now
    // made an explicit assertion instead of an unchecked afterthought.
    const reportResult = await cashSalesPage.printReport();
    expect(cashSalesPage.isReportPageValid(reportResult)).toBe(true);

    // BUG FIXED (2026-07-27): printReport() confirmed live to return a
    // Playwright Download object in the common case (the print button
    // triggers a genuine PDF download, not a page navigation) — a
    // Download has no .screenshot()/.close(), only a Page does.
    // OPTIMIZED (2026-08-11): moved artifact handling logic into POM.
    await cashSalesPage.saveReportArtifact(reportResult, 'cash-sales-post-report');
  });

  test('[Negative] item search is blocked until a customer is selected', async ({ page }) => {
    test.setTimeout(60000);
    const cashSalesPage = new CashSalesPage(page);
    await cashSalesPage.goto();

    // Confirmed live: clicking the item search trigger before a customer is
    // chosen doesn't open the item popup at all — it just re-surfaces the
    // "Customer is required" validation banner.
    // OPTIMIZED (2026-08-11): moved direct field access into POM method.
    await cashSalesPage.triggerItemSearchWithoutCustomer();

    const errors = await cashSalesPage.getValidationErrors();
    expect(errors.join(' ')).toMatch(/customer/i);
  });
});
