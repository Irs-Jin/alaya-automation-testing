const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ApCreditNotePage } = require('../../framework/pages/apCreditNotePage');

/**
 * "No Cancel" variant of ap-credit-note.spec.js: same Save Draft/Post/
 * Post & New flows, but deliberately STOPS after each one — no Cancel
 * step.
 *
 * PERMANENT BY OMISSION — READ BEFORE RE-RUNNING: this screen's Cancel
 * action is assumed to still work fine (see ap-credit-note.spec.js) —
 * these tests simply don't exercise it. Each test leaves a real Draft/
 * Posted A/P Credit Note document behind under vendor "HAZEL CORP"
 * (000001), which CAN be cancelled manually later (or by
 * ap-credit-note.spec.js's own full cycle). Running this repeatedly
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

test.describe('Account Payable > A/P Credit Note', () => {

  test('[Save Draft, No Cancel] creates a draft A/P Credit Note', async ({ page }) => {
    test.setTimeout(90000);
    const apCreditNotePage = new ApCreditNotePage(page);
    await apCreditNotePage.goto();

    await apCreditNotePage.createCreditNote({
      vendorCode: '000001',
      referenceNo: 'TESTING_APCN_DFT_NC',
      accountCode: 'GST-3010',
      amount: 100,
    });
    await apCreditNotePage.clickSaveDraft();
    expect(await apCreditNotePage.getStatus()).toBe('DRAFT');
    await apCreditNotePage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });

  test('[Post, No Cancel] creates a posted A/P Credit Note', async ({ page }) => {
    test.setTimeout(90000);
    const apCreditNotePage = new ApCreditNotePage(page);
    await apCreditNotePage.goto();

    await apCreditNotePage.createCreditNote({
      vendorCode: '000001',
      referenceNo: 'TESTING_APCN_PST_NC',
      accountCode: 'GST-3010',
      amount: 100,
    });
    await apCreditNotePage.clickPost();
    await apCreditNotePage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });

  test('[Post & New, No Cancel] posts a credit note via Post & New', async ({ page }) => {
    test.setTimeout(90000);
    const apCreditNotePage = new ApCreditNotePage(page);
    await apCreditNotePage.goto();

    await apCreditNotePage.createCreditNote({
      vendorCode: '000001',
      referenceNo: 'TESTING_APCN_PNW_NC',
      accountCode: 'GST-3010',
      amount: 100,
    });
    await apCreditNotePage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await apCreditNotePage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });
});
