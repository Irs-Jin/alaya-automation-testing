const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { VendorPage } = require('../../framework/pages/vendorPage');

/**
 * Built by close analogy to tests/account-receivable/customer.spec.js —
 * no Katalon Object Repository entry or codegen recording exists for
 * this screen; see vendorPage.js's own class doc for the full detail on
 * what's UNCONFIRMED and why. Same flow as Customer's Happy Path: create
 * TESTING001 -> Save -> Back -> search TESTING001 -> Edit -> rename to
 * TESTING002 -> Save -> Back -> search TESTING002 -> Delete -> confirm
 * Yes -> assert the "Deleted Successfully" text appears. Leaves no
 * residual test data behind since the created record is deleted at the
 * end.
 */
test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Account Payable > Vendor', () => {

  test('[Happy Path] creates, edits, then deletes a Vendor', async ({ page }) => {
    test.setTimeout(90000);
    const vendorPage = new VendorPage(page);
    await vendorPage.goto();

    await vendorPage.createVendor('TESTING001');
    await vendorPage.editVendor('TESTING001', 'TESTING002');
    await vendorPage.deleteVendor('TESTING002');

    expect(await vendorPage.isDeleteSuccessful()).toBe(true);
  });
});
