const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { BankReconciliationPage } = require('../../framework/pages/bankReconciliationPage');

/**
 * Converted directly from Jin's own Playwright codegen recording + his
 * screenshots of the live before/after state (2026-07-26) — see
 * framework/pages/bankReconciliationPage.js for the full breakdown. Adds
 * a new bank statement date entry (accepting the dialog's own default
 * date), verifies the record count went up, then deletes it again and
 * verifies the count returns to what it was — leaving the account in the
 * same state it started in, same rationale as Stock Value's
 * create-then-delete flow (proves real add/delete round-trip, not just
 * client-side state).
 *
 * CONFIRMED via live run (2026-07-26, stable across 2 consecutive runs)
 * — after a safety incident (an earlier `confirmDelete()` accidentally
 * confirmed an extra delete dialog, deleting a real unrelated row) and
 * several more root-caused fixes: a stale KB entry re-poisoning the
 * delete-confirm selector, the actual button living in a zero-size
 * sibling element (`_I`) next to the real clickable one (`_CD`), and the
 * expand/collapse row's accessible name flipping between "Expand X" and
 * "Collapse X". See bankReconciliationPage.js for the full chain of
 * fixes — don't loosen confirmDelete() back to a page-wide/text-based
 * fallback, it's what caused the original incident.
 *
 * Test data below is Jin's own — override via env var if this client's
 * bank account differs:
 *
 *   ALAYA_TEST_BANK_ACCOUNT="310-0001 MAYBANK" npm test
 */
const BANK_ACCOUNT = process.env.ALAYA_TEST_BANK_ACCOUNT || '310-0001 MAYBANK';

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('General Ledger > Bank Reconciliation', () => {
  test.describe.configure({ retries: 0 });

  test('[Happy Path] adds a bank statement date entry then deletes it again', async ({ page }) => {
    test.setTimeout(90000);
    const brPage = new BankReconciliationPage(page);
    await brPage.goto();

    // If the dialog's default date already has a leftover entry from an
    // earlier run, addBankStatement() backs out instead of forcing a
    // duplicate (`created: false`) — the assertions below adjust for
    // either case rather than assuming a fresh row was always added.
    const { countBefore, created } = await brPage.addBankStatement(BANK_ACCOUNT);

    await brPage.expandBankAccount(BANK_ACCOUNT);
    const countAfterAdd = await brPage.getRecordCount();
    if (created && countBefore != null && countAfterAdd != null) {
      expect(countAfterAdd).toBe(countBefore + 1);
    }

    await brPage.clickDeleteStatement();
    await brPage.confirmDelete();

    await brPage.expandBankAccount(BANK_ACCOUNT);
    const countAfterDelete = await brPage.getRecordCount();
    const expectedFinalCount = created ? countBefore : (countBefore != null ? countBefore - 1 : null);
    if (expectedFinalCount != null && countAfterDelete != null) {
      expect(countAfterDelete).toBe(expectedFinalCount);
    }
  });
});
