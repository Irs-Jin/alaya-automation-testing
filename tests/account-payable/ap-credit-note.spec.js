const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ApCreditNotePage } = require('../../framework/pages/apCreditNotePage');

/**
 * Built from a live DOM inspection done before writing apCreditNotePage.js
 * (see its own class doc) — no Katalon Object Repository entry or codegen
 * recording exists for this screen. Vendor "HAZEL CORP" (code 000001) and
 * Account No. "GST-3010" (both already confirmed reusable across
 * ap-payment.spec.js/ap-invoice.spec.js/ap-debit-note.spec.js) are reused
 * here. Leaves no residual test data behind — every document created here
 * is cancelled by the end of its own test.
 */
test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Account Payable > A/P Credit Note', () => {

  test('[Save Draft] creates then cancels a draft A/P Credit Note', async ({ page }) => {
    test.setTimeout(90000);
    const apCreditNotePage = new ApCreditNotePage(page);
    await apCreditNotePage.goto();

    await apCreditNotePage.createCreditNote({
      vendorCode: '000001',
      referenceNo: 'TESTING_APCN_DRAFT',
      accountCode: 'GST-3010',
      amount: 100,
    });
    await apCreditNotePage.clickSaveDraft();
    expect(await apCreditNotePage.getStatus()).toBe('DRAFT');
    await apCreditNotePage.clickBack();

    await apCreditNotePage.cancelDocument('TESTING_APCN_DRAFT');
    expect(await apCreditNotePage.isCancelSuccessful('TESTING_APCN_DRAFT')).toBe(true);
  });

  test('[Post] creates then cancels a posted A/P Credit Note', async ({ page }) => {
    test.setTimeout(90000);
    const apCreditNotePage = new ApCreditNotePage(page);
    await apCreditNotePage.goto();

    await apCreditNotePage.createCreditNote({
      vendorCode: '000001',
      referenceNo: 'TESTING_APCN_POST',
      accountCode: 'GST-3010',
      amount: 100,
    });
    await apCreditNotePage.clickPost();
    await apCreditNotePage.clickBack();

    await apCreditNotePage.cancelDocument('TESTING_APCN_POST');
    expect(await apCreditNotePage.isCancelSuccessful('TESTING_APCN_POST')).toBe(true);
  });

  test('[Post & New] posts a credit note via Post & New, then cancels it', async ({ page }) => {
    test.setTimeout(90000);
    const apCreditNotePage = new ApCreditNotePage(page);
    await apCreditNotePage.goto();

    await apCreditNotePage.createCreditNote({
      vendorCode: '000001',
      referenceNo: 'TESTING_APCN_PNEW',
      accountCode: 'GST-3010',
      amount: 100,
    });
    await apCreditNotePage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await apCreditNotePage.clickBack();

    await apCreditNotePage.cancelDocument('TESTING_APCN_PNEW');
    expect(await apCreditNotePage.isCancelSuccessful('TESTING_APCN_PNEW')).toBe(true);
  });
});
