const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ItemPage } = require('../../framework/pages/itemPage');

/**
 * Inventory > Item Master — happy-path create.
 *
 * GOAL (user-approved): create an item WITHOUT filling the Item Code — the
 * form keeps the `[DEFAULT]` placeholder and the system auto-numbers it on
 * save (the form hint reads "Next Possible No. ..."). Only Description (and
 * Item Type, which already defaults to "Stock Item") is set. The generated
 * code is read back from the top row of the listing grid after Back, then
 * verified present, then deleted.
 *
 * SOURCE / GROUND-TRUTH STATUS:
 * - CONFIRMED (Katalon Object Repository): the Item module iframe
 *   (`.../Modules/Inventory/m_ItemMaster.aspx`), the listing grid id, the
 *   "Warehouse and Quantity" tab id, the Discontinue checkbox id.
 * - CONFIRMED (live on UAT, 2026-08-16): the creation form is a SEPARATE
 *   iframe (`m_ItemCreationDetails.aspx?EncData=...`); New button
 *   `..._gvItemMaster_header38_Add`; header field ids (Item Type combo
 *   `..._ddlItemType_...`, Description `..._txtDescription_I`); the
 *   dropdown option cells ("Stock Item", "Service Item", ...).
 * - UNCONFIRMED (marked as guesses in itemPage.js, verified live on first
 *   headed run per CONTRIBUTING.md): Item Associated Group combo id on the
 *   Warehouse and Quantity tab, Save/Back toolbar ids.
 *
 * HYGIENE: the created item is searched, verified visible, then deleted at
 * the end so no residual TESTING* row is left behind (per CONTRIBUTING.md
 * section 6). A freshly-created, never-transacted item is deletable
 * (delete is only blocked for items with transactions/menu/FK usage).
 */
function makeDescription() {
  const ts = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `TESTING ${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
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
  test('[Happy Path] creates an Item and verifies it appears in the listing', async ({ page }) => {
    test.setTimeout(120000);
    const itemPage = new ItemPage(page);
    const description = makeDescription();

    await itemPage.goto();
    // Item Code is left as [DEFAULT] and auto-numbered by the system on
    // save; createItem() returns the generated code read back from the
    // form field, which we then verify in the listing and delete.
    const generatedCode = await itemPage.createItem({
      description,
      itemType: 'STOCK ITEM',
    });
    expect(generatedCode).toBeTruthy();

    await itemPage.searchItem(generatedCode);
    expect(await itemPage.isRowVisible(generatedCode)).toBe(true);

    await itemPage.deleteItem(generatedCode);
  });
});