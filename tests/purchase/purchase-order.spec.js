const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { PurchaseOrderPage } = require('../../framework/pages/purchaseOrderPage');

/**
 * Converted from a screen recording the user provided (Purchase Order Flow
 * 1, 2026-08-17): New -> select Vendor -> select Warehouse -> add one item
 * (accepting the "already exists in previous PO" prompt) -> Post ->
 * auto-opened GST report tab -> back to the listing grid showing the new
 * POSTED record. Same shape as cash-sales.spec.js per the user's explicit
 * instruction ("same like testing for Cash Sales").
 *
 * UPDATED (2026-08-20): the shared `uat` login's default company changed
 * server-side from qa3/SHANTHI QA BIZ 69 to UAT/TANJAK MEGA GROUP SDN BHD
 * (same change already documented in the Sales module's own specs — see
 * tests/sales/quotation.spec.js's header comment) — the old qa3-era
 * Vendor/Warehouse/Item defaults below never actually resolved against
 * UAT in the first place (this file's own prior comment already flagged
 * them as qa3-only, unconfirmed against UAT). Re-probed live and confirmed
 * real: Vendor "000001" (HAZEL CORP), Warehouse "AMPANG", item "BISKUT
 * PLANTA" (same item already used across the whole Sales module) — matched
 * by exact Description text, same as PurchaseOrderPage.selectItem()'s own
 * convention. Different clients/companies will have different master
 * data — override via env vars rather than editing this file when
 * pointing at another one.
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

test.describe('Purchase > Purchase Order', () => {

  const testData = {
    vendorCode: VENDOR_CODE,
    warehouseCode: WAREHOUSE_CODE,
    itemDescription: ITEM_CODE,
  };

  test('[Happy Path] adds a vendor and one item line to a new Purchase Order', async ({ page }) => {
    test.setTimeout(90000);
    const purchaseOrderPage = new PurchaseOrderPage(page);
    await purchaseOrderPage.goto();

    await purchaseOrderPage.clickNew();
    await purchaseOrderPage.createPurchaseOrder(testData);

    expect(await purchaseOrderPage.hasItemRow(ITEM_CODE)).toBe(true);
  });

  test('[Happy Path] posts a new Purchase Order with one item', async ({ page }) => {
    test.setTimeout(90000);
    const purchaseOrderPage = new PurchaseOrderPage(page);
    await purchaseOrderPage.goto();

    await purchaseOrderPage.clickNew();
    await purchaseOrderPage.postPurchaseOrder(testData);

    expect(await purchaseOrderPage.expectPostSuccess()).toBe(true);
  });

  test('[Cancel] posts a Purchase Order then cancels it from the listing page', async ({ page }) => {
    test.setTimeout(180000);
    const purchaseOrderPage = new PurchaseOrderPage(page);
    await purchaseOrderPage.goto();

    await purchaseOrderPage.clickNew();
    await purchaseOrderPage.postPurchaseOrder(testData);
    expect(await purchaseOrderPage.expectPostSuccess()).toBe(true);
    const poDocNo = await purchaseOrderPage.getPostedDocumentNumber();
    expect(poDocNo).toMatch(/PO-\d+/);

    await purchaseOrderPage.cancelDocument(poDocNo);

    // Per this repo's convention: a success dialog isn't proof by itself —
    // verify with a fresh search that the row is genuinely gone from the
    // active (DRAFT + POSTED) listing view.
    expect(await purchaseOrderPage.isDocumentPresent(poDocNo)).toBe(false);
  });
});
