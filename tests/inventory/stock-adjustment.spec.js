const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { StockAdjustmentPage } = require('../../framework/pages/stockAdjustmentPage');

/**
 * Built from Jin's own Playwright codegen recording (2026-08-17) plus a
 * full live exploration/confirmation of Save Draft, Post, and Post & New
 * against SIT (uat/admin), each followed by Delete + a fresh grid check to
 * confirm gone. Warehouse "AMPANG", Reason "ADJUST", and Item "SAFETY PIN"
 * (code 01234, AdjQty auto-populates from master data) are all real,
 * reusable sandbox records in this environment. Reference No (kept to 20
 * characters or fewer) is this screen's one reliable way to find a
 * specific document again regardless of Draft/Posted status, since
 * Document No. stays "[DEFAULT]" until actually Posted.
 *
 * CONFIRMED LIVE: unlike every other transactional module in this app,
 * Stock Adjustment has NO soft-cancel concept — the row's own action is
 * genuinely a hard "Delete" (same app-wide Delete Confirmation dialog
 * already confirmed in itemPage.js), for both DRAFT and POSTED documents.
 * This covers this screen's "cancel" requirement via its own real
 * cleanup mechanism — see stockAdjustmentPage.js for the full detail.
 * Leaves no residual test data behind — every document created here is
 * deleted by the end of its own test.
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

  test('[Save Draft] creates then deletes a draft Stock Adjustment', async ({ page }) => {
    test.setTimeout(90000);
    const stockAdjustmentPage = new StockAdjustmentPage(page);
    await stockAdjustmentPage.goto();

    await stockAdjustmentPage.createStockAdjustment({ referenceNo: 'TESTING_SA_DRAFT', itemName: 'SAFETY PIN' });
    await stockAdjustmentPage.clickSaveDraft();
    expect(await stockAdjustmentPage.getStatus()).toBe('DRAFT');
    await stockAdjustmentPage.clickBack();

    await stockAdjustmentPage.deleteDocument('TESTING_SA_DRAFT');
    expect(await stockAdjustmentPage.isDeleteSuccessful('TESTING_SA_DRAFT')).toBe(true);
  });

  test('[Post] creates then deletes a posted Stock Adjustment', async ({ page }) => {
    test.setTimeout(90000);
    const stockAdjustmentPage = new StockAdjustmentPage(page);
    await stockAdjustmentPage.goto();

    await stockAdjustmentPage.createStockAdjustment({ referenceNo: 'TESTING_SA_POST', itemName: 'SAFETY PIN' });
    await stockAdjustmentPage.clickPost();
    await stockAdjustmentPage.clickBack();

    await stockAdjustmentPage.deleteDocument('TESTING_SA_POST');
    expect(await stockAdjustmentPage.isDeleteSuccessful('TESTING_SA_POST')).toBe(true);
  });

  test('[Post & New] posts a Stock Adjustment via Post & New, then deletes it', async ({ page }) => {
    test.setTimeout(90000);
    const stockAdjustmentPage = new StockAdjustmentPage(page);
    await stockAdjustmentPage.goto();

    await stockAdjustmentPage.createStockAdjustment({ referenceNo: 'TESTING_SA_PNEW', itemName: 'SAFETY PIN' });
    await stockAdjustmentPage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await stockAdjustmentPage.clickBack();

    await stockAdjustmentPage.deleteDocument('TESTING_SA_PNEW');
    expect(await stockAdjustmentPage.isDeleteSuccessful('TESTING_SA_PNEW')).toBe(true);
  });
});
