const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ItemCreatePage } = require('../../framework/pages/itemCreatePage');

/**
 * Built from Jin's own Playwright codegen recording (2026-08-15) plus a
 * full live exploration/confirmation of the same flow against SIT
 * (uat/admin): create TESTING_ITEM_001 (Description + first available Item
 * Group — every other required field across all 12 tabs already has a
 * working default) -> Save -> assert "Saved Successfully" -> Back ->
 * search TESTING_ITEM_001 -> Delete -> confirm Yes -> a fresh re-search
 * confirms the row is genuinely gone (this screen shows no delete banner,
 * so re-searching is the only reliable success signal — see
 * itemCreatePage.js's SAFETY LESSON comment). Leaves no residual test data
 * behind.
 *
 * NAMING NOTE: uses itemCreatePage.js (not itemPage.js) — a teammate
 * independently built their own Item test (create-item.spec.js) against
 * a separately-named itemPage.js already on the shared repo. Both cover
 * the same screen from different angles, kept side by side.
 */
test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Inventory > Item', () => {

  test('[Happy Path] creates then deletes an Item', async ({ page }) => {
    test.setTimeout(90000);
    const itemPage = new ItemCreatePage(page);
    await itemPage.goto();

    await itemPage.createItem('TESTING_ITEM_001');
    expect(await itemPage.isSaveSuccessful()).toBe(true);
    await itemPage.clickBack();

    await itemPage.deleteItem('TESTING_ITEM_001');
    expect(await itemPage.verifyDeleted('TESTING_ITEM_001')).toBe(true);
  });
});
