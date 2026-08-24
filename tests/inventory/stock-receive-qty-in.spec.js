const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ItemPage } = require('../../framework/pages/itemPage');
const { StockReceivePage } = require('../../framework/pages/stockReceivePage');

/**
 * Built from the user's own Playwright codegen recording (2026-08-22) plus
 * a full live exploration/confirmation against SIT (uat/admin): read Item
 * 526014's "Qty Available" (shown directly on the Item listing grid, no
 * need to open the item form/tab) -> create + Post a Stock Receive for the
 * same item -> read the auto-populated Qty of that line -> confirm the
 * Item's Qty Available increased by exactly that Qty -> Cancel the posted
 * document (this screen's real cleanup mechanism, confirmed in
 * stockReceivePage.js) -> confirm Qty Available reverts back to its
 * original value, leaving no residual stock impact.
 *
 * CONFIRMED LIVE (2026-08-22): the recording's `page.locator('a').first()
 * .click()` right before navigating to Stock Receive was a disconnected
 * recorder artifact (no clear purpose) and is not reproduced here.
 *
 * CONFIRMED LIVE (2026-08-22): after Posting in the Stock Receive tab, the
 * already-open Item tab does NOT auto-refresh its grid — it keeps showing
 * the pre-Post Qty Available until "Refresh Selected Tab" is clicked, even
 * though the tab itself is already open. See
 * ItemPage._switchToOpenTabAndRefresh().
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

  test('[Qty In] Post correctly adds the received Qty to the Item\'s Qty Available', async ({ page }) => {
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

    // Cleanup: this screen's real cleanup mechanism is Cancel, not Delete
    // (see stockReceivePage.js) — confirm it also reverses the stock impact.
    await stockReceivePage.cancelDocument('TESTING_QTY_IN');
    expect(await stockReceivePage.isCancelSuccessful('TESTING_QTY_IN')).toBe(true);

    const qtyAfterCancel = await itemPage.refreshAndGetQtyAvailable(itemCode);
    expect(qtyAfterCancel).toBeCloseTo(qtyBefore, 5);
  });
});
