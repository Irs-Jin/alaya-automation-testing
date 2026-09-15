const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { StockIssuePage } = require('../../framework/pages/stockIssuePage');

/**
 * "No Cancel" variant of stock-issue.spec.js: same Save Draft/Post/
 * Post & New flows, but deliberately STOPS after each one — no Cancel
 * step.
 *
 * PERMANENT BY OMISSION — READ BEFORE RE-RUNNING: this screen's Cancel
 * action still works fine (see stock-issue.spec.js) — these tests simply
 * don't exercise it. Each test leaves a real Draft/Posted Stock Issue
 * document behind (Warehouse AMPANG, Item "SAFETY PIN"), which CAN be
 * cancelled manually later. Running this repeatedly without manual
 * cleanup keeps stacking real leftover documents in whichever
 * environment it targets.
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

  test('[Save Draft, No Cancel] creates a draft Stock Issue', async ({ page }) => {
    test.setTimeout(90000);
    const stockIssuePage = new StockIssuePage(page);
    await stockIssuePage.goto();

    await stockIssuePage.createStockIssue({ referenceNo: 'TESTING_SI_DFT_NC', itemName: 'SAFETY PIN' });
    await stockIssuePage.clickSaveDraft();
    expect(await stockIssuePage.getStatus()).toBe('DRAFT');
    await stockIssuePage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });

  test('[Post, No Cancel] creates a posted Stock Issue', async ({ page }) => {
    test.setTimeout(90000);
    const stockIssuePage = new StockIssuePage(page);
    await stockIssuePage.goto();

    await stockIssuePage.createStockIssue({ referenceNo: 'TESTING_SI_PST_NC', itemName: 'SAFETY PIN' });
    await stockIssuePage.clickPost();
    await stockIssuePage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });

  test('[Post & New, No Cancel] posts a Stock Issue via Post & New', async ({ page }) => {
    test.setTimeout(90000);
    const stockIssuePage = new StockIssuePage(page);
    await stockIssuePage.goto();

    await stockIssuePage.createStockIssue({ referenceNo: 'TESTING_SI_PNW_NC', itemName: 'SAFETY PIN' });
    await stockIssuePage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await stockIssuePage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });
});
