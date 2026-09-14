const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ArPaymentPage } = require('../../framework/pages/arPaymentPage');

/**
 * "No Cancel" variant of ar-payment.spec.js: same Save Draft/Post/
 * Post & New flows, but deliberately STOPS after each one — no Cancel
 * step.
 *
 * PERMANENT BY OMISSION — READ BEFORE RE-RUNNING: this screen's Cancel
 * action still works fine (see ar-payment.spec.js) — these tests simply
 * don't exercise it. Each test leaves a real Draft/Posted A/R Payment
 * document behind under customer "YEONG" (000001), which CAN be cancelled
 * manually later (or by ar-payment.spec.js's own full cycle). Running
 * this repeatedly without manual cleanup keeps stacking real leftover
 * documents in whichever environment it targets.
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

  test('[Save Draft, No Cancel] creates a draft A/R Payment', async ({ page }) => {
    test.setTimeout(90000);
    const arPaymentPage = new ArPaymentPage(page);
    await arPaymentPage.goto();

    await arPaymentPage.createPayment({ customerCode: '000001', referenceNo: 'TESTING_ARP_DFT_NC', amount: 100 });
    await arPaymentPage.clickSaveDraft();
    expect(await arPaymentPage.isSaveSuccessful()).toBe(true);
    expect(await arPaymentPage.getStatus()).toBe('DRAFT');
    await arPaymentPage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });

  test('[Post, No Cancel] creates a posted A/R Payment', async ({ page }) => {
    test.setTimeout(90000);
    const arPaymentPage = new ArPaymentPage(page);
    await arPaymentPage.goto();

    await arPaymentPage.createPayment({ customerCode: '000001', referenceNo: 'TESTING_ARP_PST_NC', amount: 100 });
    await arPaymentPage.clickPost();
    await arPaymentPage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });

  test('[Post & New, No Cancel] posts a payment via Post & New', async ({ page }) => {
    test.setTimeout(90000);
    const arPaymentPage = new ArPaymentPage(page);
    await arPaymentPage.goto();

    await arPaymentPage.createPayment({ customerCode: '000001', referenceNo: 'TESTING_ARP_PNW_NC', amount: 100 });
    await arPaymentPage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await arPaymentPage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });
});
