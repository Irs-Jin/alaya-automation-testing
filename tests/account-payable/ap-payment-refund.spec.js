const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ApPaymentRefundPage } = require('../../framework/pages/apPaymentRefundPage');

/**
 * Built by close analogy to tests/account-receivable/ar-payment-refund.spec.js
 * and tests/account-payable/ap-payment.spec.js — no Katalon Object
 * Repository entry or codegen recording exists for this screen; see
 * apPaymentRefundPage.js's own class doc for the full detail on what's
 * UNCONFIRMED and why. Vendor "HAZEL CORP" (code 000001, already
 * confirmed a safe reusable sandbox vendor via ap-payment.spec.js/
 * ap-invoice.spec.js) is reused here. Leaves no residual test data
 * behind — every document created here is cancelled by the end of its
 * own test.
 */
test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Account Payable > A/P Payment Refund', () => {

  test('[Save Draft] creates then cancels a draft A/P Payment Refund', async ({ page }) => {
    test.setTimeout(90000);
    const apPaymentRefundPage = new ApPaymentRefundPage(page);
    await apPaymentRefundPage.goto();

    await apPaymentRefundPage.createRefund({ vendorCode: '000001', referenceNo: 'TESTING_APR_DRAFT', amount: 100 });
    await apPaymentRefundPage.clickSaveDraft();
    await apPaymentRefundPage.clickBack();

    await apPaymentRefundPage.cancelDocument('TESTING_APR_DRAFT');
    expect(await apPaymentRefundPage.isCancelSuccessful()).toBe(true);
  });

  test('[Post] creates then cancels a posted A/P Payment Refund', async ({ page }) => {
    test.setTimeout(90000);
    const apPaymentRefundPage = new ApPaymentRefundPage(page);
    await apPaymentRefundPage.goto();

    await apPaymentRefundPage.createRefund({ vendorCode: '000001', referenceNo: 'TESTING_APR_POST', amount: 100 });
    await apPaymentRefundPage.clickPost();
    await apPaymentRefundPage.clickBack();

    await apPaymentRefundPage.cancelDocument('TESTING_APR_POST');
    expect(await apPaymentRefundPage.isCancelSuccessful()).toBe(true);
  });

  test('[Post & New] posts a refund via Post & New, then cancels it', async ({ page }) => {
    test.setTimeout(90000);
    const apPaymentRefundPage = new ApPaymentRefundPage(page);
    await apPaymentRefundPage.goto();

    await apPaymentRefundPage.createRefund({ vendorCode: '000001', referenceNo: 'TESTING_APR_PNEW', amount: 100 });
    await apPaymentRefundPage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await apPaymentRefundPage.clickBack();

    await apPaymentRefundPage.cancelDocument('TESTING_APR_PNEW');
    expect(await apPaymentRefundPage.isCancelSuccessful()).toBe(true);
  });
});
