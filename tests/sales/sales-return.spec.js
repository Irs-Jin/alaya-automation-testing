const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { QuotationPage } = require('../../framework/pages/quotationPage');
const { DeliveryOrderPage } = require('../../framework/pages/deliveryOrderPage');
const { SalesInvoicePage } = require('../../framework/pages/salesInvoicePage');
const { SalesReturnPage } = require('../../framework/pages/salesReturnPage');

/**
 * No recording available — built by live-probing the real app directly
 * (2026-08-20) via a throwaway Node script (see SalesReturnPage's own class
 * comment for the full shape/gotchas discovered, including Copy From's
 * shared multi-source menu with Sales Invoice, no Delivery Address
 * requirement, and the report-less Post success signal).
 *
 * Test data: Customer "000001", Sales Branch "T01", item "BISKUT PLANTA" —
 * same values used across every Sales-module spec (see quotation.spec.js's
 * own header comment for the qa3 -> TANJAK MEGA GROUP company-switch
 * context). Different clients/companies will have different master data —
 * override via env vars rather than editing this file when pointing at
 * another one.
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

/** Creates a fresh, guaranteed-open Sales Invoice (via a fresh Quotation -> Delivery Order chain) and returns its document number. */
async function createFreshSalesInvoice(page) {
  const quotationPage = new QuotationPage(page);
  await quotationPage.goto();
  await quotationPage.clickNew();
  await quotationPage.prepareQuotation({
    customerCode: CUSTOMER_CODE,
    salesBranchCode: SALES_BRANCH_CODE,
    itemDescription: ITEM_DESCRIPTION,
  });
  await quotationPage.clickPost();
  await quotationPage.dismissEInvoiceValidationPromptIfPresent();
  expect(await quotationPage.expectPostSuccess()).toBe(true);
  const sqDocNo = await quotationPage.getPostedDocumentNumber();
  expect(sqDocNo).toMatch(/SQ-\d+/);

  const deliveryOrderPage = new DeliveryOrderPage(page);
  await deliveryOrderPage.goto();
  await deliveryOrderPage.clickNew();
  await deliveryOrderPage.prepareDeliveryOrder({ customerCode: CUSTOMER_CODE, sqDocNo });
  await deliveryOrderPage.clickPost();
  expect(await deliveryOrderPage.expectPostSuccess()).toBe(true);
  const doDocNo = await deliveryOrderPage.getPostedDocumentNumber();
  expect(doDocNo).toMatch(/DO-\d+/);

  const salesInvoicePage = new SalesInvoicePage(page);
  await salesInvoicePage.goto();
  await salesInvoicePage.clickNew();
  await salesInvoicePage.prepareSalesInvoice({ customerCode: CUSTOMER_CODE, doDocNo });
  await salesInvoicePage.clickPost();
  expect(await salesInvoicePage.expectPostSuccess()).toBe(true);
  const ivDocNo = await salesInvoicePage.getPostedDocumentNumber();
  expect(ivDocNo).toMatch(/IV-\d+/);
  return ivDocNo;
}

test.describe('Sales > Sales Return', () => {

  test('[Post] posts a Sales Return transferred from a Sales Invoice', async ({ page }) => {
    test.setTimeout(240000);
    const ivDocNo = await createFreshSalesInvoice(page);

    const salesReturnPage = new SalesReturnPage(page);
    await salesReturnPage.goto();
    await salesReturnPage.clickNew();
    await salesReturnPage.prepareSalesReturn({ customerCode: CUSTOMER_CODE, ivDocNo });
    await salesReturnPage.clickPost();

    expect(await salesReturnPage.expectPostSuccess()).toBe(true);
  });

  test('[Post & New] posts a Sales Return and resets the form for the next entry', async ({ page }) => {
    test.setTimeout(240000);
    const ivDocNo = await createFreshSalesInvoice(page);

    const salesReturnPage = new SalesReturnPage(page);
    await salesReturnPage.goto();
    await salesReturnPage.clickNew();
    await salesReturnPage.prepareSalesReturn({ customerCode: CUSTOMER_CODE, ivDocNo });
    await salesReturnPage.clickPostAndNew();

    expect(await salesReturnPage.expectFormReset()).toBe(true);
  });

  /**
   * Row-level Cancel, following the same pattern already built and merged
   * across this repo. Uses this Sales Return's own document number (read
   * directly from the Document No. field after Post) as the search key —
   * guaranteed unique, unlike the free-text Reference No. field.
   */
  test('[Cancel] posts a Sales Return then cancels it from the listing page', async ({ page }) => {
    test.setTimeout(300000);
    const ivDocNo = await createFreshSalesInvoice(page);

    const salesReturnPage = new SalesReturnPage(page);
    await salesReturnPage.goto();
    await salesReturnPage.clickNew();
    await salesReturnPage.prepareSalesReturn({ customerCode: CUSTOMER_CODE, ivDocNo });
    await salesReturnPage.clickPost();
    expect(await salesReturnPage.expectPostSuccess()).toBe(true);
    const cnDocNo = await salesReturnPage.getPostedDocumentNumber();
    expect(cnDocNo).toMatch(/CN-\d+/);

    await salesReturnPage.cancelDocument(cnDocNo);

    // Per this repo's convention: a success dialog isn't proof by itself —
    // verify with a fresh search that the row is genuinely gone from the
    // active (DRAFT + POSTED) listing view.
    expect(await salesReturnPage.isDocumentPresent(cnDocNo)).toBe(false);
  });
});
