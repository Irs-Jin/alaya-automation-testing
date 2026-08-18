const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ArPaymentRefundPage } = require('../../framework/pages/arPaymentRefundPage');

/**
 * Built from Jin's own Playwright codegen recording (2026-08-16) plus a
 * full live exploration/confirmation of Save Draft, Post, and Post & New
 * against SIT (uat/admin), each followed by Cancel + a fresh grid check to
 * confirm gone. Customer "YEONG" (code 000001) confirmed a safe, reusable
 * sandbox customer for repeated RM100 test refunds (same one already used
 * in arInvoicePage.js/arPaymentPage.js). Reference No (kept to 20
 * characters or fewer) is this screen's one reliable way to find a
 * specific document again regardless of Draft/Posted status, since
 * Document No. stays "[DEFAULT]" until actually Posted. Leaves no
 * residual test data behind — every document created here is cancelled by
 * the end of its own test.
 */
test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Account Receivable > A/R Payment Refund', () => {

  test('[Save Draft] creates then cancels a draft A/R Payment Refund', async ({ page }) => {
    test.setTimeout(90000);
    const arPaymentRefundPage = new ArPaymentRefundPage(page);
    await arPaymentRefundPage.goto();

    await arPaymentRefundPage.createRefund({ customerCode: '000001', referenceNo: 'TESTING_ARR_DRAFT', amount: 100 });
    await arPaymentRefundPage.clickSaveDraft();
    await arPaymentRefundPage.clickBack();

    // No in-form success banner for Save Draft on this screen (same as
    // A/R Invoice) — the listing grid itself is the proof.
    await arPaymentRefundPage.cancelDocument('TESTING_ARR_DRAFT');
    expect(await arPaymentRefundPage.isCancelSuccessful()).toBe(true);
  });

  test('[Post] creates then cancels a posted A/R Payment Refund', async ({ page }) => {
    test.setTimeout(90000);
    const arPaymentRefundPage = new ArPaymentRefundPage(page);
    await arPaymentRefundPage.goto();

    await arPaymentRefundPage.createRefund({ customerCode: '000001', referenceNo: 'TESTING_ARR_POST', amount: 100 });
    await arPaymentRefundPage.clickPost();
    await arPaymentRefundPage.clickBack();

    await arPaymentRefundPage.cancelDocument('TESTING_ARR_POST');
    expect(await arPaymentRefundPage.isCancelSuccessful()).toBe(true);
  });

  test('[Post & New] posts a refund via Post & New, then cancels it', async ({ page }) => {
    test.setTimeout(90000);
    const arPaymentRefundPage = new ArPaymentRefundPage(page);
    await arPaymentRefundPage.goto();

    await arPaymentRefundPage.createRefund({ customerCode: '000001', referenceNo: 'TESTING_ARR_PNEW', amount: 100 });
    await arPaymentRefundPage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await arPaymentRefundPage.clickBack();

    await arPaymentRefundPage.cancelDocument('TESTING_ARR_PNEW');
    expect(await arPaymentRefundPage.isCancelSuccessful()).toBe(true);
  });
});
