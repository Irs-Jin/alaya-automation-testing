const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { StockTransferRequestPage } = require('../../framework/pages/stockTransferRequestPage');
const { CloseStockTransferRequestPage } = require('../../framework/pages/closeStockTransferRequestPage');

/**
 * "No Cancel" variant of close-stock-transfer-request.spec.js: covers the
 * [Save Draft], [Post], and [Post & New] scenarios, each closing a
 * source Stock Transfer Request via Copy From exactly as the original
 * does, but deliberately STOPPING right after — no Delete of either the
 * closing document OR its source Stock Transfer Request.
 *
 * PERMANENT BY OMISSION — READ BEFORE RE-RUNNING: Stock Transfer
 * Request's own Delete works fine, and this screen's Delete works fine
 * for POSTED rows (though CONFIRMED APP BUG: it does NOT actually work
 * for DRAFT rows — see close-stock-transfer-request.spec.js — moot here
 * since these tests never call Delete either way). Each test leaves TWO
 * real documents behind: a source Stock Transfer Request and the closing
 * document copied from it (except [Post]/[Post & New], where Posting the
 * closure CONFIRMED LIVE finalizes/consumes the source — see
 * close-stock-transfer-request.spec.js — so only the closing document
 * itself remains). Both CAN be deleted manually later where Delete
 * genuinely works. Reference numbers use the same short-unique-suffix
 * pattern as the original to avoid collisions across repeated runs.
 */
const runSuffix = () => String(Date.now()).slice(-6);

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Inventory > Close Stock Transfer Request', () => {

  test('[Save Draft, No Cancel] closes a Stock Transfer Request via Copy From, saved as draft', async ({ page }) => {
    test.setTimeout(90000);
    const sourceRef = `TESTING_NCYSD${runSuffix()}`;
    const closeRef = `TESTING_NCYCD${runSuffix()}`;

    const stockTransferRequestPage = new StockTransferRequestPage(page);
    await stockTransferRequestPage.goto();
    await stockTransferRequestPage.createStockTransferRequest({ referenceNo: sourceRef, itemName: 'SAFETY PIN' });
    await stockTransferRequestPage.clickPost();
    await stockTransferRequestPage.clickBack();

    const closeStockTransferRequestPage = new CloseStockTransferRequestPage(page);
    await closeStockTransferRequestPage.goto();
    await closeStockTransferRequestPage.createCloseStockTransferRequest({
      referenceNo: closeRef,
      sourceReferenceNo: sourceRef,
    });
    await closeStockTransferRequestPage.clickSaveDraft();
    expect(await closeStockTransferRequestPage.getStatus()).toBe('DRAFT');
    await closeStockTransferRequestPage.clickBack();

    // No cleanup: see class doc — Delete of both the closing document and
    // its source is left unexercised on purpose.
  });

  test('[Post, No Cancel] closes a Stock Transfer Request via Copy From', async ({ page }) => {
    test.setTimeout(90000);
    const sourceRef = `TESTING_NCYSP${runSuffix()}`;
    const closeRef = `TESTING_NCYCP${runSuffix()}`;

    const stockTransferRequestPage = new StockTransferRequestPage(page);
    await stockTransferRequestPage.goto();
    await stockTransferRequestPage.createStockTransferRequest({ referenceNo: sourceRef, itemName: 'SAFETY PIN' });
    await stockTransferRequestPage.clickPost();
    await stockTransferRequestPage.clickBack();

    const closeStockTransferRequestPage = new CloseStockTransferRequestPage(page);
    await closeStockTransferRequestPage.goto();
    await closeStockTransferRequestPage.createCloseStockTransferRequest({
      referenceNo: closeRef,
      sourceReferenceNo: sourceRef,
    });
    await closeStockTransferRequestPage.clickPost();
    await closeStockTransferRequestPage.clickBack();

    // No cleanup: see class doc — Delete of the closing document is left
    // unexercised on purpose. Posting CONFIRMED LIVE consumes the source,
    // so no separate source document survives to clean up either.
  });

  test('[Post & New, No Cancel] closes a Stock Transfer Request via Copy From via Post & New', async ({ page }) => {
    test.setTimeout(90000);
    const sourceRef = `TESTING_NCYSN${runSuffix()}`;
    const closeRef = `TESTING_NCYCN${runSuffix()}`;

    const stockTransferRequestPage = new StockTransferRequestPage(page);
    await stockTransferRequestPage.goto();
    await stockTransferRequestPage.createStockTransferRequest({ referenceNo: sourceRef, itemName: 'SAFETY PIN' });
    await stockTransferRequestPage.clickPost();
    await stockTransferRequestPage.clickBack();

    const closeStockTransferRequestPage = new CloseStockTransferRequestPage(page);
    await closeStockTransferRequestPage.goto();
    await closeStockTransferRequestPage.createCloseStockTransferRequest({
      referenceNo: closeRef,
      sourceReferenceNo: sourceRef,
    });
    await closeStockTransferRequestPage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await closeStockTransferRequestPage.clickBack();

    // No cleanup: see class doc — same reasoning as [Post, No Cancel].
  });
});
