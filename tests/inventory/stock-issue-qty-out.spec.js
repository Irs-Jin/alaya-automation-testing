const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ItemPage } = require('../../framework/pages/itemPage');
const { StockIssuePage } = require('../../framework/pages/stockIssuePage');

/**
 * Same before/after Qty Available verification pattern as
 * stock-receive-qty-in.spec.js, applied to Stock Issue: CONFIRMED live
 * (2026-08-22) this module moves Qty OUT (decreases Qty Available), the
 * mirror image of Stock Receive's Qty In. Read Item 526014's Qty Available
 * -> create + Post a Stock Issue for the same item -> read the
 * auto-populated Qty of that line -> confirm the Item's Qty Available
 * DECREASED by exactly that Qty -> Cancel the posted document (same
 * cleanup mechanism as Stock Receive, confirmed in stockIssuePage.js) ->
 * confirm Qty Available reverts back to its original value.
 */
test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Inventory > Stock Issue', () => {

  test('[Qty Out] Post correctly deducts the issued Qty from the Item\'s Qty Available', async ({ page }) => {
    test.setTimeout(90000);
    const itemCode = '526014';

    const itemPage = new ItemPage(page);
    await itemPage.goto();
    const qtyBefore = await itemPage.getQtyAvailable(itemCode);

    const stockIssuePage = new StockIssuePage(page);
    await stockIssuePage.goto();
    await stockIssuePage.clickNew();
    await stockIssuePage.selectWarehouse('AMPANG');
    await stockIssuePage.fillDescription('TESTING_QTY_OUT');
    await stockIssuePage.fillReferenceNo('TESTING_QTY_OUT');
    await stockIssuePage.addItemLineByCode(itemCode);
    const qtyIssued = await stockIssuePage.getLineQty(itemCode);

    await stockIssuePage.clickPost();
    await stockIssuePage.clickBack();

    const qtyAfterPost = await itemPage.refreshAndGetQtyAvailable(itemCode);
    expect(qtyAfterPost).toBeCloseTo(qtyBefore - qtyIssued, 5);

    // Cleanup: this screen's real cleanup mechanism is Cancel, not Delete.
    await stockIssuePage.cancelDocument('TESTING_QTY_OUT');
    expect(await stockIssuePage.isCancelSuccessful('TESTING_QTY_OUT')).toBe(true);

    const qtyAfterCancel = await itemPage.refreshAndGetQtyAvailable(itemCode);
    expect(qtyAfterCancel).toBeCloseTo(qtyBefore, 5);
  });
});
