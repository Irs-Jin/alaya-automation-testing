const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ItemPage } = require('../../framework/pages/itemPage');
const { StockTransferPage } = require('../../framework/pages/stockTransferPage');

/**
 * Same before/after Qty Available verification pattern as
 * stock-receive-qty-in.spec.js, applied to Stock Transfer.
 *
 * CONFIRMED LIVE (2026-08-22): Posting a Stock Transfer alone is Qty OUT
 * only — it immediately deducts from the item's Qty Available, but does
 * NOT add it anywhere yet (the goods stay "in transit"). The destination
 * warehouse only actually receives the stock once a SEPARATE Stock
 * Transfer Receipt document is posted (see stockTransferReceiptPage.js) —
 * that in-transit gap is why the deduction shows up here at all instead of
 * netting to zero. This spec covers Stock Transfer's own isolated qty
 * impact only, not the full transfer+receipt chain.
 *
 * Read Item 526014's Qty Available -> create + Post a Stock Transfer
 * (AMPANG -> BERCHAM RAYA) for the same item -> read the auto-populated
 * Qty of that line -> confirm the Item's Qty Available DECREASED by
 * exactly that Qty -> Delete the posted document (this screen's real
 * cleanup mechanism — a genuine HARD DELETE, confirmed in
 * stockTransferPage.js; deleting before any receipt happens keeps it
 * eligible for delete) -> confirm Qty Available reverts back to its
 * original value.
 */
test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Inventory > Stock Transfer', () => {

  test('[Qty Out] Post correctly deducts the transferred Qty from the Item\'s Qty Available', async ({ page }) => {
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
    await stockTransferPage.fillReferenceNo('TESTING_QTY_XFER');
    await stockTransferPage.addItemLineByCode(itemCode);
    const qtyTransferred = await stockTransferPage.getLineQty(itemCode);

    await stockTransferPage.clickPost();
    await stockTransferPage.clickBack();

    const qtyAfterPost = await itemPage.refreshAndGetQtyAvailable(itemCode);
    expect(qtyAfterPost).toBeCloseTo(qtyBefore - qtyTransferred, 5);

    // Cleanup: this screen's real cleanup mechanism is a genuine hard
    // Delete, not a soft Cancel (see stockTransferPage.js). Deleting now
    // (before any Stock Transfer Receipt) keeps it eligible for delete.
    await stockTransferPage.deleteDocument('TESTING_QTY_XFER');
    expect(await stockTransferPage.isDeleteSuccessful('TESTING_QTY_XFER')).toBe(true);

    const qtyAfterDelete = await itemPage.refreshAndGetQtyAvailable(itemCode);
    expect(qtyAfterDelete).toBeCloseTo(qtyBefore, 5);
  });
});
