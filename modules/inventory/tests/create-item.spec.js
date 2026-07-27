const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { CreateItemPage } = require('../pages/createItemPage');

/**
 * Field name note: ALAYA's Create Item form calls its main text field
 * "Description" (confirmed via codegen recording), not "Item Name" — this
 * spec uses `description` to match. Item Code, UOM, and the Serial Item
 * checkbox are still unconfirmed guesses in createItemPage.js — see the
 * TODO(Jin) comments there. Tests involving those fields may not behave as
 * written until confirmed; adjust or skip them for now if they fail for
 * that reason rather than a real bug.
 *
 * Category tags in test titles follow your standard convention: Happy Path,
 * Negative, UI, Edge Case, Security, Integration, Formula.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Inventory > Item Master > Create New Item', () => {

  test('[Happy Path] creates a new standard item with valid data', async ({ page }) => {
    const createItemPage = new CreateItemPage(page);
    await createItemPage.goto();

    await createItemPage.createItem({
      description: `Test Item - Automation ${Date.now()}`,
      itemGroup: '11', // TODO(Jin): confirm this is a valid Item Group value in your test env (seen in codegen recording)
      itemCode: `ITM-${Date.now()}`, // TODO(Jin): unconfirmed selector — may not actually fill
      unitPrice: 10.5,               // TODO(Jin): unconfirmed selector — may not actually fill
    });

    await createItemPage.expectCreateSuccess();
  });

  test('[Happy Path] creates a serial-tracked item', async ({ page }) => {
    const createItemPage = new CreateItemPage(page);
    await createItemPage.goto();

    await createItemPage.createItem({
      description: `Test Serial Item - Automation ${Date.now()}`,
      itemGroup: '11',
      itemCode: `ITM-SER-${Date.now()}`,
      unitPrice: 25,
      isSerialItem: true, // TODO(Jin): unconfirmed selector — may not actually check
    });

    await createItemPage.expectCreateSuccess();
  });

  test('[Negative] blocks save when Description is empty', async ({ page }) => {
    const createItemPage = new CreateItemPage(page);
    await createItemPage.goto();

    await createItemPage.createItem({
      description: '',
      itemGroup: '11',
    });

    const errors = await createItemPage.getValidationErrors();
    expect(errors.join(' ')).toMatch(/description/i);
  });

  test('[Negative] blocks save on duplicate Item Code', async ({ page }) => {
    // TODO(Jin): seed this code in test data beforehand — this test is a
    // placeholder until Item Code's real selector is confirmed.
    const createItemPage = new CreateItemPage(page);
    await createItemPage.goto();

    await createItemPage.createItem({
      description: 'Duplicate Code Attempt',
      itemGroup: '11',
      itemCode: 'ITM-DUPLICATE-TEST',
    });

    const errors = await createItemPage.getValidationErrors();
    expect(errors.join(' ')).toMatch(/already exists|duplicate/i);
  });

  test('[Edge Case] rejects negative unit price', async ({ page }) => {
    // TODO(Jin): placeholder until Unit Price's real selector is confirmed.
    const createItemPage = new CreateItemPage(page);
    await createItemPage.goto();

    await createItemPage.createItem({
      description: 'Negative Price Item',
      itemGroup: '11',
      unitPrice: -1,
    });

    const errors = await createItemPage.getValidationErrors();
    expect(errors.join(' ')).toMatch(/price|invalid/i);
  });

  test('[UI] Save button is disabled until required fields are filled', async ({ page }) => {
    const createItemPage = new CreateItemPage(page);
    await createItemPage.goto();
    const f = await createItemPage.fields();

    await expect(f.saveButton).toBeDisabled();
    await f.description.fill(`UI Enable Test ${Date.now()}`);
    await createItemPage.selectItemGroup('11');
    await expect(f.saveButton).toBeEnabled();
  });

  test('[Formula] Unit Price accepts up to 2 decimal places', async ({ page }) => {
    // TODO(Jin): placeholder until Unit Price's real selector is confirmed;
    // once saved, also assert the displayed price is rounded/truncated per
    // your business rule (e.g. 12.35 or 12.34).
    const createItemPage = new CreateItemPage(page);
    await createItemPage.goto();

    await createItemPage.createItem({
      description: 'Decimal Price Item',
      itemGroup: '11',
      unitPrice: 12.345,
    });

    await createItemPage.expectCreateSuccess();
  });

});
