const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ApPaymentRefundPage } = require('../../framework/pages/apPaymentRefundPage');

/**
 * "No Cancel" variant of ap-payment-refund.spec.js: same Save Draft/Post/
 * Post & New flows, but deliberately STOPS after each one — no Cancel
 * step.
 *
 * PERMANENT BY OMISSION — READ BEFORE RE-RUNNING: this screen's Cancel
 * action is assumed to still work fine (see ap-payment-refund.spec.js) —
 * these tests simply don't exercise it. Each test leaves a real Draft/
 * Posted A/P Payment Refund document behind under vendor "HAZEL CORP"
 * (000001), which CAN be cancelled manually later (or by
 * ap-payment-refund.spec.js's own full cycle). Running this repeatedly
 * without manual cleanup keeps stacking real leftover documents in
 * whichever environment it targets.
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

  test('[Save Draft, No Cancel] creates a draft A/P Payment Refund', async ({ page }) => {
    test.setTimeout(90000);
    const apPaymentRefundPage = new ApPaymentRefundPage(page);
    await apPaymentRefundPage.goto();

    await apPaymentRefundPage.createRefund({ vendorCode: '000001', referenceNo: 'TESTING_APR_DFT_NC', amount: 100 });
    await apPaymentRefundPage.clickSaveDraft();
    await apPaymentRefundPage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });

  test('[Post, No Cancel] creates a posted A/P Payment Refund', async ({ page }) => {
    test.setTimeout(90000);
    const apPaymentRefundPage = new ApPaymentRefundPage(page);
    await apPaymentRefundPage.goto();

    await apPaymentRefundPage.createRefund({ vendorCode: '000001', referenceNo: 'TESTING_APR_PST_NC', amount: 100 });
    await apPaymentRefundPage.clickPost();
    await apPaymentRefundPage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });

  test('[Post & New, No Cancel] posts a refund via Post & New', async ({ page }) => {
    test.setTimeout(90000);
    const apPaymentRefundPage = new ApPaymentRefundPage(page);
    await apPaymentRefundPage.goto();

    await apPaymentRefundPage.createRefund({ vendorCode: '000001', referenceNo: 'TESTING_APR_PNW_NC', amount: 100 });
    await apPaymentRefundPage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await apPaymentRefundPage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });
});
