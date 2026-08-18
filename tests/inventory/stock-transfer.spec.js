const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { StockTransferPage } = require('../../framework/pages/stockTransferPage');

/**
 * Built from Jin's own Playwright codegen recording (2026-08-18) plus a
 * full live exploration/confirmation of Save Draft, Post, and Post & New
 * against SIT (uat/admin), each followed by Delete + a fresh grid check to
 * confirm gone. Warehouses "AMPANG" (From) and "BERCHAM RAYA" (To), and
 * Item "SAFETY PIN" (code 01234, Qty auto-populates from item master data)
 * are all real, reusable sandbox records in this environment, same ones
 * already confirmed across every other Inventory module built this
 * session. Reference No (kept to 20 characters or fewer) is this screen's
 * one reliable way to find a specific document again regardless of
 * Draft/Posted status, since Document No. stays "[DEFAULT]" until actually
 * Posted.
 *
 * CONFIRMED LIVE (2026-08-18): like Stock Transfer Request, this screen
 * has NO soft-cancel concept — the row's own action is genuinely a hard
 * "Delete" (same app-wide Delete Confirmation dialog already confirmed in
 * itemPage.js/stockAdjustmentPage.js/stockTransferRequestPage.js), for
 * both DRAFT and POSTED documents. Also confirmed: opening an already-
 * POSTED document via its Document No. link shows a totally different
 * toolbar (New / Preview Report / More Options) with no Cancel action
 * anywhere, including inside More Options — so this screen's "Cancel"
 * requirement is genuinely covered by this row-level Delete, not a
 * separate dialog. See stockTransferPage.js for the full detail. Leaves
 * no residual test data behind — every document created here is deleted
 * by the end of its own test.
 *
 * This module also has its own "Copy From" toolbar button (same as Close
 * Stock Transfer Request) — that flow is covered separately, not in this
 * file, which only covers the manual item-entry flow matching the
 * original recording.
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

  test('[Save Draft] creates then deletes a draft Stock Transfer', async ({ page }) => {
    test.setTimeout(90000);
    const stockTransferPage = new StockTransferPage(page);
    await stockTransferPage.goto();

    await stockTransferPage.createStockTransfer({ referenceNo: 'TESTING_ST_DRAFT', itemName: 'SAFETY PIN' });
    await stockTransferPage.clickSaveDraft();
    expect(await stockTransferPage.getStatus()).toBe('DRAFT');
    await stockTransferPage.clickBack();

    await stockTransferPage.deleteDocument('TESTING_ST_DRAFT');
    expect(await stockTransferPage.isDeleteSuccessful('TESTING_ST_DRAFT')).toBe(true);
  });

  test('[Post] creates then deletes a posted Stock Transfer', async ({ page }) => {
    test.setTimeout(90000);
    const stockTransferPage = new StockTransferPage(page);
    await stockTransferPage.goto();

    await stockTransferPage.createStockTransfer({ referenceNo: 'TESTING_ST_POST', itemName: 'SAFETY PIN' });
    await stockTransferPage.clickPost();
    await stockTransferPage.clickBack();

    await stockTransferPage.deleteDocument('TESTING_ST_POST');
    expect(await stockTransferPage.isDeleteSuccessful('TESTING_ST_POST')).toBe(true);
  });

  test('[Post & New] posts a Stock Transfer via Post & New, then deletes it', async ({ page }) => {
    test.setTimeout(90000);
    const stockTransferPage = new StockTransferPage(page);
    await stockTransferPage.goto();

    await stockTransferPage.createStockTransfer({ referenceNo: 'TESTING_ST_PNEW', itemName: 'SAFETY PIN' });
    await stockTransferPage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await stockTransferPage.clickBack();

    await stockTransferPage.deleteDocument('TESTING_ST_PNEW');
    expect(await stockTransferPage.isDeleteSuccessful('TESTING_ST_PNEW')).toBe(true);
  });

  test('[Cancel] creates a draft Stock Transfer then cancels it via the row\'s Delete action', async ({ page }) => {
    test.setTimeout(90000);
    const stockTransferPage = new StockTransferPage(page);
    await stockTransferPage.goto();

    await stockTransferPage.createStockTransfer({ referenceNo: 'TESTING_ST_CANCEL', itemName: 'SAFETY PIN' });
    await stockTransferPage.clickSaveDraft();
    expect(await stockTransferPage.getStatus()).toBe('DRAFT');
    await stockTransferPage.clickBack();

    // CONFIRMED LIVE (2026-08-18): this screen has no distinct "Cancel"
    // dialog — the row's own "Delete" action is the real cancel/cleanup
    // mechanism, and it's what this scenario exercises.
    await stockTransferPage.deleteDocument('TESTING_ST_CANCEL');
    expect(await stockTransferPage.isDeleteSuccessful('TESTING_ST_CANCEL')).toBe(true);
  });
});
