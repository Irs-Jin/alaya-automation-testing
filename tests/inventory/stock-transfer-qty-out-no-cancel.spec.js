const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ItemPage } = require('../../framework/pages/itemPage');
const { StockTransferPage } = require('../../framework/pages/stockTransferPage');

/**
 * "No Cancel" variant of stock-transfer-qty-out.spec.js: same before/after
 * Qty Available verification (create + Post a Stock Transfer, AMPANG ->
 * BERCHAM RAYA, for item 526014, confirm Qty Available DECREASED by
 * exactly the transferred Qty — Posting a Stock Transfer alone is Qty OUT
 * only, see stockTransferPage.js for the in-transit gap), but deliberately
 * STOPS after that check — no cleanup step.
 *
 * PERMANENT BY OMISSION — READ BEFORE RE-RUNNING: this screen's cleanup
 * mechanism is a genuine hard Delete (not a soft Cancel), and it still
 * works fine as long as no Stock Transfer Receipt has been posted against
 * it yet; this test simply doesn't exercise it. The posted Stock Transfer
 * document is left behind and CAN be deleted manually later (or by
 * stock-transfer-qty-out.spec.js's own full cycle) — but ONLY until
 * someone completes it via Stock Transfer Receipt, at which point it
 * becomes permanent like every stock-transfer-receipt-qty.spec.js run.
 * Running this repeatedly without manual cleanup keeps stacking real -1
 * decrements onto item 526014's Qty Available in whichever environment it
 * targets.
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

  test('[Qty Out, No Cancel] Post correctly deducts the transferred Qty from the Item\'s Qty Available', async ({ page }) => {
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

    // No cleanup: see class doc — Delete is left unexercised on purpose.
  });
});
