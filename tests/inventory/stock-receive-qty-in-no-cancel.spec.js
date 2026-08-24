const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ItemPage } = require('../../framework/pages/itemPage');
const { StockReceivePage } = require('../../framework/pages/stockReceivePage');

/**
 * "No Cancel" variant of stock-receive-qty-in.spec.js: same before/after
 * Qty Available verification (create + Post a Stock Receive for item
 * 526014, confirm Qty Available increased by exactly the received Qty),
 * but deliberately STOPS after that check — no Cancel step.
 *
 * PERMANENT BY OMISSION — READ BEFORE RE-RUNNING: unlike Stock Take's
 * discrepancy scenario or Stock Transfer Receipt (both genuinely
 * uncancellable), this screen's Cancel action still works fine — this
 * test simply doesn't exercise it. The posted Stock Receive document is
 * left behind and CAN be cancelled manually later (or by
 * stock-receive-qty-in.spec.js's own full cycle). Running this repeatedly
 * without manual cleanup keeps stacking real +1 increments onto item
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

test.describe('Inventory > Stock Receive', () => {

  test('[Qty In, No Cancel] Post correctly adds the received Qty to the Item\'s Qty Available', async ({ page }) => {
    test.setTimeout(90000);
    const itemCode = '526014';

    const itemPage = new ItemPage(page);
    await itemPage.goto();
    const qtyBefore = await itemPage.getQtyAvailable(itemCode);

    const stockReceivePage = new StockReceivePage(page);
    await stockReceivePage.goto();
    await stockReceivePage.clickNew();
    await stockReceivePage.selectWarehouse('AMPANG');
    await stockReceivePage.fillDescription('TESTING_QTY_IN');
    await stockReceivePage.fillReferenceNo('TESTING_QTY_IN');
    await stockReceivePage.addItemLineByCode(itemCode);
    const qtyReceived = await stockReceivePage.getLineQty(itemCode);

    await stockReceivePage.clickPost();
    await stockReceivePage.clickBack();

    const qtyAfterPost = await itemPage.refreshAndGetQtyAvailable(itemCode);
    expect(qtyAfterPost).toBeCloseTo(qtyBefore + qtyReceived, 5);

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });
});
