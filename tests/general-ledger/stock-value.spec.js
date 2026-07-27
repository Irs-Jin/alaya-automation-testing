const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { StockValuePage } = require('../../framework/pages/stockValuePage');

/**
 * Converted from Katalon's SV test case, then CORRECTED and extended
 * against Jin's own codegen recording (2026-07-26) after he reported the
 * Katalon-only version "failed" — it never filled a value, and Jin's
 * actual desired flow is: set a value, Save, close the tab, reopen (to
 * prove real persistence), delete the row, Save again. See
 * framework/pages/stockValuePage.js for the confirmed-vs-corrected
 * breakdown, including the Cost Centre OK-click gap this fixed.
 *
 * Test data below is Jin's own — override via env vars if this client's
 * project/cost-centre codes differ:
 *
 *   ALAYA_TEST_PROJECT=<code> ALAYA_TEST_COST_CENTRE=<code> ALAYA_TEST_STOCK_VALUE=<amount> npm test
 */
const PROJECT = process.env.ALAYA_TEST_PROJECT || 'P1';
const COST_CENTRE = process.env.ALAYA_TEST_COST_CENTRE || 'ST18';
const VALUE = process.env.ALAYA_TEST_STOCK_VALUE || '100';

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('General Ledger > Stock Value', () => {
  test.describe.configure({ retries: 0 });

  test('[Happy Path] sets a value, saves, closes, reopens, then deletes and saves', async ({ page }) => {
    test.setTimeout(90000);
    const svPage = new StockValuePage(page);
    await svPage.goto();

    await svPage.createSaveCloseReopenAndDelete({
      project: PROJECT,
      costCentre: COST_CENTRE,
      value: VALUE,
    });

    // After the deletion is saved, the row should be gone — "No data to
    // display" is the grid's own empty-state text (matches Jin's
    // reference screenshot of a successful delete).
    await expect(svPage.listFrame.getByText('No data to display')).toBeVisible();
  });
});
