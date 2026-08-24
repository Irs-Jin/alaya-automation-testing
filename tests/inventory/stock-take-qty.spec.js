const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ItemPage } = require('../../framework/pages/itemPage');
const { StockTakePage } = require('../../framework/pages/stockTakePage');

/**
 * Same before/after Qty Available verification pattern as
 * stock-receive-qty-in.spec.js, applied to Stock Take — but with a genuine
 * Physical Qty discrepancy (On Hand + 1), unlike stock-take.spec.js's own
 * scenarios which always set Physical Qty equal to On Hand Qty specifically
 * to avoid the flow this test exercises.
 *
 * CONFIRMED LIVE (2026-08-22): Posting with a real discrepancy shows an
 * undocumented "Discrepancies detected..." Confirmation dialog, then a
 * mandatory "Adjustment Reason" popup, before the linked Stock Adjustment
 * is auto-created and the qty actually changes — see
 * StockTakePage.clickPostWithDiscrepancy().
 *
 * PERMANENT QTY CHANGE — READ BEFORE RE-RUNNING: once posted this way, the
 * qty change cannot be undone through the UI. The resulting POSTED Stock
 * Take's own Cancel icon AND the auto-created Stock Adjustment's own
 * Delete icon are BOTH disabled (confirmed via DOM inspection + an
 * "InvalidAction" console log on click) — unlike every other module in
 * this file's sibling specs. This is a deliberate, user-confirmed
 * exception to this repo's normal "leave no residual data" rule, in the
 * same category as Stock Transfer Receipt. Each run permanently adds +1 to
 * item 526014's real Qty Available in whichever environment it targets.
 */
test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Inventory > Stock Take', () => {

  test('[Qty] Posting a real discrepancy correctly applies the Different Qty to the Item\'s Qty Available', async ({ page }) => {
    test.setTimeout(90000);
    const itemCode = '526014';

    const itemPage = new ItemPage(page);
    await itemPage.goto();
    const qtyBefore = await itemPage.getQtyAvailable(itemCode);

    const stockTakePage = new StockTakePage(page);
    await stockTakePage.goto();
    await stockTakePage.clickNew();
    await stockTakePage.selectWarehouse('AMPANG');
    await stockTakePage.fillDescription('TESTING_QTY_TAKE');
    await stockTakePage.fillReferenceNo('TESTING_QTY_TAKE');
    await stockTakePage.addItemLineByCode({ binLocationCode: 'AMPANG', itemCode });

    const onHandQty = await stockTakePage.getLineOnHandQty();
    await stockTakePage.fillPhysicalQty(onHandQty + 1);
    const qtyDelta = await stockTakePage.getLineQtyDelta();
    expect(qtyDelta).toBeCloseTo(1, 5);

    await stockTakePage.clickPostWithDiscrepancy('ADJUST');

    const qtyAfterPost = await itemPage.refreshAndGetQtyAvailable(itemCode);
    expect(qtyAfterPost).toBeCloseTo(qtyBefore + qtyDelta, 5);

    // No cleanup: see class doc — this Stock Take's Cancel and its
    // auto-created Stock Adjustment's Delete are both disabled once
    // posted with a real discrepancy. Permanent by design (user-confirmed
    // 2026-08-22), same as Stock Transfer Receipt.
  });
});
