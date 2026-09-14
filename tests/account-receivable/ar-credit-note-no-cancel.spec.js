const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ArCreditNotePage } = require('../../framework/pages/arCreditNotePage');

/**
 * "No Cancel" variant of ar-credit-note.spec.js: same Save Draft/Post/
 * Post & New flows (including the "Unapplied Amount Not Zero"
 * confirmation each one triggers — see arCreditNotePage.js), but
 * deliberately STOPS after each one — no Cancel step.
 *
 * PERMANENT BY OMISSION — READ BEFORE RE-RUNNING: this screen's Cancel
 * action still works fine (see ar-credit-note.spec.js) — these tests
 * simply don't exercise it. Each test leaves a real Draft/Posted A/R
 * Credit Note document behind under customer "YEONG" (000001), which CAN
 * be cancelled manually later (or by ar-credit-note.spec.js's own full
 * cycle). Running this repeatedly without manual cleanup keeps stacking
 * real leftover documents in whichever environment it targets.
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

  test('[Save Draft, No Cancel] creates a draft A/R Credit Note', async ({ page }) => {
    test.setTimeout(90000);
    const arCreditNotePage = new ArCreditNotePage(page);
    await arCreditNotePage.goto();

    await arCreditNotePage.createCreditNote({ customerCode: '000001', referenceNo: 'TESTING_ARCN_DFT_NC', accountCode: 'GST-3010', amount: 100 });
    await arCreditNotePage.clickSaveDraft();
    expect(await arCreditNotePage.getStatus()).toBe('DRAFT');
    await arCreditNotePage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });

  test('[Post, No Cancel] creates a posted A/R Credit Note', async ({ page }) => {
    test.setTimeout(90000);
    const arCreditNotePage = new ArCreditNotePage(page);
    await arCreditNotePage.goto();

    await arCreditNotePage.createCreditNote({ customerCode: '000001', referenceNo: 'TESTING_ARCN_PST_NC', accountCode: 'GST-3010', amount: 100 });
    await arCreditNotePage.clickPost();
    await arCreditNotePage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });

  test('[Post & New, No Cancel] posts a credit note via Post & New', async ({ page }) => {
    test.setTimeout(90000);
    const arCreditNotePage = new ArCreditNotePage(page);
    await arCreditNotePage.goto();

    await arCreditNotePage.createCreditNote({ customerCode: '000001', referenceNo: 'TESTING_ARCN_PNW_NC', accountCode: 'GST-3010', amount: 100 });
    await arCreditNotePage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await arCreditNotePage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });
});
