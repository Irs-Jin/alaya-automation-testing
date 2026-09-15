const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ItemCreatePage } = require('../../framework/pages/itemCreatePage');

/**
 * "No Cancel" variant of item.spec.js: same create flow, but deliberately
 * STOPS after Save + Back — no Delete step.
 *
 * PERMANENT BY OMISSION — READ BEFORE RE-RUNNING: this screen's Delete
 * action still works fine (see item.spec.js) — this test simply doesn't
 * exercise it. Leaves a real Item "TESTING_ITEM_NC001" behind, which CAN
 * be deleted manually later (a freshly-created, never-transacted item is
 * always deletable). Running this repeatedly without manual cleanup keeps
 * stacking real leftover items in whichever environment it targets.
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

  test('[Happy Path, No Cancel] creates an Item', async ({ page }) => {
    test.setTimeout(90000);
    const itemPage = new ItemCreatePage(page);
    await itemPage.goto();

    await itemPage.createItem('TESTING_ITEM_NC001');
    expect(await itemPage.isSaveSuccessful()).toBe(true);
    await itemPage.clickBack();

    // No cleanup: see class doc — Delete is left unexercised on purpose.
  });
});
