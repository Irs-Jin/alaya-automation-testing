const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { StockAdjustmentPage } = require('../../framework/pages/stockAdjustmentPage');

/**
 * "No Cancel" variant of stock-adjustment.spec.js: same Save Draft/Post/
 * Post & New flows, but deliberately STOPS after each one — no Delete
 * step (this screen's real cleanup mechanism — see stock-adjustment.spec.js).
 *
 * PERMANENT BY OMISSION — READ BEFORE RE-RUNNING: this screen's Delete
 * action still works fine — these tests simply don't exercise it. Each
 * test leaves a real Draft/Posted Stock Adjustment document behind
 * (Warehouse AMPANG, Item "SAFETY PIN"), which CAN be deleted manually
 * later. Running this repeatedly without manual cleanup keeps stacking
 * real leftover documents in whichever environment it targets.
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

  test('[Save Draft, No Cancel] creates a draft Stock Adjustment', async ({ page }) => {
    test.setTimeout(90000);
    const stockAdjustmentPage = new StockAdjustmentPage(page);
    await stockAdjustmentPage.goto();

    await stockAdjustmentPage.createStockAdjustment({ referenceNo: 'TESTING_SA_DFT_NC', itemName: 'SAFETY PIN' });
    await stockAdjustmentPage.clickSaveDraft();
    expect(await stockAdjustmentPage.getStatus()).toBe('DRAFT');
    await stockAdjustmentPage.clickBack();

    // No cleanup: see class doc — Delete is left unexercised on purpose.
  });

  test('[Post, No Cancel] creates a posted Stock Adjustment', async ({ page }) => {
    test.setTimeout(90000);
    const stockAdjustmentPage = new StockAdjustmentPage(page);
    await stockAdjustmentPage.goto();

    await stockAdjustmentPage.createStockAdjustment({ referenceNo: 'TESTING_SA_PST_NC', itemName: 'SAFETY PIN' });
    await stockAdjustmentPage.clickPost();
    await stockAdjustmentPage.clickBack();

    // No cleanup: see class doc — Delete is left unexercised on purpose.
  });

  test('[Post & New, No Cancel] posts a Stock Adjustment via Post & New', async ({ page }) => {
    test.setTimeout(90000);
    const stockAdjustmentPage = new StockAdjustmentPage(page);
    await stockAdjustmentPage.goto();

    await stockAdjustmentPage.createStockAdjustment({ referenceNo: 'TESTING_SA_PNW_NC', itemName: 'SAFETY PIN' });
    await stockAdjustmentPage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await stockAdjustmentPage.clickBack();

    // No cleanup: see class doc — Delete is left unexercised on purpose.
  });
});
