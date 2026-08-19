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
 *
 * UPDATED (2026-08-19): the shared `uat` login's default company changed
 * server-side from qa3/SHANTHI QA BIZ 69 to UAT/TANJAK MEGA GROUP SDN BHD
 * (confirmed live via the footer's "Client ID:" label after a machine
 * restart) — every other Sales-module spec had qa3-specific defaults that
 * no longer resolve to anything for this login, so they're now flipped
 * back to this file's own original, still-valid Katalon-era UAT data
 * ("000001" / "BISKUT PLANTA") as the shared default across the whole
 * module. Different clients/companies will have different master data —
 * override via env vars rather than editing this file when pointing at
 * another one:
 *
 *   ALAYA_TEST_CUSTOMER_CODE=<code> ALAYA_TEST_ITEM_DESCRIPTION=<name> npm test
 */
const CUSTOMER_CODE = process.env.ALAYA_TEST_CUSTOMER_CODE || '000001';
const ITEM_DESCRIPTION = process.env.ALAYA_TEST_ITEM_DESCRIPTION || 'BISKUT PLANTA';

// Sales Branch "T01" (AMIRUL HALAL MART (TAMBUN)) re-confirmed live
// (2026-08-19) against TANJAK MEGA GROUP SDN BHD — see the header comment's
// note on the company switch. CashSalesPage.ensureComboSelected() only
// fills Sales Branch / Warehouse in when they're genuinely still empty, so
// this is a no-op on accounts where auto-fill already works.
const SALES_BRANCH_CODE = process.env.ALAYA_TEST_SALES_BRANCH_CODE || 'T01';
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
