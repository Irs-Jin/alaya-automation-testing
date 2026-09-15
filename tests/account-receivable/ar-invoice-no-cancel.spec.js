const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ArInvoicePage } = require('../../framework/pages/arInvoicePage');

/**
 * "No Cancel" variant of ar-invoice.spec.js: same Save Draft/Post/
 * Post & New flows, but deliberately STOPS after each one — no Cancel
 * step.
 *
 * PERMANENT BY OMISSION — READ BEFORE RE-RUNNING: this screen's Cancel
 * action still works fine (see ar-invoice.spec.js) — these tests simply
 * don't exercise it. Each test leaves a real Draft/Posted A/R Invoice
 * document behind under customer "YEONG" (000001), which CAN be cancelled
 * manually later (or by ar-invoice.spec.js's own full cycle). Running this
 * repeatedly without manual cleanup keeps stacking real leftover documents
 * in whichever environment it targets.
 */
test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Account Receivable > A/R Invoice', () => {

  test('[Save Draft, No Cancel] creates a draft A/R Invoice', async ({ page }) => {
    test.setTimeout(90000);
    const arInvoicePage = new ArInvoicePage(page);
    await arInvoicePage.goto();

    await arInvoicePage.createInvoice({
      customerCode: '000001',
      referenceNo: 'TESTING_AR_DFT_NC',
      accountCode: 'GST-3010',
      amount: 100,
    });
    await arInvoicePage.clickSaveDraft();
    await arInvoicePage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });

  test('[Post, No Cancel] creates a posted A/R Invoice', async ({ page }) => {
    test.setTimeout(90000);
    const arInvoicePage = new ArInvoicePage(page);
    await arInvoicePage.goto();

    await arInvoicePage.createInvoice({
      customerCode: '000001',
      referenceNo: 'TESTING_AR_PST_NC',
      accountCode: 'GST-3010',
      amount: 100,
    });
    await arInvoicePage.clickPost();
    await arInvoicePage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });

  test('[Post & New, No Cancel] posts an invoice via Post & New', async ({ page }) => {
    test.setTimeout(90000);
    const arInvoicePage = new ArInvoicePage(page);
    await arInvoicePage.goto();

    await arInvoicePage.createInvoice({
      customerCode: '000001',
      referenceNo: 'TESTING_AR_PNW_NC',
      accountCode: 'GST-3010',
      amount: 100,
    });
    await arInvoicePage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await arInvoicePage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });
});
