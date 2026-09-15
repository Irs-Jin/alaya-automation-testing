const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { VendorPage } = require('../../framework/pages/vendorPage');

/**
 * "No Cancel" variant of vendor.spec.js: same create + edit flow, but
 * deliberately STOPS after the edit — no Delete step.
 *
 * PERMANENT BY OMISSION — READ BEFORE RE-RUNNING: this screen's Delete
 * action still works fine (see vendor.spec.js) — this test simply
 * doesn't exercise it. Leaves a real Vendor "TESTING_NC002" behind
 * (created as "TESTING_NC001", then renamed), which CAN be deleted
 * manually later (a freshly-created, never-transacted vendor is always
 * deletable, same as Item). Running this repeatedly without manual
 * cleanup keeps stacking real leftover vendors in whichever environment
 * it targets.
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

  test('[Happy Path, No Cancel] creates then edits a Vendor', async ({ page }) => {
    test.setTimeout(90000);
    const vendorPage = new VendorPage(page);
    await vendorPage.goto();

    await vendorPage.createVendor('TESTING_NC001');
    await vendorPage.editVendor('TESTING_NC001', 'TESTING_NC002');

    // No cleanup: see class doc — Delete is left unexercised on purpose.
  });
});
