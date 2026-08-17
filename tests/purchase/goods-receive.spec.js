const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { PurchaseOrderPage } = require('../../framework/pages/purchaseOrderPage');
const { GoodsReceivePage } = require('../../framework/pages/goodsReceivePage');

/**
 * No recording available for this screen — built by live-probing the real
 * app directly (2026-08-17), per the user's own description ("similar
 * like Purchase Order, use Copy From to get the details"). Confirmed live
 * to share the same New -> select Vendor -> Copy From > Purchase Order ->
 * "Transfer from PO" dialog -> Post shape as close-purchase-order.spec.js,
 * plus its own required "Supplier D/O No." field — see
 * GoodsReceivePage.fillSupplierDoNo().
 *
 * Same test-independence reasoning as close-purchase-order.spec.js: this
 * creates its own fresh Purchase Order first rather than depending on
 * whatever open PO happens to already exist in the shared environment.
 *
 * Test data confirmed live (2026-08-17) against qa3/SHANTHI QA BIZ 69,
 * same values as purchase-order.spec.js / close-purchase-order.spec.js.
 * Different clients/companies will have different master data — override
 * via env vars rather than editing this file when pointing at another one.
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

test.describe('Purchase > Goods Receive', () => {

  test('[Happy Path] receives goods against a freshly created Purchase Order via Transfer from PO', async ({ page }) => {
    test.setTimeout(120000);

    // Setup: a fresh, guaranteed-open PO to receive against.
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

    // Under test: receive goods against that exact PO.
    const goodsReceivePage = new GoodsReceivePage(page);
    await goodsReceivePage.goto();
    await goodsReceivePage.clickNew();
    await goodsReceivePage.receiveGoods({ vendorCode: VENDOR_CODE, poDocNo });

    expect(await goodsReceivePage.expectPostSuccess()).toBe(true);
  });
});
