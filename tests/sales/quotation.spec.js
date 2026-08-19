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
 * Test data confirmed live (2026-08-19) against qa3/SHANTHI QA BIZ 69,
 * reusing the same Customer/Sales Branch values already confirmed working
 * in tests/sales/cash-sales.spec.js (Customer "000000002", Sales Branch
 * "SHAQABIZ69"). Different clients/companies will have different master
 * data — override via env vars rather than editing this file when
 * pointing at another one.
 *
 * BUG FIXED (2026-08-19): cash-sales.spec.js's own item default
 * ("stock item 01") no longer matches any item's exact Description live —
 * the item search popup's own live data now shows this item's full
 * Description as "stock item 01 MMM" (item code 000014), confirmed via a
 * failure screenshot. Likely the master data was renamed since that file
 * was last verified; using the current real value here rather than the
 * stale one.
 */
const CUSTOMER_CODE = process.env.ALAYA_TEST_CUSTOMER_CODE || '000000002';
const SALES_BRANCH_CODE = process.env.ALAYA_TEST_SALES_BRANCH_CODE || 'SHAQABIZ69';
const ITEM_DESCRIPTION = process.env.ALAYA_TEST_ITEM_DESCRIPTION || 'stock item 01 MMM';

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
