const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { StockTransferRequestPage } = require('../../framework/pages/stockTransferRequestPage');

/**
 * Built from Jin's own Playwright codegen recording (2026-08-17) plus a
 * full live exploration/confirmation of Save Draft, Post, and Post & New
 * against SIT (uat/admin), each followed by Delete + a fresh grid check to
 * confirm gone. Warehouses "AMPANG" (From) and "BERCHAM RAYA" (To), and
 * Item "SAFETY PIN" (code 01234, Qty auto-populates from master data) are
 * all real, reusable sandbox records in this environment, same ones
 * already confirmed across every other Inventory module built this
 * session. Reference No (kept to 20 characters or fewer) is this screen's
 * one reliable way to find a specific document again regardless of
 * Draft/Posted status, since Document No. stays "[DEFAULT]" until
 * actually Posted.
 *
 * CONFIRMED LIVE: like Stock Adjustment, Stock Transfer Request has NO
 * soft-cancel concept — the row's own action is genuinely a hard
 * "Delete" (same app-wide Delete Confirmation dialog already confirmed
 * in itemPage.js/stockAdjustmentPage.js), for both DRAFT and POSTED
 * documents. This covers this screen's "cancel" requirement via its own
 * real cleanup mechanism — see stockTransferRequestPage.js for the full
 * detail. Leaves no residual test data behind — every document created
 * here is deleted by the end of its own test.
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

  test('[Save Draft] creates then deletes a draft Stock Transfer Request', async ({ page }) => {
    test.setTimeout(90000);
    const stockTransferRequestPage = new StockTransferRequestPage(page);
    await stockTransferRequestPage.goto();

    await stockTransferRequestPage.createStockTransferRequest({ referenceNo: 'TESTING_STR_DRAFT', itemName: 'SAFETY PIN' });
    await stockTransferRequestPage.clickSaveDraft();
    expect(await stockTransferRequestPage.getStatus()).toBe('DRAFT');
    await stockTransferRequestPage.clickBack();

    await stockTransferRequestPage.deleteDocument('TESTING_STR_DRAFT');
    expect(await stockTransferRequestPage.isDeleteSuccessful('TESTING_STR_DRAFT')).toBe(true);
  });

  test('[Post] creates then deletes a posted Stock Transfer Request', async ({ page }) => {
    test.setTimeout(90000);
    const stockTransferRequestPage = new StockTransferRequestPage(page);
    await stockTransferRequestPage.goto();

    await stockTransferRequestPage.createStockTransferRequest({ referenceNo: 'TESTING_STR_POST', itemName: 'SAFETY PIN' });
    await stockTransferRequestPage.clickPost();
    await stockTransferRequestPage.clickBack();

    await stockTransferRequestPage.deleteDocument('TESTING_STR_POST');
    expect(await stockTransferRequestPage.isDeleteSuccessful('TESTING_STR_POST')).toBe(true);
  });

  test('[Post & New] posts a Stock Transfer Request via Post & New, then deletes it', async ({ page }) => {
    test.setTimeout(90000);
    const stockTransferRequestPage = new StockTransferRequestPage(page);
    await stockTransferRequestPage.goto();

    await stockTransferRequestPage.createStockTransferRequest({ referenceNo: 'TESTING_STR_PNEW', itemName: 'SAFETY PIN' });
    await stockTransferRequestPage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await stockTransferRequestPage.clickBack();

    await stockTransferRequestPage.deleteDocument('TESTING_STR_PNEW');
    expect(await stockTransferRequestPage.isDeleteSuccessful('TESTING_STR_PNEW')).toBe(true);
  });
});
