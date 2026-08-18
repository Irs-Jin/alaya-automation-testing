const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { findFrame } = require('../../framework/frameHelper');
const { PurchaseOrderPage } = require('../../framework/pages/purchaseOrderPage');
const { PurchaseInvoicePage } = require('../../framework/pages/purchaseInvoicePage');
const { PurchaseReturnPage } = require('../../framework/pages/purchaseReturnPage');

/**
 * No recording available for this screen — built by live-probing the real
 * app directly (2026-08-17). CONFIRMED live: Purchase Return copies from a
 * POSTED PURCHASE INVOICE, not a Purchase Order or Goods Receive (dialog
 * title "Transfer from PI") — so this suite's setup chain is
 * PO -> Purchase Invoice (posted) -> Purchase Return, never touching
 * Goods Receive for this screen's own tests.
 *
 * Only [Post] and [Post & New] are covered here — CONFIRMED live this
 * screen has NO working "Save Draft" (the title exists in the raw DOM,
 * shared with other Purchase screens' toolbar component, but is never
 * actually rendered on this screen; "More Options" opens a "Document
 * Info" popup instead of revealing it). See PurchaseReturnPage's own
 * class comment for the full explanation.
 *
 * Test data confirmed live (2026-08-17) against qa3/SHANTHI QA BIZ 69,
 * same values as the rest of this module's specs, plus a Delivery Address
 * this screen specifically requires (Address1 + City — City defaults to
 * "PUCHONG", this company's own registered city). Different
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

/** Creates a fresh PO, then a posted Purchase Invoice against it, and returns the PI's document number. */
async function createFreshPurchaseInvoice(page) {
  const purchaseOrderPage = new PurchaseOrderPage(page);
  await purchaseOrderPage.goto();
  await purchaseOrderPage.clickNew();
  await purchaseOrderPage.postPurchaseOrder({
    vendorCode: VENDOR_CODE,
    warehouseCode: WAREHOUSE_CODE,
    itemDescription: ITEM_CODE,
  });
  expect(await purchaseOrderPage.expectPostSuccess()).toBe(true);
  const poDocNo = await purchaseOrderPage.getPostedDocumentNumber();
  expect(poDocNo).toMatch(/PO-\d+/);

  const purchaseInvoicePage = new PurchaseInvoicePage(page);
  await purchaseInvoicePage.goto();
  await purchaseInvoicePage.clickNew();
  await purchaseInvoicePage.prepareInvoice({ vendorCode: VENDOR_CODE, poDocNo });
  await purchaseInvoicePage.clickPost();
  expect(await purchaseInvoicePage.expectPostSuccess()).toBe(true);

  // Read the posted PI's own document number from its report tab, same
  // approach as PurchaseOrderPage.getPostedDocumentNumber() — Purchase
  // Invoice doesn't have its own equivalent helper yet, so this reads it
  // directly here.
  const reportFrame = await findFrame(page, async (frame) => {
    const marker = frame.getByText('Purchase Inv. No', { exact: false });
    if ((await marker.count().catch(() => 0)) === 0) return false;
    return await marker.first().isVisible().catch(() => false);
  }, { timeout: 20000 });
  const text = await reportFrame.locator('body').innerText().catch(() => '');
  const match = text.match(/PI-\d+/);
  expect(match).not.toBeNull();
  return match[0];
}

test.describe('Purchase > Purchase Return', () => {

  test('[Post] posts a Purchase Return transferred from a Purchase Invoice', async ({ page }) => {
    // BUG FIXED (2026-08-17): 150000ms was confirmed live to be too tight
    // for this specific spec — it chains THREE real document creations
    // (Purchase Order -> Purchase Invoice -> Purchase Return), each its
    // own genuine server round-trip, one more hop than any other spec in
    // this module. A failure screenshot showed the flow had gotten all
    // the way through filling the Delivery Address and clicking Post
    // before the overall test timeout hit, proving the flow itself was
    // fine and only the total time budget was too small.
    test.setTimeout(240000);
    const piDocNo = await createFreshPurchaseInvoice(page);

    const purchaseReturnPage = new PurchaseReturnPage(page);
    await purchaseReturnPage.goto();
    await purchaseReturnPage.clickNew();
    await purchaseReturnPage.prepareReturn({ vendorCode: VENDOR_CODE, piDocNo });
    await purchaseReturnPage.clickPost();

    expect(await purchaseReturnPage.expectPostSuccess()).toBe(true);
  });

  test('[Post & New] posts a Purchase Return and resets the form for the next entry', async ({ page }) => {
    // BUG FIXED (2026-08-17): 150000ms was confirmed live to be too tight
    // for this specific spec — it chains THREE real document creations
    // (Purchase Order -> Purchase Invoice -> Purchase Return), each its
    // own genuine server round-trip, one more hop than any other spec in
    // this module. A failure screenshot showed the flow had gotten all
    // the way through filling the Delivery Address and clicking Post
    // before the overall test timeout hit, proving the flow itself was
    // fine and only the total time budget was too small.
    test.setTimeout(240000);
    const piDocNo = await createFreshPurchaseInvoice(page);

    const purchaseReturnPage = new PurchaseReturnPage(page);
    await purchaseReturnPage.goto();
    await purchaseReturnPage.clickNew();
    const beforeNo = await purchaseReturnPage.getNextPossibleNo();
    await purchaseReturnPage.prepareReturn({ vendorCode: VENDOR_CODE, piDocNo });
    await purchaseReturnPage.clickPostAndNew();

    expect(await purchaseReturnPage.expectFormReset()).toBe(true);
    const afterNo = await purchaseReturnPage.getNextPossibleNo();
    expect(afterNo).not.toBe(beforeNo);
  });
});
