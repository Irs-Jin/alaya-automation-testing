const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { StockTransferPage } = require('../../framework/pages/stockTransferPage');

/**
 * "No Cancel" variant of stock-transfer.spec.js: covers the
 * [Save Draft], [Post], and [Post & New] scenarios, each deliberately
 * STOPPING right after — no Delete step (this screen's real cleanup
 * mechanism — see stock-transfer.spec.js). The dedicated [Cancel]
 * scenario from stock-transfer.spec.js has no no-cancel counterpart here,
 * since its entire purpose is exercising that Delete action itself.
 *
 * PERMANENT BY OMISSION — READ BEFORE RE-RUNNING: this screen's Delete
 * action still works fine — these tests simply don't exercise it. Each
 * test leaves a real Draft/Posted Stock Transfer document behind
 * (AMPANG -> BERCHAM RAYA, Item "SAFETY PIN"), which CAN be deleted
 * manually later. Running this repeatedly without manual cleanup keeps
 * stacking real leftover documents in whichever environment it targets.
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

  test('[Save Draft, No Cancel] creates a draft Stock Transfer', async ({ page }) => {
    test.setTimeout(90000);
    const stockTransferPage = new StockTransferPage(page);
    await stockTransferPage.goto();

    await stockTransferPage.createStockTransfer({ referenceNo: 'TESTING_ST_DFT_NC', itemName: 'SAFETY PIN' });
    await stockTransferPage.clickSaveDraft();
    expect(await stockTransferPage.getStatus()).toBe('DRAFT');
    await stockTransferPage.clickBack();

    // No cleanup: see class doc — Delete is left unexercised on purpose.
  });

  test('[Post, No Cancel] creates a posted Stock Transfer', async ({ page }) => {
    test.setTimeout(90000);
    const stockTransferPage = new StockTransferPage(page);
    await stockTransferPage.goto();

    await stockTransferPage.createStockTransfer({ referenceNo: 'TESTING_ST_PST_NC', itemName: 'SAFETY PIN' });
    await stockTransferPage.clickPost();
    await stockTransferPage.clickBack();

    // No cleanup: see class doc — Delete is left unexercised on purpose.
  });

  test('[Post & New, No Cancel] posts a Stock Transfer via Post & New', async ({ page }) => {
    test.setTimeout(90000);
    const stockTransferPage = new StockTransferPage(page);
    await stockTransferPage.goto();

    await stockTransferPage.createStockTransfer({ referenceNo: 'TESTING_ST_PNW_NC', itemName: 'SAFETY PIN' });
    await stockTransferPage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await stockTransferPage.clickBack();

    // No cleanup: see class doc — Delete is left unexercised on purpose.
  });
});
