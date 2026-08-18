const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { StockReceivePage } = require('../../framework/pages/stockReceivePage');

/**
 * Built from Jin's own Playwright codegen recording (2026-08-17) plus a
 * full live exploration/confirmation of Save Draft, Post, and Post & New
 * against SIT (uat/admin), each followed by Cancel + a fresh grid check to
 * confirm gone. Warehouse "AMPANG" (confirmed the first option in the
 * combo) and Item "SAFETY PIN" (code 01234, Qty/Unit Cost auto-populate
 * from master data) are both real, reusable sandbox records in this
 * environment. Reference No (kept to 20 characters or fewer) is this
 * screen's one reliable way to find a specific document again regardless
 * of Draft/Posted status, since Document No. stays "[DEFAULT]" until
 * actually Posted — filled here even though Jin's own recording left it
 * blank, matching every other module's convention. Leaves no residual
 * test data behind — every document created here is cancelled by the end
 * of its own test.
 *
 * CONFIRMED LIVE: unlike every A/R module built this session, none of
 * Save Draft/Post/Post & New trigger any confirmation dialog on this
 * screen, and cancelling a POSTED document needs no additional "Cancel
 * Reason" step either — see stockReceivePage.js for the full detail.
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

  test('[Save Draft] creates then cancels a draft Stock Receive', async ({ page }) => {
    test.setTimeout(90000);
    const stockReceivePage = new StockReceivePage(page);
    await stockReceivePage.goto();

    await stockReceivePage.createStockReceive({ referenceNo: 'TESTING_SR_DRAFT', itemName: 'SAFETY PIN' });
    await stockReceivePage.clickSaveDraft();
    expect(await stockReceivePage.getStatus()).toBe('DRAFT');
    await stockReceivePage.clickBack();

    await stockReceivePage.cancelDocument('TESTING_SR_DRAFT');
    expect(await stockReceivePage.isCancelSuccessful('TESTING_SR_DRAFT')).toBe(true);
  });

  test('[Post] creates then cancels a posted Stock Receive', async ({ page }) => {
    test.setTimeout(90000);
    const stockReceivePage = new StockReceivePage(page);
    await stockReceivePage.goto();

    await stockReceivePage.createStockReceive({ referenceNo: 'TESTING_SR_POST', itemName: 'SAFETY PIN' });
    await stockReceivePage.clickPost();
    await stockReceivePage.clickBack();

    await stockReceivePage.cancelDocument('TESTING_SR_POST');
    expect(await stockReceivePage.isCancelSuccessful('TESTING_SR_POST')).toBe(true);
  });

  test('[Post & New] posts a Stock Receive via Post & New, then cancels it', async ({ page }) => {
    test.setTimeout(90000);
    const stockReceivePage = new StockReceivePage(page);
    await stockReceivePage.goto();

    await stockReceivePage.createStockReceive({ referenceNo: 'TESTING_SR_PNEW', itemName: 'SAFETY PIN' });
    await stockReceivePage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await stockReceivePage.clickBack();

    await stockReceivePage.cancelDocument('TESTING_SR_PNEW');
    expect(await stockReceivePage.isCancelSuccessful('TESTING_SR_PNEW')).toBe(true);
  });
});
