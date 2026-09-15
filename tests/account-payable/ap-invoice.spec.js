const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ApInvoicePage } = require('../../framework/pages/apInvoicePage');

/**
 * Built by close analogy to tests/account-receivable/ar-invoice.spec.js —
 * no Katalon Object Repository entry or codegen recording exists for
 * this screen; see apInvoicePage.js's own class doc for the full detail
 * on what's UNCONFIRMED and why. Vendor "HAZEL CORP" (code 000001,
 * already confirmed a safe reusable sandbox vendor via
 * apPaymentPage.js/ap-payment.spec.js) and Account No. "GST-3010" (same
 * shared GL account already confirmed usable on the A/R side) are reused
 * here. Leaves no residual test data behind — every document created
 * here is cancelled by the end of its own test.
 */
test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Account Payable > A/P Invoice', () => {

  test('[Save Draft] creates then cancels a draft A/P Invoice', async ({ page }) => {
    test.setTimeout(90000);
    const apInvoicePage = new ApInvoicePage(page);
    await apInvoicePage.goto();

    await apInvoicePage.createInvoice({
      vendorCode: '000001',
      referenceNo: 'TESTING_APIN_DRAFT',
      accountCode: 'GST-3010',
      amount: 100,
    });
    await apInvoicePage.clickSaveDraft();
    await apInvoicePage.clickBack();

    await apInvoicePage.cancelDocument('TESTING_APIN_DRAFT');
    expect(await apInvoicePage.isCancelSuccessful()).toBe(true);
  });

  test('[Post] creates then cancels a posted A/P Invoice', async ({ page }) => {
    test.setTimeout(90000);
    const apInvoicePage = new ApInvoicePage(page);
    await apInvoicePage.goto();

    await apInvoicePage.createInvoice({
      vendorCode: '000001',
      referenceNo: 'TESTING_APIN_POST',
      accountCode: 'GST-3010',
      amount: 100,
    });
    await apInvoicePage.clickPost();
    await apInvoicePage.clickBack();

    await apInvoicePage.cancelDocument('TESTING_APIN_POST');
    expect(await apInvoicePage.isCancelSuccessful()).toBe(true);
  });

  test('[Post & New] posts an invoice via Post & New, then cancels it', async ({ page }) => {
    test.setTimeout(90000);
    const apInvoicePage = new ApInvoicePage(page);
    await apInvoicePage.goto();

    await apInvoicePage.createInvoice({
      vendorCode: '000001',
      referenceNo: 'TESTING_APIN_PNEW',
      accountCode: 'GST-3010',
      amount: 100,
    });
    await apInvoicePage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await apInvoicePage.clickBack();

    await apInvoicePage.cancelDocument('TESTING_APIN_PNEW');
    expect(await apInvoicePage.isCancelSuccessful()).toBe(true);
  });
});
