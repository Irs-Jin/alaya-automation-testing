const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ArCreditNotePage } = require('../../framework/pages/arCreditNotePage');

/**
 * Built from Jin's own Playwright codegen recording (2026-08-16) plus a
 * full live exploration/confirmation of Save Draft, Post, and Post & New
 * against SIT (uat/admin), each followed by Cancel + a fresh grid check to
 * confirm gone. Customer "YEONG" (code 000001) confirmed a safe, reusable
 * sandbox customer for repeated RM100 test credit notes (same one already
 * used across every A/R page object built this session). Reference No
 * (kept to 20 characters or fewer) is this screen's one reliable way to
 * find a specific document again regardless of Draft/Posted status, since
 * Document No. stays "[DEFAULT]" until actually Posted. Leaves no residual
 * test data behind — every document created here is cancelled by the end
 * of its own test.
 *
 * CONFIRMED LIVE: this screen has its own mandatory header "Reason:" text
 * field (separate from Reference No, and separate from the Cancel Reason
 * dropdown that appears later when cancelling a POSTED document — same
 * label, unrelated fields). CONFIRMED LIVE: Save Draft/Post/Post & New all
 * trigger a "Unapplied Amount Not Zero" confirmation (Yes) since these test
 * documents are never knocked off — see arCreditNotePage.js for detail.
 */
test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Account Receivable > A/R Credit Note', () => {

  test('[Save Draft] creates then cancels a draft A/R Credit Note', async ({ page }) => {
    test.setTimeout(90000);
    const arCreditNotePage = new ArCreditNotePage(page);
    await arCreditNotePage.goto();

    await arCreditNotePage.createCreditNote({ customerCode: '000001', referenceNo: 'TESTING_ARCN_DRAFT', accountCode: 'GST-3010', amount: 100 });
    await arCreditNotePage.clickSaveDraft();
    expect(await arCreditNotePage.getStatus()).toBe('DRAFT');
    await arCreditNotePage.clickBack();

    await arCreditNotePage.cancelDocument('TESTING_ARCN_DRAFT');
    expect(await arCreditNotePage.isCancelSuccessful('TESTING_ARCN_DRAFT')).toBe(true);
  });

  test('[Post] creates then cancels a posted A/R Credit Note', async ({ page }) => {
    test.setTimeout(90000);
    const arCreditNotePage = new ArCreditNotePage(page);
    await arCreditNotePage.goto();

    await arCreditNotePage.createCreditNote({ customerCode: '000001', referenceNo: 'TESTING_ARCN_POST', accountCode: 'GST-3010', amount: 100 });
    await arCreditNotePage.clickPost();
    await arCreditNotePage.clickBack();

    await arCreditNotePage.cancelDocument('TESTING_ARCN_POST');
    expect(await arCreditNotePage.isCancelSuccessful('TESTING_ARCN_POST')).toBe(true);
  });

  test('[Post & New] posts a credit note via Post & New, then cancels it', async ({ page }) => {
    test.setTimeout(90000);
    const arCreditNotePage = new ArCreditNotePage(page);
    await arCreditNotePage.goto();

    await arCreditNotePage.createCreditNote({ customerCode: '000001', referenceNo: 'TESTING_ARCN_PNEW', accountCode: 'GST-3010', amount: 100 });
    await arCreditNotePage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await arCreditNotePage.clickBack();

    await arCreditNotePage.cancelDocument('TESTING_ARCN_PNEW');
    expect(await arCreditNotePage.isCancelSuccessful('TESTING_ARCN_PNEW')).toBe(true);
  });
});
