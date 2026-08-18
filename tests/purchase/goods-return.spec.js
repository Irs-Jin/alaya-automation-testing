const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { findFrame } = require('../../framework/frameHelper');
const { PurchaseOrderPage } = require('../../framework/pages/purchaseOrderPage');
const { GoodsReceivePage } = require('../../framework/pages/goodsReceivePage');
const { GoodsReturnPage } = require('../../framework/pages/goodsReturnPage');

/**
 * No recording available — built by live-probing the real app directly
 * (2026-08-18) using the playwright-cli interactive tool (see
 * GoodsReturnPage's own class comment for the full shape/gotchas
 * discovered). CONFIRMED live: this screen copies from a POSTED GOODS
 * RECEIVE (dialog title "Transfer from GR"), so this suite's setup chain
 * is PO -> Goods Receive (posted) -> Goods Return, mirroring
 * purchase-return.spec.js's own PO -> Purchase Invoice -> Purchase Return
 * chain.
 *
 * Test data confirmed live (2026-08-18) against qa3/SHANTHI QA BIZ 69,
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

/** Creates a fresh PO, then a posted Goods Receive against it, and returns the GR's document number. */
async function createFreshGoodsReceive(page) {
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

  const goodsReceivePage = new GoodsReceivePage(page);
  await goodsReceivePage.goto();
  await goodsReceivePage.clickNew();
  await goodsReceivePage.receiveGoods({ vendorCode: VENDOR_CODE, poDocNo });
  expect(await goodsReceivePage.expectPostSuccess()).toBe(true);

  // Read the posted GR's own document number from its report tab, same
  // approach as PurchaseOrderPage.getPostedDocumentNumber() — Goods
  // Receive doesn't have its own equivalent helper yet, so this reads it
  // directly here (same technique purchase-return.spec.js's own
  // createFreshPurchaseInvoice() already uses for Purchase Invoice).
  //
  // BUG FIXED (2026-08-18): matching on the report's own TAB TITLE text
  // ("Good Receive Summary With Cost And Price Report") found the wrong
  // frame — that title also appears in the tab-bar/shell frame, not just
  // the report's own content frame, so innerText() came back without the
  // GR-XXXXX number at all (confirmed live via a failure screenshot that
  // showed the report rendering correctly with "Goods Rec. No : GR-00000047"
  // — the flow itself was fine, only the frame-matching was wrong). Fixed
  // to match on "Goods Rec. No", a label that only appears inside the
  // report's own rendered content, same class of fix already used
  // elsewhere in this module (PurchaseOrderPage.getPostedDocumentNumber()
  // matches "Purchase Ord. No", not the report's tab title either).
  const reportFrame = await findFrame(page, async (frame) => {
    const marker = frame.getByText('Goods Rec. No', { exact: false });
    if ((await marker.count().catch(() => 0)) === 0) return false;
    return await marker.first().isVisible().catch(() => false);
  }, { timeout: 20000 });
  const text = await reportFrame.locator('body').innerText().catch(() => '');
  const match = text.match(/GR-\d+/);
  expect(match).not.toBeNull();
  return match[0];
}

test.describe('Purchase > Goods Return', () => {

  test('[Post] posts a Goods Return transferred from a Goods Receive', async ({ page }) => {
    test.setTimeout(180000);
    const grDocNo = await createFreshGoodsReceive(page);

    const goodsReturnPage = new GoodsReturnPage(page);
    await goodsReturnPage.goto();
    await goodsReturnPage.clickNew();
    await goodsReturnPage.prepareReturn({ vendorCode: VENDOR_CODE, grDocNo });
    await goodsReturnPage.clickPost();

    expect(await goodsReturnPage.expectPostSuccess()).toBe(true);
  });

  test('[Post & New] posts a Goods Return and resets the form for the next entry', async ({ page }) => {
    test.setTimeout(180000);
    const grDocNo = await createFreshGoodsReceive(page);

    const goodsReturnPage = new GoodsReturnPage(page);
    await goodsReturnPage.goto();
    await goodsReturnPage.clickNew();
    const beforeNo = await goodsReturnPage.getNextPossibleNo();
    await goodsReturnPage.prepareReturn({ vendorCode: VENDOR_CODE, grDocNo });
    await goodsReturnPage.clickPostAndNew();

    expect(await goodsReturnPage.expectFormReset()).toBe(true);
    const afterNo = await goodsReturnPage.getNextPossibleNo();
    expect(afterNo).not.toBe(beforeNo);
  });

  /**
   * Row-level Cancel, following the same pattern already built and merged
   * across this module (see cash-purchase.spec.js's own '[Cancel]' test
   * and CashPurchasePage's cancelDocument()/isDocumentPresent()). This
   * screen's own free-text "Reference No." field (not required, but
   * always filled here) is used as the search key.
   */
  test('[Cancel] posts a Goods Return then cancels it from the listing page', async ({ page }) => {
    // BUG FIXED (2026-08-18): 180000ms wasn't enough — this chain
    // (PO -> Goods Receive -> Goods Return + Cancel) is as long as Purchase
    // Return's own Cancel test, which already needed 300000ms under load.
    // A live run overshot the full 180s budget on attempt 1 and failed
    // expectPostSuccess() on the retry (a 20s report-tab wait getting cut
    // short near the timeout edge, not a real defect — the failure
    // screenshot showed the form correctly filled and Post already
    // in-flight).
    test.setTimeout(300000);
    const grDocNo = await createFreshGoodsReceive(page);

    const goodsReturnPage = new GoodsReturnPage(page);
    await goodsReturnPage.goto();
    await goodsReturnPage.clickNew();
    const uniqueRef = `TESTING-CANCEL-${Date.now()}`;
    await goodsReturnPage.prepareReturn({ vendorCode: VENDOR_CODE, grDocNo, referenceNo: uniqueRef });
    await goodsReturnPage.clickPost();
    expect(await goodsReturnPage.expectPostSuccess()).toBe(true);

    await goodsReturnPage.cancelDocument(uniqueRef);

    // Per this repo's convention: a success dialog isn't proof by itself —
    // verify with a fresh search that the row is genuinely gone from the
    // active (DRAFT + POSTED) listing view.
    expect(await goodsReturnPage.isDocumentPresent(uniqueRef)).toBe(false);
  });
});
