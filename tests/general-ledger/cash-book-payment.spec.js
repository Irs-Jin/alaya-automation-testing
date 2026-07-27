const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { CashBookPaymentPage } = require('../../framework/pages/cashBookPaymentPage');

/**
 * Converted from Katalon's CBPD/CBPN/CBPP/CBPPN test cases
 * (Test Cases/Regression Test/General Ledger/Cash Book Payment), then
 * corrected against Jin's own codegen recordings (2026-07-26) — see
 * framework/pages/cashBookPaymentPage.js for the confirmed-vs-carried-over
 * breakdown and the two bugs found/fixed.
 *
 * Test data below is Katalon's own — override via env vars if this
 * client's chart of accounts / vendor names differ:
 *
 *   ALAYA_TEST_PAY_TO=<name> ALAYA_TEST_PAYMENT_AMOUNT=<amount>
 *   ALAYA_TEST_GL_ACCOUNT_CODE=<code> npm test
 */
const PAY_TO = process.env.ALAYA_TEST_PAY_TO || 'Adidas Neo Sdn Bhd';
const PAYMENT_AMOUNT = process.env.ALAYA_TEST_PAYMENT_AMOUNT || '100';
const GL_ACCOUNT_CODE = process.env.ALAYA_TEST_GL_ACCOUNT_CODE || '410-0000';

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('General Ledger > Cash Book Payment', () => {
  test.describe.configure({ retries: 0 });

  test('[Happy Path] fills a cash book payment and clicks New', async ({ page }) => {
    test.setTimeout(90000);
    const cbpPage = new CashBookPaymentPage(page);
    await cbpPage.goto();

    await cbpPage.fillPayTo(PAY_TO);
    await cbpPage.addPaymentLine({ mode: 'CASH', amount: PAYMENT_AMOUNT });

    await cbpPage.clickNew();
    await cbpPage.clickBack();
  });

  test('[Save Draft] fills a cash book payment and saves it as draft', async ({ page }) => {
    test.setTimeout(90000);
    const cbpPage = new CashBookPaymentPage(page);
    await cbpPage.goto();

    await cbpPage.fillPayTo(PAY_TO);
    await cbpPage.addPaymentLine({ mode: 'CASH', amount: PAYMENT_AMOUNT });

    await cbpPage.clickSaveDraft();
    await cbpPage.clickBack();
  });

  test('[Post] posts a cash book payment and reaches the Payment Voucher report', async ({ page }) => {
    test.setTimeout(90000);
    const cbpPage = new CashBookPaymentPage(page);
    await cbpPage.goto();

    await cbpPage.fillPayTo(PAY_TO);
    await cbpPage.addPaymentLine({ mode: 'CASH', amount: PAYMENT_AMOUNT });
    await cbpPage.addGlAllocationLine({
      accountCode: GL_ACCOUNT_CODE,
      amount: PAYMENT_AMOUNT,
    });

    await cbpPage.clickPost();

    const reportPage = await cbpPage.printReport();
    expect(cbpPage.isReportPageValid(reportPage)).toBe(true);
    await reportPage.screenshot({ path: 'test-results/cash-book-payment-post-report.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });

  test('[Post & New] posts a cash book payment then resets for the next entry', async ({ page }) => {
    test.setTimeout(90000);
    const cbpPage = new CashBookPaymentPage(page);
    await cbpPage.goto();

    await cbpPage.fillPayTo(PAY_TO);
    await cbpPage.addPaymentLine({ mode: 'CASH', amount: PAYMENT_AMOUNT });
    await cbpPage.addGlAllocationLine({
      accountCode: GL_ACCOUNT_CODE,
      amount: PAYMENT_AMOUNT,
    });

    await cbpPage.clickPostAndNew();
    await cbpPage.clickBack();
  });
});
