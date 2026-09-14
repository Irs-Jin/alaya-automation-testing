const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { StockTakePage } = require('../../framework/pages/stockTakePage');

/**
 * "No Cancel" variant of stock-take.spec.js: covers the [Save Draft],
 * [Post], and [Post & New] scenarios, each deliberately STOPPING right
 * after — no Cancel step. The dedicated [Cancel] scenario from
 * stock-take.spec.js has no no-cancel counterpart here, since its entire
 * purpose is exercising the Cancel action itself.
 *
 * PERMANENT BY OMISSION — READ BEFORE RE-RUNNING: this screen's Cancel
 * action still works fine (see stock-take.spec.js) — these tests simply
 * don't exercise it. Each test leaves a real Draft/Posted Stock Take
 * document behind (Warehouse AMPANG, Item "SAFETY PIN"), which CAN be
 * cancelled manually later. Running this repeatedly without manual
 * cleanup keeps stacking real leftover documents in whichever
 * environment it targets.
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

  test('[Save Draft, No Cancel] creates a draft Stock Take', async ({ page }) => {
    test.setTimeout(90000);
    const stockTakePage = new StockTakePage(page);
    await stockTakePage.goto();

    await stockTakePage.createStockTake({ referenceNo: 'TESTING_STK_DFT_NC', itemName: 'SAFETY PIN' });
    await stockTakePage.clickSaveDraft();
    expect(await stockTakePage.getStatus()).toBe('DRAFT');
    await stockTakePage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });

  test('[Post, No Cancel] creates a posted Stock Take', async ({ page }) => {
    test.setTimeout(90000);
    const stockTakePage = new StockTakePage(page);
    await stockTakePage.goto();

    await stockTakePage.createStockTake({ referenceNo: 'TESTING_STK_PST_NC', itemName: 'SAFETY PIN' });
    await stockTakePage.fillPhysicalQty(198);
    await stockTakePage.clickPost();
    await stockTakePage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });

  test('[Post & New, No Cancel] posts a Stock Take via Post & New', async ({ page }) => {
    test.setTimeout(90000);
    const stockTakePage = new StockTakePage(page);
    await stockTakePage.goto();

    await stockTakePage.createStockTake({ referenceNo: 'TESTING_STK_PNW_NC', itemName: 'SAFETY PIN' });
    await stockTakePage.fillPhysicalQty(198);
    await stockTakePage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await stockTakePage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });
});
