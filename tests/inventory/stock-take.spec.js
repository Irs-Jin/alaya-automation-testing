const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { StockTakePage } = require('../../framework/pages/stockTakePage');

/**
 * Built from Jin's own Playwright codegen recording (2026-08-18) plus a
 * full live exploration/confirmation against SIT (uat/admin). Warehouse
 * "AMPANG" and its own bin location ("AMPANG GUNUNG RAPAT BIN LOCATION"),
 * and Item "SAFETY PIN" (code 01234, On Hand Qty auto-shown from master
 * data) are all real, reusable sandbox records in this environment, same
 * ones already confirmed across every other Inventory module built this
 * session. Reference No (kept to 20 characters or fewer) is this screen's
 * one reliable way to find a specific document again regardless of
 * Draft/Posted status, since Document No. stays "[DEFAULT]" until
 * actually Posted.
 *
 * CONFIRMED LIVE (2026-08-18): Physical Qty is NOT required to Save
 * Draft, but IS mandatory to Post (a real validation alert blocks Posting
 * without it) — the Post and Post & New scenarios below fill it in
 * (matching On Hand Qty, so Different Qty comes out to 0) before posting;
 * Save Draft and Cancel do not need it.
 *
 * CONFIRMED LIVE (2026-08-18): unlike Stock Transfer Request/Stock
 * Transfer/Close Stock Transfer Request (all hard-Delete-only), this
 * screen genuinely has a soft "Cancel" action (same app-wide Cancel
 * Confirmation dialog already confirmed on A/R Invoice/Stock Receive/
 * Stock Issue), confirmed working for BOTH DRAFT and POSTED documents —
 * see stockTakePage.js for the full detail. This covers this screen's
 * "cancel" requirement via its own real cleanup mechanism. Leaves no
 * residual test data behind — every document created here is cancelled
 * by the end of its own test.
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

  test('[Save Draft] creates then cancels a draft Stock Take', async ({ page }) => {
    test.setTimeout(90000);
    const stockTakePage = new StockTakePage(page);
    await stockTakePage.goto();

    await stockTakePage.createStockTake({ referenceNo: 'TESTING_STK_DRAFT', itemName: 'SAFETY PIN' });
    await stockTakePage.clickSaveDraft();
    expect(await stockTakePage.getStatus()).toBe('DRAFT');
    await stockTakePage.clickBack();

    await stockTakePage.cancelDocument('TESTING_STK_DRAFT');
    expect(await stockTakePage.isCancelSuccessful('TESTING_STK_DRAFT')).toBe(true);
  });

  test('[Post] creates then cancels a posted Stock Take', async ({ page }) => {
    test.setTimeout(90000);
    const stockTakePage = new StockTakePage(page);
    await stockTakePage.goto();

    await stockTakePage.createStockTake({ referenceNo: 'TESTING_STK_POST', itemName: 'SAFETY PIN' });
    await stockTakePage.fillPhysicalQty(198);
    await stockTakePage.clickPost();
    await stockTakePage.clickBack();

    await stockTakePage.cancelDocument('TESTING_STK_POST');
    expect(await stockTakePage.isCancelSuccessful('TESTING_STK_POST')).toBe(true);
  });

  test('[Post & New] posts a Stock Take via Post & New, then cancels it', async ({ page }) => {
    test.setTimeout(90000);
    const stockTakePage = new StockTakePage(page);
    await stockTakePage.goto();

    await stockTakePage.createStockTake({ referenceNo: 'TESTING_STK_PNEW', itemName: 'SAFETY PIN' });
    await stockTakePage.fillPhysicalQty(198);
    await stockTakePage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await stockTakePage.clickBack();

    await stockTakePage.cancelDocument('TESTING_STK_PNEW');
    expect(await stockTakePage.isCancelSuccessful('TESTING_STK_PNEW')).toBe(true);
  });

  test('[Cancel] creates a draft Stock Take then cancels it', async ({ page }) => {
    test.setTimeout(90000);
    const stockTakePage = new StockTakePage(page);
    await stockTakePage.goto();

    await stockTakePage.createStockTake({ referenceNo: 'TESTING_STK_CANCEL', itemName: 'SAFETY PIN' });
    await stockTakePage.clickSaveDraft();
    expect(await stockTakePage.getStatus()).toBe('DRAFT');
    await stockTakePage.clickBack();

    await stockTakePage.cancelDocument('TESTING_STK_CANCEL');
    expect(await stockTakePage.isCancelSuccessful('TESTING_STK_CANCEL')).toBe(true);
  });
});
