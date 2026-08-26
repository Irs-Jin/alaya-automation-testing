const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { PurchaseOrderPage } = require('../../framework/pages/purchaseOrderPage');
const { ClosePurchaseOrderPage } = require('../../framework/pages/closePurchaseOrderPage');

/**
 * Converted from a screen recording the user provided (Close Purchase
 * Order Flow 1, 2026-08-17): New -> select Vendor -> Copy From > Purchase
 * Order -> check an existing open PO in the "Transfer from PO" dialog ->
 * OK -> Warehouse + Items auto-fill from that PO -> Post -> auto-opened
 * GST report tab.
 *
 * Closing a PO consumes it, so this test creates its OWN fresh Purchase
 * Order first (via PurchaseOrderPage) rather than depending on whatever
 * happens to still be open in the shared environment — a repeatable test
 * can't assume any pre-existing PO hasn't already been closed by an
 * earlier run or another QA's test.
 *
 * UPDATED (2026-08-20): the shared `uat` login's default company changed
 * server-side from qa3/SHANTHI QA BIZ 69 to UAT/TANJAK MEGA GROUP SDN BHD
 * (see purchase-order.spec.js's own header comment for the full context).
 * Re-probed live and confirmed real: Vendor "000001" (HAZEL CORP),
 * Warehouse "AMPANG", item "BISKUT PLANTA" — same values now used across
 * the rest of this module's specs. Different clients/companies will have
 * different master data — override via env vars rather than editing this
 * file when pointing at another one.
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

test.describe('Purchase > Close Purchase Order', () => {

  test('[Happy Path] closes a freshly created Purchase Order via Transfer from PO', async ({ page }) => {
    test.setTimeout(120000);

    // Setup: a fresh, guaranteed-open PO to close.
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

    // Under test: close that exact PO.
    const closePurchaseOrderPage = new ClosePurchaseOrderPage(page);
    await closePurchaseOrderPage.goto();
    await closePurchaseOrderPage.clickNew();
    await closePurchaseOrderPage.closePurchaseOrder({ vendorCode: VENDOR_CODE, poDocNo });

    expect(await closePurchaseOrderPage.expectPostSuccess()).toBe(true);
  });

  test('[Cancel] closes a Purchase Order then cancels the Close Purchase Order from the listing page', async ({ page }) => {
    test.setTimeout(180000);

    // Setup: a fresh, guaranteed-open PO to close.
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

    // Close that PO, then cancel the resulting Close Purchase Order
    // document itself (not the underlying PO).
    const closePurchaseOrderPage = new ClosePurchaseOrderPage(page);
    await closePurchaseOrderPage.goto();
    await closePurchaseOrderPage.clickNew();
    await closePurchaseOrderPage.closePurchaseOrder({ vendorCode: VENDOR_CODE, poDocNo });
    expect(await closePurchaseOrderPage.expectPostSuccess()).toBe(true);
    const xpDocNo = await closePurchaseOrderPage.getClosedDocumentNumber();
    expect(xpDocNo).toMatch(/XP-\d+/);

    await closePurchaseOrderPage.cancelDocument(xpDocNo);

    // Per this repo's convention: a success dialog isn't proof by itself —
    // verify with a fresh search that the row is genuinely gone from the
    // active (DRAFT + POSTED) listing view.
    expect(await closePurchaseOrderPage.isDocumentPresent(xpDocNo)).toBe(false);
  });
});
