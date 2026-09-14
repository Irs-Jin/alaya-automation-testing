const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ArPaymentRefundPage } = require('../../framework/pages/arPaymentRefundPage');

/**
 * "No Cancel" variant of ar-payment-refund.spec.js: same Save Draft/Post/
 * Post & New flows, but deliberately STOPS after each one — no Cancel
 * step.
 *
 * PERMANENT BY OMISSION — READ BEFORE RE-RUNNING: this screen's Cancel
 * action still works fine (see ar-payment-refund.spec.js) — these tests
 * simply don't exercise it. Each test leaves a real Draft/Posted A/R
 * Payment Refund document behind under customer "YEONG" (000001), which
 * CAN be cancelled manually later (or by ar-payment-refund.spec.js's own
 * full cycle). Running this repeatedly without manual cleanup keeps
 * stacking real leftover documents in whichever environment it targets.
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

  test('[Save Draft, No Cancel] creates a draft A/R Payment Refund', async ({ page }) => {
    test.setTimeout(90000);
    const arPaymentRefundPage = new ArPaymentRefundPage(page);
    await arPaymentRefundPage.goto();

    await arPaymentRefundPage.createRefund({ customerCode: '000001', referenceNo: 'TESTING_ARR_DFT_NC', amount: 100 });
    await arPaymentRefundPage.clickSaveDraft();
    await arPaymentRefundPage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });

  test('[Post, No Cancel] creates a posted A/R Payment Refund', async ({ page }) => {
    test.setTimeout(90000);
    const arPaymentRefundPage = new ArPaymentRefundPage(page);
    await arPaymentRefundPage.goto();

    await arPaymentRefundPage.createRefund({ customerCode: '000001', referenceNo: 'TESTING_ARR_PST_NC', amount: 100 });
    await arPaymentRefundPage.clickPost();
    await arPaymentRefundPage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });

  test('[Post & New, No Cancel] posts a refund via Post & New', async ({ page }) => {
    test.setTimeout(90000);
    const arPaymentRefundPage = new ArPaymentRefundPage(page);
    await arPaymentRefundPage.goto();

    await arPaymentRefundPage.createRefund({ customerCode: '000001', referenceNo: 'TESTING_ARR_PNW_NC', amount: 100 });
    await arPaymentRefundPage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await arPaymentRefundPage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });
});
