const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { CashBookReceiptPage } = require('../../framework/pages/cashBookReceiptPage');

/**
 * Converted from Katalon's CBRD/CBRN/CBRP/CBRPN test cases
 * (Test Cases/Regression Test/General Ledger/Cash Book Receipt). See
 * framework/pages/cashBookReceiptPage.js — the Payment Mode picker and GL
 * allocation account picker were fixed to match Cash Book Payment's
 * codegen-confirmed shape (inferred for Receipt, not independently
 * re-recorded — flag it if this one still fails differently).
 *
 * Test data below is Katalon's own — override via env vars if this
 * client's chart of accounts / customer names differ:
 *
 *   ALAYA_TEST_RECEIVED_FROM=<name> ALAYA_TEST_PAYMENT_AMOUNT=<amount>
 *   ALAYA_TEST_GL_ACCOUNT_CODE=<code> npm test
 */
const RECEIVED_FROM = process.env.ALAYA_TEST_RECEIVED_FROM || 'Adidas';
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

test.describe('General Ledger > Cash Book Receipt', () => {
  test.describe.configure({ retries: 0 });

  test('[Happy Path] fills a cash book receipt and clicks New', async ({ page }) => {
    test.setTimeout(90000);
    const cbrPage = new CashBookReceiptPage(page);
    await cbrPage.goto();

    await cbrPage.fillReceivedFrom(RECEIVED_FROM);
    await cbrPage.addPaymentLine({ mode: 'CASH', amount: PAYMENT_AMOUNT });

    await cbrPage.clickNew();
    await cbrPage.clickBack();
  });

  test('[Save Draft] fills a cash book receipt and saves it as draft', async ({ page }) => {
    test.setTimeout(90000);
    const cbrPage = new CashBookReceiptPage(page);
    await cbrPage.goto();

    await cbrPage.fillReceivedFrom(RECEIVED_FROM);
    await cbrPage.addPaymentLine({ mode: 'CASH', amount: PAYMENT_AMOUNT });

    await cbrPage.clickSaveDraft();
    await cbrPage.clickBack();
  });

  test('[Post] posts a cash book receipt and reaches the report', async ({ page }) => {
    test.setTimeout(90000);
    const cbrPage = new CashBookReceiptPage(page);
    await cbrPage.goto();

    await cbrPage.fillReceivedFrom(RECEIVED_FROM);
    await cbrPage.addPaymentLine({ mode: 'CASH', amount: PAYMENT_AMOUNT });
    await cbrPage.addGlAllocationLine({
      accountCode: GL_ACCOUNT_CODE,
      amount: PAYMENT_AMOUNT,
    });

    await cbrPage.clickPost();

    const reportPage = await cbrPage.printReport();
    expect(cbrPage.isReportPageValid(reportPage)).toBe(true);
    await reportPage.screenshot({ path: 'test-results/cash-book-receipt-post-report.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });

  test('[Post & New] posts a cash book receipt then resets for the next entry', async ({ page }) => {
    test.setTimeout(90000);
    const cbrPage = new CashBookReceiptPage(page);
    await cbrPage.goto();

    await cbrPage.fillReceivedFrom(RECEIVED_FROM);
    await cbrPage.addPaymentLine({ mode: 'CASH', amount: PAYMENT_AMOUNT });
    await cbrPage.addGlAllocationLine({
      accountCode: GL_ACCOUNT_CODE,
      amount: PAYMENT_AMOUNT,
    });

    await cbrPage.clickPostAndNew();
    await cbrPage.clickBack();
  });
});
