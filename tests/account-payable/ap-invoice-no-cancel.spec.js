const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ApInvoicePage } = require('../../framework/pages/apInvoicePage');

/**
 * "No Cancel" variant of ap-invoice.spec.js: same Save Draft/Post/
 * Post & New flows, but deliberately STOPS after each one — no Cancel
 * step.
 *
 * PERMANENT BY OMISSION — READ BEFORE RE-RUNNING: this screen's Cancel
 * action is assumed to still work fine (see ap-invoice.spec.js) — these
 * tests simply don't exercise it. Each test leaves a real Draft/Posted
 * A/P Invoice document behind under vendor "HAZEL CORP" (000001), which
 * CAN be cancelled manually later (or by ap-invoice.spec.js's own full
 * cycle). Running this repeatedly without manual cleanup keeps stacking
 * real leftover documents in whichever environment it targets.
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

  test('[Save Draft, No Cancel] creates a draft A/P Invoice', async ({ page }) => {
    test.setTimeout(90000);
    const apInvoicePage = new ApInvoicePage(page);
    await apInvoicePage.goto();

    await apInvoicePage.createInvoice({
      vendorCode: '000001',
      referenceNo: 'TESTING_APIN_DFT_NC',
      accountCode: 'GST-3010',
      amount: 100,
    });
    await apInvoicePage.clickSaveDraft();
    await apInvoicePage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });

  test('[Post, No Cancel] creates a posted A/P Invoice', async ({ page }) => {
    test.setTimeout(90000);
    const apInvoicePage = new ApInvoicePage(page);
    await apInvoicePage.goto();

    await apInvoicePage.createInvoice({
      vendorCode: '000001',
      referenceNo: 'TESTING_APIN_PST_NC',
      accountCode: 'GST-3010',
      amount: 100,
    });
    await apInvoicePage.clickPost();
    await apInvoicePage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });

  test('[Post & New, No Cancel] posts an invoice via Post & New', async ({ page }) => {
    test.setTimeout(90000);
    const apInvoicePage = new ApInvoicePage(page);
    await apInvoicePage.goto();

    await apInvoicePage.createInvoice({
      vendorCode: '000001',
      referenceNo: 'TESTING_APIN_PNW_NC',
      accountCode: 'GST-3010',
      amount: 100,
    });
    await apInvoicePage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await apInvoicePage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });
});
