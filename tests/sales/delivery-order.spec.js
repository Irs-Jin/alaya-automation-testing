const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { QuotationPage } = require('../../framework/pages/quotationPage');
const { DeliveryOrderPage } = require('../../framework/pages/deliveryOrderPage');

/**
 * No recording available — built by live-probing the real app directly
 * (2026-08-19) via a throwaway Node script (see DeliveryOrderPage's own
 * class comment for the full shape/gotchas discovered, including the
 * confirmed transfer source being Quotation, not Sales Order, and the
 * required Delivery Address).
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

/** Creates a fresh, guaranteed-open Quotation and returns its document number. */
async function createFreshQuotation(page) {
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
  return sqDocNo;
}

test.describe('Sales > Delivery Order', () => {

  test('[Post] posts a Delivery Order transferred from a Quotation', async ({ page }) => {
    test.setTimeout(180000);
    const sqDocNo = await createFreshQuotation(page);

    const deliveryOrderPage = new DeliveryOrderPage(page);
    await deliveryOrderPage.goto();
    await deliveryOrderPage.clickNew();
    await deliveryOrderPage.prepareDeliveryOrder({ customerCode: CUSTOMER_CODE, sqDocNo });
    await deliveryOrderPage.clickPost();

    expect(await deliveryOrderPage.expectPostSuccess()).toBe(true);
  });

  test('[Post & New] posts a Delivery Order and resets the form for the next entry', async ({ page }) => {
    test.setTimeout(180000);
    const sqDocNo = await createFreshQuotation(page);

    const deliveryOrderPage = new DeliveryOrderPage(page);
    await deliveryOrderPage.goto();
    await deliveryOrderPage.clickNew();
    await deliveryOrderPage.prepareDeliveryOrder({ customerCode: CUSTOMER_CODE, sqDocNo });
    await deliveryOrderPage.clickPostAndNew();

    expect(await deliveryOrderPage.expectFormReset()).toBe(true);
  });

  /**
   * Row-level Cancel, following the same pattern already built and merged
   * across this repo. This screen's own free-text "Reference No." field
   * (inherited from the transferred Quotation) is used as the search key.
   */
  test('[Cancel] posts a Delivery Order then cancels it from the listing page', async ({ page }) => {
    test.setTimeout(240000);
    const sqDocNo = await createFreshQuotation(page);

    const deliveryOrderPage = new DeliveryOrderPage(page);
    await deliveryOrderPage.goto();
    await deliveryOrderPage.clickNew();
    await deliveryOrderPage.prepareDeliveryOrder({ customerCode: CUSTOMER_CODE, sqDocNo });
    await deliveryOrderPage.clickPost();
    expect(await deliveryOrderPage.expectPostSuccess()).toBe(true);
    const doDocNo = await deliveryOrderPage.getPostedDocumentNumber();
    expect(doDocNo).toMatch(/DO-\d+/);

    await deliveryOrderPage.cancelDocument(doDocNo);

    // Per this repo's convention: a success dialog isn't proof by itself —
    // verify with a fresh search that the row is genuinely gone from the
    // active (DRAFT + POSTED) listing view.
    expect(await deliveryOrderPage.isDocumentPresent(doDocNo)).toBe(false);
  });
});
