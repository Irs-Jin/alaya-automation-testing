const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ItemPage } = require('../../framework/pages/itemPage');
const { StockTransferPage } = require('../../framework/pages/stockTransferPage');
const { StockTransferReceiptPage } = require('../../framework/pages/stockTransferReceiptPage');

/**
 * Completes the full Stock Transfer -> Stock Transfer Receipt cycle
 * (AMPANG -> BERCHAM RAYA) and confirms the Item's Qty Available nets back
 * to its ORIGINAL value once both halves are posted — proving the platform
 * doesn't lose or double-count stock across the in-transit gap already
 * confirmed in stock-transfer-qty-out.spec.js (Posting the Stock Transfer
 * alone is Qty OUT only; the destination doesn't receive it until this
 * separate Receipt is posted).
 *
 * PERMANENT DOCUMENTS — READ BEFORE RE-RUNNING: CONFIRMED live
 * (2026-08-18, see stockTransferReceiptPage.js) this screen has no
 * Save Draft, Post & New, Copy From, or Delete/Cancel action anywhere —
 * once posted, a Stock Transfer Receipt is a permanent record, same as
 * the real inventory movement it represents. This is a deliberate,
 * user-confirmed exception to this repo's normal "leave no residual data"
 * rule (2026-08-22), in the same category as the Stock Take discrepancy
 * scenario in stock-take-qty.spec.js. Each run permanently creates one
 * Stock Transfer + one Stock Transfer Receipt document moving 1 unit of
 * item 526014 from AMPANG to BERCHAM RAYA — the item's overall Qty
 * Available is unaffected (nets to zero), but the physical per-warehouse
 * split permanently shifts by 1 unit each run.
 */
test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Inventory > Stock Transfer Receipt', () => {

  test('[Qty] Completing a Stock Transfer + Receipt nets no change to the Item\'s overall Qty Available', async ({ page }) => {
    test.setTimeout(90000);
    const itemCode = '526014';

    const itemPage = new ItemPage(page);
    await itemPage.goto();
    const qtyBefore = await itemPage.getQtyAvailable(itemCode);

    const stockTransferPage = new StockTransferPage(page);
    await stockTransferPage.goto();
    await stockTransferPage.clickNew();
    await stockTransferPage.selectFromWarehouse('AMPANG');
    await stockTransferPage.selectToWarehouse('BERCHAM RAYA');
    await stockTransferPage.fillReason('Testing');
    await stockTransferPage.fillReferenceNo('TESTING_QTY_RECV');
    await stockTransferPage.addItemLineByCode(itemCode);
    await stockTransferPage.clickPost();

    const stockTransferDocumentNo = await stockTransferPage.getDocumentNoAfterPost();
    expect(stockTransferDocumentNo).toMatch(/^ST-\d+$/);

    const qtyAfterTransferPost = await itemPage.refreshAndGetQtyAvailable(itemCode);
    expect(qtyAfterTransferPost).toBeCloseTo(qtyBefore - 1, 5);

    const stockTransferReceiptPage = new StockTransferReceiptPage(page);
    await stockTransferReceiptPage.goto();
    await stockTransferReceiptPage.openPendingReceipt(stockTransferDocumentNo);
    await stockTransferReceiptPage.fillReason('Testing');
    await stockTransferReceiptPage.clickPost();

    const qtyAfterReceiptPost = await itemPage.refreshAndGetQtyAvailable(itemCode);
    expect(qtyAfterReceiptPost).toBeCloseTo(qtyBefore, 5);

    // No cleanup: see class doc — Stock Transfer Receipt has no
    // Cancel/Delete action anywhere. Permanent by design (user-confirmed
    // 2026-08-22), same as the Stock Take discrepancy scenario.
  });
});
