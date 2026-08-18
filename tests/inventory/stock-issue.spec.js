const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { StockIssuePage } = require('../../framework/pages/stockIssuePage');

/**
 * Built from Jin's own Playwright codegen recording (2026-08-17) plus a
 * full live exploration/confirmation of Save Draft, Post, and Post & New
 * against SIT (uat/admin), each followed by Cancel + a fresh grid check to
 * confirm gone. Warehouse "AMPANG" and Item "SAFETY PIN" (code 01234,
 * Qty/Unit Cost auto-populate from master data) are both real, reusable
 * sandbox records in this environment, same ones already confirmed in
 * stockReceivePage.js's work. Reference No (kept to 20 characters or
 * fewer) is this screen's one reliable way to find a specific document
 * again regardless of Draft/Posted status, since Document No. stays
 * "[DEFAULT]" until actually Posted — filled here even though Jin's own
 * recording left it blank, matching every other module's convention.
 * Leaves no residual test data behind — every document created here is
 * cancelled by the end of its own test.
 *
 * CONFIRMED LIVE: like Stock Receive, none of Save Draft/Post/Post & New
 * trigger any confirmation dialog, and cancelling a POSTED document needs
 * no additional "Cancel Reason" step — see stockIssuePage.js for the full
 * detail, including the one genuine difference from Stock Receive: Post &
 * New does NOT open a report tab on this screen.
 */
test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Inventory > Stock Issue', () => {

  test('[Save Draft] creates then cancels a draft Stock Issue', async ({ page }) => {
    test.setTimeout(90000);
    const stockIssuePage = new StockIssuePage(page);
    await stockIssuePage.goto();

    await stockIssuePage.createStockIssue({ referenceNo: 'TESTING_SI_DRAFT', itemName: 'SAFETY PIN' });
    await stockIssuePage.clickSaveDraft();
    expect(await stockIssuePage.getStatus()).toBe('DRAFT');
    await stockIssuePage.clickBack();

    await stockIssuePage.cancelDocument('TESTING_SI_DRAFT');
    expect(await stockIssuePage.isCancelSuccessful('TESTING_SI_DRAFT')).toBe(true);
  });

  test('[Post] creates then cancels a posted Stock Issue', async ({ page }) => {
    test.setTimeout(90000);
    const stockIssuePage = new StockIssuePage(page);
    await stockIssuePage.goto();

    await stockIssuePage.createStockIssue({ referenceNo: 'TESTING_SI_POST', itemName: 'SAFETY PIN' });
    await stockIssuePage.clickPost();
    await stockIssuePage.clickBack();

    await stockIssuePage.cancelDocument('TESTING_SI_POST');
    expect(await stockIssuePage.isCancelSuccessful('TESTING_SI_POST')).toBe(true);
  });

  test('[Post & New] posts a Stock Issue via Post & New, then cancels it', async ({ page }) => {
    test.setTimeout(90000);
    const stockIssuePage = new StockIssuePage(page);
    await stockIssuePage.goto();

    await stockIssuePage.createStockIssue({ referenceNo: 'TESTING_SI_PNEW', itemName: 'SAFETY PIN' });
    await stockIssuePage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await stockIssuePage.clickBack();

    await stockIssuePage.cancelDocument('TESTING_SI_PNEW');
    expect(await stockIssuePage.isCancelSuccessful('TESTING_SI_PNEW')).toBe(true);
  });
});
