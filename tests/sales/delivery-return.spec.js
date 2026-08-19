const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { QuotationPage } = require('../../framework/pages/quotationPage');
const { DeliveryOrderPage } = require('../../framework/pages/deliveryOrderPage');
const { DeliveryReturnPage } = require('../../framework/pages/deliveryReturnPage');

/**
 * No recording available — built by live-probing the real app directly
 * (2026-08-19) via a throwaway Node script (see DeliveryReturnPage's own
 * class comment for the full shape/gotchas discovered, including the
 * confirmed Customer-must-be-selected-before-Copy-From requirement, no
 * Delivery Address needed, and the report-less Post success signal).
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

/** Creates a fresh, guaranteed-open Delivery Order (via a fresh Quotation) and returns its document number. */
async function createFreshDeliveryOrder(page) {
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
  return doDocNo;
}

test.describe('Sales > Delivery Return', () => {

  test('[Post] posts a Delivery Return transferred from a Delivery Order', async ({ page }) => {
    test.setTimeout(180000);
    const doDocNo = await createFreshDeliveryOrder(page);

    const deliveryReturnPage = new DeliveryReturnPage(page);
    await deliveryReturnPage.goto();
    await deliveryReturnPage.clickNew();
    await deliveryReturnPage.prepareDeliveryReturn({ customerCode: CUSTOMER_CODE, doDocNo });
    await deliveryReturnPage.clickPost();

    expect(await deliveryReturnPage.expectPostSuccess()).toBe(true);
  });

  test('[Post & New] posts a Delivery Return and resets the form for the next entry', async ({ page }) => {
    test.setTimeout(180000);
    const doDocNo = await createFreshDeliveryOrder(page);

    const deliveryReturnPage = new DeliveryReturnPage(page);
    await deliveryReturnPage.goto();
    await deliveryReturnPage.clickNew();
    await deliveryReturnPage.prepareDeliveryReturn({ customerCode: CUSTOMER_CODE, doDocNo });
    await deliveryReturnPage.clickPostAndNew();

    expect(await deliveryReturnPage.expectFormReset()).toBe(true);
  });

  /**
   * Row-level Cancel, following the same pattern already built and merged
   * across this repo. Uses this Delivery Return's own document number
   * (read directly from the Document No. field after Post) as the search
   * key — guaranteed unique, unlike the free-text Reference No. field.
   */
  test('[Cancel] posts a Delivery Return then cancels it from the listing page', async ({ page }) => {
    test.setTimeout(240000);
    const doDocNo = await createFreshDeliveryOrder(page);

    const deliveryReturnPage = new DeliveryReturnPage(page);
    await deliveryReturnPage.goto();
    await deliveryReturnPage.clickNew();
    await deliveryReturnPage.prepareDeliveryReturn({ customerCode: CUSTOMER_CODE, doDocNo });
    await deliveryReturnPage.clickPost();
    expect(await deliveryReturnPage.expectPostSuccess()).toBe(true);
    const drDocNo = await deliveryReturnPage.getPostedDocumentNumber();
    expect(drDocNo).toMatch(/DR-\d+/);

    await deliveryReturnPage.cancelDocument(drDocNo);

    // Per this repo's convention: a success dialog isn't proof by itself —
    // verify with a fresh search that the row is genuinely gone from the
    // active (DRAFT + POSTED) listing view.
    expect(await deliveryReturnPage.isDocumentPresent(drDocNo)).toBe(false);
  });
});
