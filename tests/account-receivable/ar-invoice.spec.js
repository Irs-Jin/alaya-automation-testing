const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ArInvoicePage } = require('../../framework/pages/arInvoicePage');

/**
 * Built from Jin's own Playwright codegen recording (2026-08-15) plus a
 * full live exploration/confirmation of Save Draft, Post, and Post & New
 * against SIT (uat/admin), each followed by Cancel + a fresh grid check to
 * confirm gone. Customer "YEONG" (code 000001) confirmed a safe, reusable
 * sandbox customer for repeated RM100 test invoices. Account No.
 * "GST-3010" is simply the first available option in that dropdown (per
 * the person requesting this test — any available account is fine), not a
 * specific required value. Reference No (kept to 20 characters or fewer,
 * matching apPaymentPage.js's fillReferenceNo() convention) is this
 * screen's one reliable way to find a specific document again regardless
 * of Draft/Posted status, since Document No. stays "[DEFAULT]" until
 * actually Posted. Leaves no residual test data behind — every document
 * created here is cancelled by the end of its own test.
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

  test('[Save Draft] creates then cancels a draft A/R Invoice', async ({ page }) => {
    test.setTimeout(90000);
    const arInvoicePage = new ArInvoicePage(page);
    await arInvoicePage.goto();

    await arInvoicePage.createInvoice({
      customerCode: '000001',
      referenceNo: 'TESTING_AR_DRAFT',
      accountCode: 'GST-3010',
      amount: 100,
    });
    await arInvoicePage.clickSaveDraft();
    await arInvoicePage.clickBack();

    // No in-form success banner for Save Draft on this screen (unlike
    // A/P Payment) — the listing grid itself is the proof.
    await arInvoicePage.cancelDocument('TESTING_AR_DRAFT');
    expect(await arInvoicePage.isCancelSuccessful()).toBe(true);
  });

  test('[Post] creates then cancels a posted A/R Invoice', async ({ page }) => {
    test.setTimeout(90000);
    const arInvoicePage = new ArInvoicePage(page);
    await arInvoicePage.goto();

    await arInvoicePage.createInvoice({
      customerCode: '000001',
      referenceNo: 'TESTING_AR_POST',
      accountCode: 'GST-3010',
      amount: 100,
    });
    await arInvoicePage.clickPost();
    await arInvoicePage.clickBack();

    await arInvoicePage.cancelDocument('TESTING_AR_POST');
    expect(await arInvoicePage.isCancelSuccessful()).toBe(true);
  });

  test('[Post & New] posts an invoice via Post & New, then cancels it', async ({ page }) => {
    test.setTimeout(90000);
    const arInvoicePage = new ArInvoicePage(page);
    await arInvoicePage.goto();

    await arInvoicePage.createInvoice({
      customerCode: '000001',
      referenceNo: 'TESTING_AR_PNEW',
      accountCode: 'GST-3010',
      amount: 100,
    });
    await arInvoicePage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await arInvoicePage.clickBack();

    await arInvoicePage.cancelDocument('TESTING_AR_PNEW');
    expect(await arInvoicePage.isCancelSuccessful()).toBe(true);
  });
});
