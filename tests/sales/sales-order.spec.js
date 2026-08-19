const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { SalesOrderPage } = require('../../framework/pages/salesOrderPage');

/**
 * No recording available — built by live-probing the real app directly
 * (2026-08-19) using the playwright-cli interactive tool (see
 * SalesOrderPage's own class comment for the full shape/gotchas
 * discovered). Same direct-entry shape as Quotation (Customer -> Sales
 * Branch -> Item -> Save Draft/Post/Post & New) — this screen also offers
 * a "Copy From" transfer from a Quotation, not exercised here.
 *
 * UPDATED (2026-08-19): the shared `uat` login's default company changed
 * server-side from qa3/SHANTHI QA BIZ 69 to UAT/TANJAK MEGA GROUP SDN BHD
 * (confirmed live via the footer's "Client ID:" label after a machine
 * restart) — the old SHANTHI-specific test data no longer exists in this
 * company. Re-probed live and confirmed real: Customer "000001", Sales
 * Branch "T01" (AMIRUL HALAL MART (TAMBUN)), item "BISKUT PLANTA" (plenty
 * of stock) — same values now used across every Sales-module spec.
 * Different clients/companies will have different master data — override
 * via env vars rather than editing this file when pointing at another one.
 */
const CUSTOMER_CODE = process.env.ALAYA_TEST_CUSTOMER_CODE || '000001';
const SALES_BRANCH_CODE = process.env.ALAYA_TEST_SALES_BRANCH_CODE || 'T01';
const ITEM_DESCRIPTION = process.env.ALAYA_TEST_ITEM_DESCRIPTION || 'BISKUT PLANTA';

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Sales > Sales Order', () => {

  const testData = {
    customerCode: CUSTOMER_CODE,
    salesBranchCode: SALES_BRANCH_CODE,
    itemDescription: ITEM_DESCRIPTION,
  };

  test('[Save Draft] saves a Sales Order with one item', async ({ page }) => {
    test.setTimeout(90000);
    const salesOrderPage = new SalesOrderPage(page);
    await salesOrderPage.goto();

    await salesOrderPage.clickNew();
    await salesOrderPage.prepareSalesOrder(testData);
    await salesOrderPage.clickSaveDraft();

    expect(await salesOrderPage.expectSaveDraftSuccess()).toBe(true);
  });

  test('[Post] posts a Sales Order with one item', async ({ page }) => {
    test.setTimeout(90000);
    const salesOrderPage = new SalesOrderPage(page);
    await salesOrderPage.goto();

    await salesOrderPage.clickNew();
    await salesOrderPage.prepareSalesOrder(testData);
    await salesOrderPage.clickPost();
    await salesOrderPage.dismissEInvoiceValidationPromptIfPresent();

    expect(await salesOrderPage.expectPostSuccess()).toBe(true);
  });

  test('[Post & New] posts a Sales Order and resets the form for the next entry', async ({ page }) => {
    test.setTimeout(90000);
    const salesOrderPage = new SalesOrderPage(page);
    await salesOrderPage.goto();

    await salesOrderPage.clickNew();
    const beforeNo = await salesOrderPage.getNextPossibleNo();
    await salesOrderPage.prepareSalesOrder(testData);
    await salesOrderPage.clickPostAndNew();
    await salesOrderPage.dismissEInvoiceValidationPromptIfPresent();

    expect(await salesOrderPage.expectFormReset()).toBe(true);
    const afterNo = await salesOrderPage.getNextPossibleNo();
    expect(afterNo).not.toBe(beforeNo);
  });

  test('[Cancel] creates a Draft then cancels it from the listing page', async ({ page }) => {
    test.setTimeout(180000);
    const salesOrderPage = new SalesOrderPage(page);
    await salesOrderPage.goto();

    await salesOrderPage.clickNew();
    const uniqueRef = `TESTING-CANCEL-${Date.now()}`;
    await salesOrderPage.prepareSalesOrder({ ...testData, referenceNo: uniqueRef });
    await salesOrderPage.clickSaveDraft();
    expect(await salesOrderPage.expectSaveDraftSuccess()).toBe(true);

    await salesOrderPage.cancelDocument(uniqueRef);

    // Per this repo's convention: a success dialog isn't proof by itself —
    // verify with a fresh search that the row is genuinely gone from the
    // active (DRAFT + POSTED) listing view.
    expect(await salesOrderPage.isDocumentPresent(uniqueRef)).toBe(false);
  });
});
