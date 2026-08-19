const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { SalesOrderPage } = require('../../framework/pages/salesOrderPage');
const { CloseSalesOrderPage } = require('../../framework/pages/closeSalesOrderPage');

/**
 * No recording available — built by live-probing the real app directly
 * (2026-08-19) via a throwaway Node script (see CloseSalesOrderPage's own
 * class comment for the full shape/gotchas discovered, including the
 * confirmed-necessary direct-DOM-click on the "Copy From" submenu item,
 * and the confirmed absence of an auto-opened report tab on Post — this
 * screen's completion signal is the Document No. field itself).
 *
 * Closing an SO consumes it, so this test creates its OWN fresh Sales
 * Order first (via SalesOrderPage) rather than depending on whatever
 * happens to still be open in the shared environment — same reasoning as
 * close-purchase-order.spec.js's own setup.
 *
 * Test data confirmed live (2026-08-19) against qa3/SHANTHI QA BIZ 69,
 * same values already confirmed working in sales-order.spec.js. Different
 * clients/companies will have different master data — override via env
 * vars rather than editing this file when pointing at another one.
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

/** Creates a fresh, guaranteed-open Sales Order and returns its document number. */
async function createFreshSalesOrder(page) {
  const salesOrderPage = new SalesOrderPage(page);
  await salesOrderPage.goto();
  await salesOrderPage.clickNew();
  await salesOrderPage.prepareSalesOrder({
    customerCode: CUSTOMER_CODE,
    salesBranchCode: SALES_BRANCH_CODE,
    itemDescription: ITEM_DESCRIPTION,
  });
  await salesOrderPage.clickPost();
  await salesOrderPage.dismissEInvoiceValidationPromptIfPresent();
  expect(await salesOrderPage.expectPostSuccess()).toBe(true);
  const soDocNo = await salesOrderPage.getPostedDocumentNumber();
  expect(soDocNo).toMatch(/SO-\d+/);
  return soDocNo;
}

test.describe('Sales > Close Sales Order', () => {

  test('[Happy Path] closes a freshly created Sales Order via Transfer from SO', async ({ page }) => {
    test.setTimeout(120000);
    const soDocNo = await createFreshSalesOrder(page);

    const closeSalesOrderPage = new CloseSalesOrderPage(page);
    await closeSalesOrderPage.goto();
    await closeSalesOrderPage.clickNew();
    await closeSalesOrderPage.closeSalesOrder({ customerCode: CUSTOMER_CODE, soDocNo });

    expect(await closeSalesOrderPage.expectPostSuccess()).toBe(true);
  });

  test('[Cancel] closes a Sales Order then cancels the Close Sales Order from the listing page', async ({ page }) => {
    test.setTimeout(180000);
    const soDocNo = await createFreshSalesOrder(page);

    const closeSalesOrderPage = new CloseSalesOrderPage(page);
    await closeSalesOrderPage.goto();
    await closeSalesOrderPage.clickNew();
    await closeSalesOrderPage.closeSalesOrder({ customerCode: CUSTOMER_CODE, soDocNo });
    expect(await closeSalesOrderPage.expectPostSuccess()).toBe(true);
    const xsDocNo = await closeSalesOrderPage.getPostedDocumentNumber();
    expect(xsDocNo).toMatch(/XS-\d+/);

    await closeSalesOrderPage.cancelDocument(xsDocNo);

    // Per this repo's convention: a success dialog isn't proof by itself —
    // verify with a fresh search that the row is genuinely gone from the
    // active (DRAFT + POSTED) listing view.
    expect(await closeSalesOrderPage.isDocumentPresent(xsDocNo)).toBe(false);
  });
});
