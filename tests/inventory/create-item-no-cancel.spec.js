const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ItemPage } = require('../../framework/pages/itemPage');

/**
 * "No Cancel" variant of create-item.spec.js: same auto-numbered create
 * flow, but deliberately STOPS after verifying the new row is visible in
 * the listing — no Delete step.
 *
 * PERMANENT BY OMISSION — READ BEFORE RE-RUNNING: this screen's Delete
 * action still works fine (see create-item.spec.js) — this test simply
 * doesn't exercise it. Leaves a real, auto-numbered Item behind (described
 * "TESTING NC <timestamp>"), which CAN be deleted manually later (a
 * freshly-created, never-transacted item is always deletable). Running
 * this repeatedly without manual cleanup keeps stacking real leftover
 * items in whichever environment it targets.
 */
function makeDescription() {
  const ts = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `TESTING NC ${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
}

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Inventory > Item', () => {
  test('[Happy Path, No Cancel] creates an Item and verifies it appears in the listing', async ({ page }) => {
    test.setTimeout(120000);
    const itemPage = new ItemPage(page);
    const description = makeDescription();

    await itemPage.goto();
    const generatedCode = await itemPage.createItem({
      description,
      itemType: 'STOCK ITEM',
    });
    expect(generatedCode).toBeTruthy();

    await itemPage.searchItem(generatedCode);
    expect(await itemPage.isRowVisible(generatedCode)).toBe(true);

    // No cleanup: see class doc — Delete is left unexercised on purpose.
  });
});
