const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { PurchaseOrderPage } = require('../../framework/pages/purchaseOrderPage');
const { PurchaseInvoicePage } = require('../../framework/pages/purchaseInvoicePage');

/**
 * No recording available for this screen — built by live-probing the real
 * app directly (2026-08-17). Same shape as close-purchase-order.spec.js /
 * goods-receive.spec.js (New -> select Vendor -> Copy From > Purchase
 * Order -> Transfer from PO -> fill Supplier Inv. No.), but exercises all
 * three action buttons per the user's explicit request, each against its
 * own freshly created, still-open Purchase Order (confirmed live: a fully
 * RECEIVED PO drops out of every Transfer-from-PO picker project-wide, so
 * each test needs its own untouched PO — never the same one twice).
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

/** Creates a fresh, guaranteed-open PO and returns its document number. */
async function createFreshPurchaseOrder(page) {
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
  return poDocNo;
}

test.describe('Purchase > Purchase Invoice', () => {

  test('[Save Draft] saves a Purchase Invoice transferred from a Purchase Order', async ({ page }) => {
    test.setTimeout(120000);
    const poDocNo = await createFreshPurchaseOrder(page);

    const purchaseInvoicePage = new PurchaseInvoicePage(page);
    await purchaseInvoicePage.goto();
    await purchaseInvoicePage.clickNew();
    await purchaseInvoicePage.prepareInvoice({ vendorCode: VENDOR_CODE, poDocNo });
    await purchaseInvoicePage.clickSaveDraft();

    expect(await purchaseInvoicePage.expectSaveDraftSuccess()).toBe(true);
  });

  test('[Post] posts a Purchase Invoice transferred from a Purchase Order', async ({ page }) => {
    test.setTimeout(120000);
    const poDocNo = await createFreshPurchaseOrder(page);

    const purchaseInvoicePage = new PurchaseInvoicePage(page);
    await purchaseInvoicePage.goto();
    await purchaseInvoicePage.clickNew();
    await purchaseInvoicePage.prepareInvoice({ vendorCode: VENDOR_CODE, poDocNo });
    await purchaseInvoicePage.clickPost();

    expect(await purchaseInvoicePage.expectPostSuccess()).toBe(true);
  });

  test('[Post & New] posts a Purchase Invoice and resets the form for the next entry', async ({ page }) => {
    test.setTimeout(120000);
    const poDocNo = await createFreshPurchaseOrder(page);

    const purchaseInvoicePage = new PurchaseInvoicePage(page);
    await purchaseInvoicePage.goto();
    await purchaseInvoicePage.clickNew();
    const beforeNo = await purchaseInvoicePage.getNextPossibleNo();
    await purchaseInvoicePage.prepareInvoice({ vendorCode: VENDOR_CODE, poDocNo });
    await purchaseInvoicePage.clickPostAndNew();

    // BUG FIXED (2026-08-17): Post & New does NOT auto-open a report tab
    // the way plain Post does (confirmed live) - the form resetting to
    // blank alone doesn't distinguish "posted, then reset" from "just
    // reset without posting", so this checks the possible-next-number
    // actually advanced too, proving a real document was consumed.
    expect(await purchaseInvoicePage.expectFormReset()).toBe(true);
    const afterNo = await purchaseInvoicePage.getNextPossibleNo();
    expect(afterNo).not.toBe(beforeNo);
  });
});
