const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ApPaymentPage } = require('../../framework/pages/apPaymentPage');

/**
 * Built from Jin's own Playwright codegen recording (2026-08-15) plus a
 * full live exploration/confirmation of Save Draft, Post, and Post & New
 * against SIT (uat/admin), each followed by Cancel + a fresh grid check to
 * confirm gone. Vendor "HAZEL CORP" (code 000001) confirmed a safe,
 * reusable sandbox vendor for repeated RM100 test payments. Reference No
 * (kept to 20 characters or fewer — see apPaymentPage.js's
 * fillReferenceNo() comment) is this screen's one reliable way to find a
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

test.describe('Account Payable > A/P Payment', () => {

  test('[Save Draft] creates then cancels a draft A/P Payment', async ({ page }) => {
    test.setTimeout(90000);
    const apPaymentPage = new ApPaymentPage(page);
    await apPaymentPage.goto();

    await apPaymentPage.createPayment({ vendorCode: '000001', referenceNo: 'TESTING_AP_DRAFT', amount: 100 });
    await apPaymentPage.clickSaveDraft();
    expect(await apPaymentPage.isSaveSuccessful()).toBe(true);
    expect(await apPaymentPage.getStatus()).toBe('DRAFT');
    await apPaymentPage.clickBack();

    await apPaymentPage.cancelDocument('TESTING_AP_DRAFT');
    expect(await apPaymentPage.isCancelSuccessful()).toBe(true);
  });

  test('[Post] creates then cancels a posted A/P Payment', async ({ page }) => {
    test.setTimeout(90000);
    const apPaymentPage = new ApPaymentPage(page);
    await apPaymentPage.goto();

    await apPaymentPage.createPayment({ vendorCode: '000001', referenceNo: 'TESTING_AP_POST', amount: 100 });
    await apPaymentPage.clickPost();
    await apPaymentPage.clickBack();

    await apPaymentPage.cancelDocument('TESTING_AP_POST');
    expect(await apPaymentPage.isCancelSuccessful()).toBe(true);
  });

  test('[Post & New] posts a payment via Post & New, then cancels it', async ({ page }) => {
    test.setTimeout(90000);
    const apPaymentPage = new ApPaymentPage(page);
    await apPaymentPage.goto();

    await apPaymentPage.createPayment({ vendorCode: '000001', referenceNo: 'TESTING_AP_PNEW', amount: 100 });
    await apPaymentPage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await apPaymentPage.clickBack();

    await apPaymentPage.cancelDocument('TESTING_AP_PNEW');
    expect(await apPaymentPage.isCancelSuccessful()).toBe(true);
  });
});
