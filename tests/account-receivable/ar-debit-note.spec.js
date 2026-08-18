const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ArDebitNotePage } = require('../../framework/pages/arDebitNotePage');

/**
 * Built from Jin's own Playwright codegen recording (2026-08-16) plus a
 * full live exploration/confirmation of Save Draft, Post, and Post & New
 * against SIT (uat/admin), each followed by Cancel + a fresh grid check to
 * confirm gone. Customer "YEONG" (code 000001) confirmed a safe, reusable
 * sandbox customer for repeated RM100 test debit notes (same one already
 * used in arInvoicePage.js/arPaymentPage.js/arPaymentRefundPage.js).
 * Reference No (kept to 20 characters or fewer) is this screen's one
 * reliable way to find a specific document again regardless of Draft/
 * Posted status, since Document No. stays "[DEFAULT]" until actually
 * Posted. Leaves no residual test data behind — every document created
 * here is cancelled by the end of its own test.
 *
 * CONFIRMED LIVE: cancelling a POSTED document (the [Post] and
 * [Post & New] tests below) additionally requires picking a value from a
 * mandatory "Cancel Reason" dialog — see arDebitNotePage.js's
 * cancelDocument()/_selectCancelReasonIfPresent() for why this only
 * applies to POSTED, not DRAFT, documents.
 */
test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Account Receivable > A/R Debit Note', () => {

  test('[Save Draft] creates then cancels a draft A/R Debit Note', async ({ page }) => {
    test.setTimeout(90000);
    const arDebitNotePage = new ArDebitNotePage(page);
    await arDebitNotePage.goto();

    await arDebitNotePage.createDebitNote({ customerCode: '000001', referenceNo: 'TESTING_ARDN_DRAFT', accountCode: 'GST-3010', amount: 100 });
    await arDebitNotePage.clickSaveDraft();
    expect(await arDebitNotePage.getStatus()).toBe('DRAFT');
    await arDebitNotePage.clickBack();

    await arDebitNotePage.cancelDocument('TESTING_ARDN_DRAFT');
    expect(await arDebitNotePage.isCancelSuccessful('TESTING_ARDN_DRAFT')).toBe(true);
  });

  test('[Post] creates then cancels a posted A/R Debit Note', async ({ page }) => {
    test.setTimeout(90000);
    const arDebitNotePage = new ArDebitNotePage(page);
    await arDebitNotePage.goto();

    await arDebitNotePage.createDebitNote({ customerCode: '000001', referenceNo: 'TESTING_ARDN_POST', accountCode: 'GST-3010', amount: 100 });
    await arDebitNotePage.clickPost();
    await arDebitNotePage.clickBack();

    await arDebitNotePage.cancelDocument('TESTING_ARDN_POST');
    expect(await arDebitNotePage.isCancelSuccessful('TESTING_ARDN_POST')).toBe(true);
  });

  test('[Post & New] posts a debit note via Post & New, then cancels it', async ({ page }) => {
    test.setTimeout(90000);
    const arDebitNotePage = new ArDebitNotePage(page);
    await arDebitNotePage.goto();

    await arDebitNotePage.createDebitNote({ customerCode: '000001', referenceNo: 'TESTING_ARDN_PNEW', accountCode: 'GST-3010', amount: 100 });
    await arDebitNotePage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await arDebitNotePage.clickBack();

    await arDebitNotePage.cancelDocument('TESTING_ARDN_PNEW');
    expect(await arDebitNotePage.isCancelSuccessful('TESTING_ARDN_PNEW')).toBe(true);
  });
});
