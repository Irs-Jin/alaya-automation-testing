const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { StockReceivePage } = require('../../framework/pages/stockReceivePage');

/**
 * "No Cancel" variant of stock-receive.spec.js: same Save Draft/Post/
 * Post & New flows, but deliberately STOPS after each one — no Cancel
 * step.
 *
 * PERMANENT BY OMISSION — READ BEFORE RE-RUNNING: this screen's Cancel
 * action still works fine (see stock-receive.spec.js) — these tests
 * simply don't exercise it. Each test leaves a real Draft/Posted Stock
 * Receive document behind (Warehouse AMPANG, Item "SAFETY PIN"), which
 * CAN be cancelled manually later. Running this repeatedly without manual
 * cleanup keeps stacking real leftover documents in whichever environment
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

test.describe('Inventory > Stock Receive', () => {

  test('[Save Draft, No Cancel] creates a draft Stock Receive', async ({ page }) => {
    test.setTimeout(90000);
    const stockReceivePage = new StockReceivePage(page);
    await stockReceivePage.goto();

    await stockReceivePage.createStockReceive({ referenceNo: 'TESTING_SR_DFT_NC', itemName: 'SAFETY PIN' });
    await stockReceivePage.clickSaveDraft();
    expect(await stockReceivePage.getStatus()).toBe('DRAFT');
    await stockReceivePage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });

  test('[Post, No Cancel] creates a posted Stock Receive', async ({ page }) => {
    test.setTimeout(90000);
    const stockReceivePage = new StockReceivePage(page);
    await stockReceivePage.goto();

    await stockReceivePage.createStockReceive({ referenceNo: 'TESTING_SR_PST_NC', itemName: 'SAFETY PIN' });
    await stockReceivePage.clickPost();
    await stockReceivePage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });

  test('[Post & New, No Cancel] posts a Stock Receive via Post & New', async ({ page }) => {
    test.setTimeout(90000);
    const stockReceivePage = new StockReceivePage(page);
    await stockReceivePage.goto();

    await stockReceivePage.createStockReceive({ referenceNo: 'TESTING_SR_PNW_NC', itemName: 'SAFETY PIN' });
    await stockReceivePage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await stockReceivePage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });
});
