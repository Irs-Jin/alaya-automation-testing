const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ItemPage } = require('../../framework/pages/itemPage');
const { StockAdjustmentPage } = require('../../framework/pages/stockAdjustmentPage');

/**
 * "No Cancel" variant of stock-adjustment-qty.spec.js: same before/after
 * Qty Available verification (create + Post a Stock Adjustment for item
 * 526014, confirm Qty Available changed by exactly the line's NewBalance -
 * QtyOnHand delta), but deliberately STOPS after that check — no
 * cleanup step.
 *
 * PERMANENT BY OMISSION — READ BEFORE RE-RUNNING: this screen's cleanup
 * mechanism is a genuine hard Delete (not a soft Cancel — see
 * stockAdjustmentPage.js), and it still works fine; this test simply
 * doesn't exercise it. The posted Stock Adjustment document is left
 * behind and CAN be deleted manually later (or by
 * stock-adjustment-qty.spec.js's own full cycle). Running this repeatedly
 * without manual cleanup keeps stacking real qty deltas onto item
 * 526014's Qty Available in whichever environment it targets.
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

  test('[Qty, No Cancel] Post correctly applies the adjustment delta to the Item\'s Qty Available', async ({ page }) => {
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

    // No cleanup: see class doc — Delete is left unexercised on purpose.
  });
});
