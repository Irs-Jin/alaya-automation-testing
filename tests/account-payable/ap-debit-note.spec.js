const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ApDebitNotePage } = require('../../framework/pages/apDebitNotePage');

/**
 * Built from a live DOM inspection done before writing apDebitNotePage.js
 * (see its own class doc) — no Katalon Object Repository entry or codegen
 * recording exists for this screen. Vendor "HAZEL CORP" (code 000001) and
 * Account No. "GST-3010" (both already confirmed reusable across
 * ap-payment.spec.js/ap-invoice.spec.js) are reused here. Leaves no
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

test.describe('Account Payable > A/P Debit Note', () => {

  test('[Save Draft] creates then cancels a draft A/P Debit Note', async ({ page }) => {
    test.setTimeout(90000);
    const apDebitNotePage = new ApDebitNotePage(page);
    await apDebitNotePage.goto();

    await apDebitNotePage.createDebitNote({
      vendorCode: '000001',
      referenceNo: 'TESTING_APDN_DRAFT',
      accountCode: 'GST-3010',
      amount: 100,
    });
    await apDebitNotePage.clickSaveDraft();
    await apDebitNotePage.clickBack();

    await apDebitNotePage.cancelDocument('TESTING_APDN_DRAFT');
    expect(await apDebitNotePage.isCancelSuccessful('TESTING_APDN_DRAFT')).toBe(true);
  });

  test('[Post] creates then cancels a posted A/P Debit Note', async ({ page }) => {
    test.setTimeout(90000);
    const apDebitNotePage = new ApDebitNotePage(page);
    await apDebitNotePage.goto();

    await apDebitNotePage.createDebitNote({
      vendorCode: '000001',
      referenceNo: 'TESTING_APDN_POST',
      accountCode: 'GST-3010',
      amount: 100,
    });
    await apDebitNotePage.clickPost();
    await apDebitNotePage.clickBack();

    await apDebitNotePage.cancelDocument('TESTING_APDN_POST');
    expect(await apDebitNotePage.isCancelSuccessful('TESTING_APDN_POST')).toBe(true);
  });

  test('[Post & New] posts a debit note via Post & New, then cancels it', async ({ page }) => {
    test.setTimeout(90000);
    const apDebitNotePage = new ApDebitNotePage(page);
    await apDebitNotePage.goto();

    await apDebitNotePage.createDebitNote({
      vendorCode: '000001',
      referenceNo: 'TESTING_APDN_PNEW',
      accountCode: 'GST-3010',
      amount: 100,
    });
    await apDebitNotePage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await apDebitNotePage.clickBack();

    await apDebitNotePage.cancelDocument('TESTING_APDN_PNEW');
    expect(await apDebitNotePage.isCancelSuccessful('TESTING_APDN_PNEW')).toBe(true);
  });
});
