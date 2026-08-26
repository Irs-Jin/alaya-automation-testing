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
 * UPDATED (2026-08-20): the shared `uat` login's default company changed
 * server-side from qa3/SHANTHI QA BIZ 69 to UAT/TANJAK MEGA GROUP SDN BHD
 * (see purchase-order.spec.js's own header comment for the full context).
 * Re-probed live and confirmed real: Vendor "000001" (HAZEL CORP),
 * Warehouse "AMPANG", item "BISKUT PLANTA" — same values now used across
 * the rest of this module's specs, plus the same Delivery Address this
 * screen specifically requires (Address1 + City — City still defaults to
 * "PUCHONG", unchanged by the company switch — confirmed still valid via
 * every Sales-module screen with this same control this session).
 * Different clients/companies will have different master data — override
 * via env vars rather than editing this file when pointing at another one.
 */
const VENDOR_CODE = process.env.ALAYA_TEST_VENDOR_CODE || '000001';
const WAREHOUSE_CODE = process.env.ALAYA_TEST_WAREHOUSE_CODE || 'AMPANG';
const ITEM_CODE = process.env.ALAYA_TEST_ITEM_CODE || 'BISKUT PLANTA';

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

  test('[Cancel] posts a Purchase Return then cancels it from the listing page', async ({ page }) => {
    // BUG FIXED (2026-08-17) / re-confirmed live for this test (2026-08-18):
    // the base 3-hop chain (Purchase Order -> Purchase Invoice -> Purchase
    // Return) alone already needed 240000ms under load. This test adds a
    // fourth real server round-trip on top of that (navigating back to the
    // listing and cancelling the posted document), so it gets an even wider
    // budget.
    test.setTimeout(300000);
    const piDocNo = await createFreshPurchaseInvoice(page);

    const purchaseReturnPage = new PurchaseReturnPage(page);
    await purchaseReturnPage.goto();
    await purchaseReturnPage.clickNew();

    // This screen has no working Save Draft (see PurchaseReturnPage's own
    // class comment) — Post is the only way to create a document to
    // cancel. getNextPossibleNo() is read right after clickNew(), same
    // established technique this screen's own [Post & New] test already
    // uses as before/after proof, reused here as the search key for the
    // listing after posting (no free-text reference field exists on this
    // screen to use instead).
    const prNo = await purchaseReturnPage.getNextPossibleNo();
    expect(prNo).toMatch(/PR-\d+/);

    await purchaseReturnPage.prepareReturn({ vendorCode: VENDOR_CODE, piDocNo });
    await purchaseReturnPage.clickPost();
    expect(await purchaseReturnPage.expectPostSuccess()).toBe(true);

    await purchaseReturnPage.cancelDocument(prNo);

    // Per this repo's convention: a success dialog isn't proof by itself —
    // verify with a fresh search that the row is genuinely gone from the
    // active listing view.
    expect(await purchaseReturnPage.isDocumentPresent(prNo)).toBe(false);
  });
});
