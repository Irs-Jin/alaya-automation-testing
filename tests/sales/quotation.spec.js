const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { QuotationPage } = require('../../framework/pages/quotationPage');

/**
 * No recording available — built by live-probing the real app directly
 * (2026-08-19) using the playwright-cli interactive tool (see
 * QuotationPage's own class comment for the full shape/gotchas
 * discovered). First screen of the Sales cycle — no "Copy From" transfer
 * source, just New -> Customer -> Sales Branch -> Item -> Save Draft/Post.
 *
 * UPDATED (2026-08-19): the shared `uat` login's default company changed
 * server-side from qa3/SHANTHI QA BIZ 69 to UAT/TANJAK MEGA GROUP SDN BHD
 * (confirmed live via the footer's "Client ID:" label after a machine
 * restart) — the old SHANTHI-specific test data (Customer "000000002",
 * Sales Branch "SHAQABIZ69", item "stock item 01 MMM") no longer exists in
 * this company. Re-probed live against TANJAK MEGA GROUP SDN BHD and
 * confirmed real: Customer "000001", Sales Branch "T01" (AMIRUL HALAL MART
 * (TAMBUN)), item "BISKUT PLANTA" (plenty of stock). Different
 * clients/companies will have different master data — override via env
 * vars rather than editing this file when pointing at another one.
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

test.describe('Sales > Quotation', () => {

  const testData = {
    customerCode: CUSTOMER_CODE,
    salesBranchCode: SALES_BRANCH_CODE,
    itemDescription: ITEM_DESCRIPTION,
  };

  test('[Save Draft] saves a Quotation with one item', async ({ page }) => {
    test.setTimeout(90000);
    const quotationPage = new QuotationPage(page);
    await quotationPage.goto();

    await quotationPage.clickNew();
    await quotationPage.prepareQuotation(testData);
    await quotationPage.clickSaveDraft();

    expect(await quotationPage.expectSaveDraftSuccess()).toBe(true);
  });

  test('[Post] posts a Quotation with one item', async ({ page }) => {
    test.setTimeout(90000);
    const quotationPage = new QuotationPage(page);
    await quotationPage.goto();

    await quotationPage.clickNew();
    await quotationPage.prepareQuotation(testData);
    await quotationPage.clickPost();
    await quotationPage.dismissEInvoiceValidationPromptIfPresent();

    expect(await quotationPage.expectPostSuccess()).toBe(true);
  });

  test('[Post & New] posts a Quotation and resets the form for the next entry', async ({ page }) => {
    test.setTimeout(90000);
    const quotationPage = new QuotationPage(page);
    await quotationPage.goto();

    await quotationPage.clickNew();
    const beforeNo = await quotationPage.getNextPossibleNo();
    await quotationPage.prepareQuotation(testData);
    await quotationPage.clickPostAndNew();
    await quotationPage.dismissEInvoiceValidationPromptIfPresent();

    expect(await quotationPage.expectFormReset()).toBe(true);
    const afterNo = await quotationPage.getNextPossibleNo();
    expect(afterNo).not.toBe(beforeNo);
  });

  test('[Cancel] creates a Draft then cancels it from the listing page', async ({ page }) => {
    test.setTimeout(180000);
    const quotationPage = new QuotationPage(page);
    await quotationPage.goto();

    await quotationPage.clickNew();
    const uniqueRef = `TESTING-CANCEL-${Date.now()}`;
    await quotationPage.prepareQuotation({ ...testData, referenceNo: uniqueRef });
    await quotationPage.clickSaveDraft();
    expect(await quotationPage.expectSaveDraftSuccess()).toBe(true);

    await quotationPage.cancelDocument(uniqueRef);

    // Per this repo's convention: a success dialog isn't proof by itself —
    // verify with a fresh search that the row is genuinely gone from the
    // active (DRAFT + POSTED) listing view.
    expect(await quotationPage.isDocumentPresent(uniqueRef)).toBe(false);
  });
});
