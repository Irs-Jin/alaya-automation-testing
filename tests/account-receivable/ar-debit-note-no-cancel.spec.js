const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ArDebitNotePage } = require('../../framework/pages/arDebitNotePage');

/**
 * "No Cancel" variant of ar-debit-note.spec.js: same Save Draft/Post/
 * Post & New flows, but deliberately STOPS after each one — no Cancel
 * step.
 *
 * PERMANENT BY OMISSION — READ BEFORE RE-RUNNING: this screen's Cancel
 * action still works fine (see ar-debit-note.spec.js) — these tests
 * simply don't exercise it. Each test leaves a real Draft/Posted A/R
 * Debit Note document behind under customer "YEONG" (000001), which CAN
 * be cancelled manually later (or by ar-debit-note.spec.js's own full
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

test.describe('Account Receivable > A/R Debit Note', () => {

  test('[Save Draft, No Cancel] creates a draft A/R Debit Note', async ({ page }) => {
    test.setTimeout(90000);
    const arDebitNotePage = new ArDebitNotePage(page);
    await arDebitNotePage.goto();

    await arDebitNotePage.createDebitNote({ customerCode: '000001', referenceNo: 'TESTING_ARDN_DFT_NC', accountCode: 'GST-3010', amount: 100 });
    await arDebitNotePage.clickSaveDraft();
    expect(await arDebitNotePage.getStatus()).toBe('DRAFT');
    await arDebitNotePage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });

  test('[Post, No Cancel] creates a posted A/R Debit Note', async ({ page }) => {
    test.setTimeout(90000);
    const arDebitNotePage = new ArDebitNotePage(page);
    await arDebitNotePage.goto();

    await arDebitNotePage.createDebitNote({ customerCode: '000001', referenceNo: 'TESTING_ARDN_PST_NC', accountCode: 'GST-3010', amount: 100 });
    await arDebitNotePage.clickPost();
    await arDebitNotePage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });

  test('[Post & New, No Cancel] posts a debit note via Post & New', async ({ page }) => {
    test.setTimeout(90000);
    const arDebitNotePage = new ArDebitNotePage(page);
    await arDebitNotePage.goto();

    await arDebitNotePage.createDebitNote({ customerCode: '000001', referenceNo: 'TESTING_ARDN_PNW_NC', accountCode: 'GST-3010', amount: 100 });
    await arDebitNotePage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await arDebitNotePage.clickBack();

    // No cleanup: see class doc — Cancel is left unexercised on purpose.
  });
});
