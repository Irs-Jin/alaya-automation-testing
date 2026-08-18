const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ArPaymentPage } = require('../../framework/pages/arPaymentPage');

/**
 * Built from Jin's own Playwright codegen recording (2026-08-15) plus a
 * full live exploration/confirmation of Save Draft, Post, and Post & New
 * against SIT (uat/admin), each followed by Cancel + a fresh grid check to
 * confirm gone. Customer "YEONG" (code 000001) confirmed a safe, reusable
 * sandbox customer for repeated RM100 test payments (same one already
 * used in arInvoicePage.js). Reference No (kept to 20 characters or fewer)
 * is this screen's one reliable way to find a specific document again
 * regardless of Draft/Posted status, since Document No. stays "[DEFAULT]"
 * until actually Posted. Leaves no residual test data behind — every
 * document created here is cancelled by the end of its own test.
 */
test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Account Receivable > A/R Payment', () => {

  test('[Save Draft] creates then cancels a draft A/R Payment', async ({ page }) => {
    test.setTimeout(90000);
    const arPaymentPage = new ArPaymentPage(page);
    await arPaymentPage.goto();

    await arPaymentPage.createPayment({ customerCode: '000001', referenceNo: 'TESTING_ARP_DRAFT', amount: 100 });
    await arPaymentPage.clickSaveDraft();
    expect(await arPaymentPage.isSaveSuccessful()).toBe(true);
    expect(await arPaymentPage.getStatus()).toBe('DRAFT');
    await arPaymentPage.clickBack();

    await arPaymentPage.cancelDocument('TESTING_ARP_DRAFT');
    expect(await arPaymentPage.isCancelSuccessful()).toBe(true);
  });

  test('[Post] creates then cancels a posted A/R Payment', async ({ page }) => {
    test.setTimeout(90000);
    const arPaymentPage = new ArPaymentPage(page);
    await arPaymentPage.goto();

    await arPaymentPage.createPayment({ customerCode: '000001', referenceNo: 'TESTING_ARP_POST', amount: 100 });
    await arPaymentPage.clickPost();
    await arPaymentPage.clickBack();

    await arPaymentPage.cancelDocument('TESTING_ARP_POST');
    expect(await arPaymentPage.isCancelSuccessful()).toBe(true);
  });

  test('[Post & New] posts a payment via Post & New, then cancels it', async ({ page }) => {
    test.setTimeout(90000);
    const arPaymentPage = new ArPaymentPage(page);
    await arPaymentPage.goto();

    await arPaymentPage.createPayment({ customerCode: '000001', referenceNo: 'TESTING_ARP_PNEW', amount: 100 });
    await arPaymentPage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await arPaymentPage.clickBack();

    await arPaymentPage.cancelDocument('TESTING_ARP_PNEW');
    expect(await arPaymentPage.isCancelSuccessful()).toBe(true);
  });
});
