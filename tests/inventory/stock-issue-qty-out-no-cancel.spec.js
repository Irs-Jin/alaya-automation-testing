const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ItemPage } = require('../../framework/pages/itemPage');
const { StockIssuePage } = require('../../framework/pages/stockIssuePage');

/**
 * "No Cancel" variant of stock-issue-qty-out.spec.js: same before/after
 * Qty Available verification (create + Post a Stock Issue for item
 * 526014, confirm Qty Available DECREASED by exactly the issued Qty),
 * but deliberately STOPS after that check — no Cancel step.
 *
 * PERMANENT BY OMISSION — READ BEFORE RE-RUNNING: this screen's Cancel
 * action still works fine — this test simply doesn't exercise it. The
 * posted Stock Issue document is left behind and CAN be cancelled
 * manually later (or by stock-issue-qty-out.spec.js's own full cycle).
 * Running this repeatedly without manual cleanup keeps stacking real -1
 * decrements onto item 526014's Qty Available in whichever environment
 * it targets.
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

  test('[Qty Out, No Cancel] Post correctly deducts the issued Qty from the Item\'s Qty Available', async ({ page }) => {
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

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });
});
