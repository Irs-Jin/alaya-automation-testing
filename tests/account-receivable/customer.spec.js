const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { CustomerPage } = require('../../framework/pages/customerPage');

/**
 * Converted directly from Jin's own Playwright codegen recording
 * (2026-07-27) plus his screenshots of the Customer creation form and the
 * Customer search/listing grid. Full round trip per Jin's own instructions:
 * create TESTING001 -> Save -> Back -> search TESTING001 -> Edit -> rename
 * to TESTING002 -> Save -> Back -> search TESTING002 -> Delete -> confirm
 * Yes -> assert the "Delete Successful" text appears. Leaves no residual
 * test data behind since the created record is deleted at the end.
 */
test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Account Receivable > Customer', () => {

  test('[Happy Path] creates, edits, then deletes a Customer', async ({ page }) => {
    test.setTimeout(90000);
    const customerPage = new CustomerPage(page);
    await customerPage.goto();

    await customerPage.createCustomer('TESTING001');
    await customerPage.editCustomer('TESTING001', 'TESTING002');
    await customerPage.deleteCustomer('TESTING002');

    expect(await customerPage.isDeleteSuccessful()).toBe(true);
  });
});
