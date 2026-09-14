const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ApPaymentPage } = require('../../framework/pages/apPaymentPage');

/**
 * "No Cancel" variant of ap-payment.spec.js: same Save Draft/Post/
 * Post & New flows, but deliberately STOPS after each one — no Cancel
 * step.
 *
 * PERMANENT BY OMISSION — READ BEFORE RE-RUNNING: this screen's Cancel
 * action still works fine (see ap-payment.spec.js) — these tests simply
 * don't exercise it. Each test leaves a real Draft/Posted A/P Payment
 * document behind under vendor "HAZEL CORP" (000001), which CAN be
 * cancelled manually later (or by ap-payment.spec.js's own full cycle).
 * Running this repeatedly without manual cleanup keeps stacking real
 * leftover documents in whichever environment it targets.
 */
test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Account Payable > A/P Payment', () => {

  test('[Save Draft, No Cancel] creates a draft A/P Payment', async ({ page }) => {
    test.setTimeout(90000);
    const apPaymentPage = new ApPaymentPage(page);
    await apPaymentPage.goto();

    await apPaymentPage.createPayment({ vendorCode: '000001', referenceNo: 'TESTING_AP_DRAFT_NC', amount: 100 });
    await apPaymentPage.clickSaveDraft();
    expect(await apPaymentPage.isSaveSuccessful()).toBe(true);
    expect(await apPaymentPage.getStatus()).toBe('DRAFT');
    await apPaymentPage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });

  test('[Post, No Cancel] creates a posted A/P Payment', async ({ page }) => {
    test.setTimeout(90000);
    const apPaymentPage = new ApPaymentPage(page);
    await apPaymentPage.goto();

    await apPaymentPage.createPayment({ vendorCode: '000001', referenceNo: 'TESTING_AP_POST_NC', amount: 100 });
    await apPaymentPage.clickPost();
    await apPaymentPage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });

  test('[Post & New, No Cancel] posts a payment via Post & New', async ({ page }) => {
    test.setTimeout(90000);
    const apPaymentPage = new ApPaymentPage(page);
    await apPaymentPage.goto();

    await apPaymentPage.createPayment({ vendorCode: '000001', referenceNo: 'TESTING_AP_PNEW_NC', amount: 100 });
    await apPaymentPage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await apPaymentPage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });
});
