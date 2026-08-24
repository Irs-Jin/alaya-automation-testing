const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ItemPage } = require('../../framework/pages/itemPage');
const { StockAdjustmentPage } = require('../../framework/pages/stockAdjustmentPage');

/**
 * Same before/after Qty Available verification pattern as
 * stock-receive-qty-in.spec.js, applied to Stock Adjustment: CONFIRMED
 * live (2026-08-22) the default "Adjustment IN/OUT" mode auto-populates
 * AdjQty=+1 (NewBalance = QtyOnHand + 1) — a Qty IN. Read Item 526014's Qty
 * Available -> create + Post a Stock Adjustment for the same item -> read
 * the line's net Qty delta (NewBalance - QtyOnHand) -> confirm the Item's
 * Qty Available changed by exactly that delta -> Delete the posted
 * document (this screen's real cleanup mechanism — a genuine HARD DELETE,
 * not a soft cancel, confirmed in stockAdjustmentPage.js) -> confirm Qty
 * Available reverts back to its original value.
 */
test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Inventory > Stock Adjustment', () => {

  test('[Qty] Post correctly applies the adjustment delta to the Item\'s Qty Available', async ({ page }) => {
    test.setTimeout(90000);
    const itemCode = '526014';

    const itemPage = new ItemPage(page);
    await itemPage.goto();
    const qtyBefore = await itemPage.getQtyAvailable(itemCode);

    const stockAdjustmentPage = new StockAdjustmentPage(page);
    await stockAdjustmentPage.goto();
    await stockAdjustmentPage.clickNew();
    await stockAdjustmentPage.selectWarehouse('AMPANG');
    await stockAdjustmentPage.selectReason('ADJUST');
    await stockAdjustmentPage.fillReferenceNo('TESTING_QTY_ADJ');
    await stockAdjustmentPage.addItemLineByCode(itemCode);
    const qtyDelta = await stockAdjustmentPage.getLineQtyDelta(itemCode);

    await stockAdjustmentPage.clickPost();
    await stockAdjustmentPage.clickBack();

    const qtyAfterPost = await itemPage.refreshAndGetQtyAvailable(itemCode);
    expect(qtyAfterPost).toBeCloseTo(qtyBefore + qtyDelta, 5);

    // Cleanup: this screen's real cleanup mechanism is a genuine hard
    // Delete, not a soft Cancel (see stockAdjustmentPage.js).
    await stockAdjustmentPage.deleteDocument('TESTING_QTY_ADJ');
    expect(await stockAdjustmentPage.isDeleteSuccessful('TESTING_QTY_ADJ')).toBe(true);

    const qtyAfterDelete = await itemPage.refreshAndGetQtyAvailable(itemCode);
    expect(qtyAfterDelete).toBeCloseTo(qtyBefore, 5);
  });
});
