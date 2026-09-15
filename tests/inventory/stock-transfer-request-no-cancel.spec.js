const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { StockTransferRequestPage } = require('../../framework/pages/stockTransferRequestPage');

/**
 * "No Cancel" variant of stock-transfer-request.spec.js: same Save Draft/
 * Post/Post & New flows, but deliberately STOPS after each one — no
 * Delete step (this screen's real cleanup mechanism).
 *
 * PERMANENT BY OMISSION — READ BEFORE RE-RUNNING: this screen's Delete
 * action still works fine (see stock-transfer-request.spec.js) — these
 * tests simply don't exercise it. Each test leaves a real Draft/Posted
 * Stock Transfer Request document behind (AMPANG -> BERCHAM RAYA, Item
 * "SAFETY PIN"), which CAN be deleted manually later. Running this
 * repeatedly without manual cleanup keeps stacking real leftover
 * documents in whichever environment it targets.
 */
test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Inventory > Stock Transfer Request', () => {

  test('[Save Draft, No Cancel] creates a draft Stock Transfer Request', async ({ page }) => {
    test.setTimeout(90000);
    const stockTransferRequestPage = new StockTransferRequestPage(page);
    await stockTransferRequestPage.goto();

    await stockTransferRequestPage.createStockTransferRequest({ referenceNo: 'TESTING_STR_DFT_NC', itemName: 'SAFETY PIN' });
    await stockTransferRequestPage.clickSaveDraft();
    expect(await stockTransferRequestPage.getStatus()).toBe('DRAFT');
    await stockTransferRequestPage.clickBack();

    // No cleanup: see class doc — Delete is left unexercised on purpose.
  });

  test('[Post, No Cancel] creates a posted Stock Transfer Request', async ({ page }) => {
    test.setTimeout(90000);
    const stockTransferRequestPage = new StockTransferRequestPage(page);
    await stockTransferRequestPage.goto();

    await stockTransferRequestPage.createStockTransferRequest({ referenceNo: 'TESTING_STR_PST_NC', itemName: 'SAFETY PIN' });
    await stockTransferRequestPage.clickPost();
    await stockTransferRequestPage.clickBack();

    // No cleanup: see class doc — Delete is left unexercised on purpose.
  });

  test('[Post & New, No Cancel] posts a Stock Transfer Request via Post & New', async ({ page }) => {
    test.setTimeout(90000);
    const stockTransferRequestPage = new StockTransferRequestPage(page);
    await stockTransferRequestPage.goto();

    await stockTransferRequestPage.createStockTransferRequest({ referenceNo: 'TESTING_STR_PNW_NC', itemName: 'SAFETY PIN' });
    await stockTransferRequestPage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await stockTransferRequestPage.clickBack();

    // No cleanup: see class doc — Delete is left unexercised on purpose.
  });
});
