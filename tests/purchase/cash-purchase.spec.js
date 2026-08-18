const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { CashPurchasePage } = require('../../framework/pages/cashPurchasePage');

/**
 * No recording available for this screen — built by live-probing the real
 * app directly (2026-08-17). Unlike the rest of this module (Purchase
 * Order / Close Purchase Order / Goods Receive / Purchase Invoice /
 * Purchase Return), Cash Purchase does NOT chain off another document —
 * it's a direct, standalone entry (Vendor + Warehouse + item, paid
 * immediately), same shape as Sales' own Cash Sales.
 *
 * Two real discoveries specific to this screen, confirmed live:
 * - The item search trigger does nothing but re-surface a "Supplier Inv
 *   No is required" validation banner if clicked before that field is
 *   filled — same "required field silently blocks the item picker" shape
 *   Cash Sales' own [Negative] test documents for its Customer field,
 *   just gating on a different field here.
 * - Being a CASH transaction, Save Draft AND Post both open a
 *   MultiPayment dialog (payment mode + amount) before completing — not
 *   just Post, unlike Purchase Invoice/Goods Receive. Same underlying
 *   component Cash Sales already uses, confirmed via identical id
 *   suffixes under a different module prefix (`pcCPMultipayment` vs.
 *   `pcCSMultipayment`).
 *
 * Test data confirmed live (2026-08-17) against qa3/SHANTHI QA BIZ 69,
 * same values as the rest of this module's specs. Different
 * clients/companies will have different master data — override via env
 * vars rather than editing this file when pointing at another one.
 */
const VENDOR_CODE = process.env.ALAYA_TEST_VENDOR_CODE || '000002';
const WAREHOUSE_CODE = process.env.ALAYA_TEST_WAREHOUSE_CODE || 'PRIMARY';
const ITEM_CODE = process.env.ALAYA_TEST_ITEM_CODE || '000001';

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Purchase > Cash Purchase', () => {

  const testData = {
    vendorCode: VENDOR_CODE,
    warehouseCode: WAREHOUSE_CODE,
    itemDescription: ITEM_CODE,
  };

  test('[Save Draft] saves a Cash Purchase with one item and a CASH payment', async ({ page }) => {
    test.setTimeout(120000);
    const cashPurchasePage = new CashPurchasePage(page);
    await cashPurchasePage.goto();
    await cashPurchasePage.clickNew();
    await cashPurchasePage.prepareCashPurchase(testData);
    await cashPurchasePage.clickSaveDraft();

    expect(await cashPurchasePage.expectSaveDraftSuccess()).toBe(true);
  });

  test('[Post] posts a Cash Purchase with one item and a CASH payment', async ({ page }) => {
    test.setTimeout(120000);
    const cashPurchasePage = new CashPurchasePage(page);
    await cashPurchasePage.goto();
    await cashPurchasePage.clickNew();
    await cashPurchasePage.prepareCashPurchase(testData);
    await cashPurchasePage.clickPost();

    expect(await cashPurchasePage.expectPostSuccess()).toBe(true);
  });

  test('[Post & New] posts a Cash Purchase and resets the form for the next entry', async ({ page }) => {
    test.setTimeout(120000);
    const cashPurchasePage = new CashPurchasePage(page);
    await cashPurchasePage.goto();
    await cashPurchasePage.clickNew();
    const beforeNo = await cashPurchasePage.getNextPossibleNo();
    await cashPurchasePage.prepareCashPurchase(testData);
    await cashPurchasePage.clickPostAndNew();

    // Post & New doesn't open a report tab (same shape already confirmed
    // for Purchase Invoice/Purchase Return) - checks the form reset AND
    // the possible-next-number advanced, proving a real document was
    // actually posted rather than just reset.
    expect(await cashPurchasePage.expectFormReset()).toBe(true);
    const afterNo = await cashPurchasePage.getNextPossibleNo();
    expect(afterNo).not.toBe(beforeNo);
  });

  test('[Cancel] creates a Draft then cancels it from the listing page', async ({ page }) => {
    test.setTimeout(180000);
    const cashPurchasePage = new CashPurchasePage(page);
    await cashPurchasePage.goto();
    await cashPurchasePage.clickNew();
    const uniqueRef = `TESTING-CANCEL-${Date.now()}`;
    await cashPurchasePage.prepareCashPurchase({ ...testData, supplierInvNo: uniqueRef });
    await cashPurchasePage.clickSaveDraft();
    expect(await cashPurchasePage.expectSaveDraftSuccess()).toBe(true);

    await cashPurchasePage.cancelDocument(uniqueRef);

    // Per this repo's convention: a success dialog isn't proof by itself —
    // verify with a fresh search that the row is genuinely gone from the
    // active (DRAFT + POSTED) listing view.
    expect(await cashPurchasePage.isDocumentPresent(uniqueRef)).toBe(false);
  });
});
