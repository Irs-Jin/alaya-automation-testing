const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { StockTransferRequestPage } = require('../../framework/pages/stockTransferRequestPage');
const { StockTransferPage } = require('../../framework/pages/stockTransferPage');

/**
 * "No Cancel" variant of stock-transfer-copy-from.spec.js: covers the
 * [Save Draft], [Post], and [Post & New] scenarios, each building a
 * Stock Transfer via Copy From exactly as the original does, but
 * deliberately STOPPING right after — no Delete of either the transfer
 * OR its source Stock Transfer Request. The dedicated [Cancel] scenario
 * from stock-transfer-copy-from.spec.js has no no-cancel counterpart
 * here, since its entire purpose is exercising that Delete action itself.
 *
 * PERMANENT BY OMISSION — READ BEFORE RE-RUNNING: both this screen's
 * Delete and Stock Transfer Request's own Delete still work fine (see
 * stock-transfer-copy-from.spec.js) — these tests simply don't exercise
 * either. Each test leaves TWO real documents behind: a source Stock
 * Transfer Request and the Stock Transfer copied from it (except [Post]/
 * [Post & New], where Posting the transfer CONFIRMED LIVE finalizes/
 * consumes the source — see stock-transfer-copy-from.spec.js — so only
 * the transfer itself remains visible as PENDING-consumed). Both CAN be
 * deleted manually later. Reference numbers use the same short-unique-
 * suffix pattern as the original to avoid collisions across repeated
 * runs.
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

test.describe('Inventory > Stock Transfer (Copy From)', () => {

  test('[Save Draft, No Cancel] builds a Stock Transfer via Copy From, saved as draft', async ({ page }) => {
    test.setTimeout(90000);
    const sourceRef = `TESTING_NCXSD${runSuffix()}`;
    const transferRef = `TESTING_NCXTD${runSuffix()}`;

    const stockTransferRequestPage = new StockTransferRequestPage(page);
    await stockTransferRequestPage.goto();
    await stockTransferRequestPage.createStockTransferRequest({ referenceNo: sourceRef, itemName: 'SAFETY PIN' });
    await stockTransferRequestPage.clickPost();
    await stockTransferRequestPage.clickBack();

    const stockTransferPage = new StockTransferPage(page);
    await stockTransferPage.goto();
    await stockTransferPage.createStockTransferViaCopyFrom({
      referenceNo: transferRef,
      sourceReferenceNo: sourceRef,
    });
    await stockTransferPage.clickSaveDraft();
    expect(await stockTransferPage.getStatus()).toBe('DRAFT');
    await stockTransferPage.clickBack();

    // No cleanup: see class doc — Delete of both the transfer and its
    // source is left unexercised on purpose.
  });

  test('[Post, No Cancel] builds a Stock Transfer via Copy From', async ({ page }) => {
    test.setTimeout(90000);
    const sourceRef = `TESTING_NCXSP${runSuffix()}`;
    const transferRef = `TESTING_NCXTP${runSuffix()}`;

    const stockTransferRequestPage = new StockTransferRequestPage(page);
    await stockTransferRequestPage.goto();
    await stockTransferRequestPage.createStockTransferRequest({ referenceNo: sourceRef, itemName: 'SAFETY PIN' });
    await stockTransferRequestPage.clickPost();
    await stockTransferRequestPage.clickBack();

    const stockTransferPage = new StockTransferPage(page);
    await stockTransferPage.goto();
    await stockTransferPage.createStockTransferViaCopyFrom({
      referenceNo: transferRef,
      sourceReferenceNo: sourceRef,
    });
    await stockTransferPage.clickPost();
    await stockTransferPage.clickBack();

    // No cleanup: see class doc — Delete of the transfer is left
    // unexercised on purpose. Posting CONFIRMED LIVE consumes the source,
    // so no separate source document survives to clean up either.
  });

  test('[Post & New, No Cancel] builds a Stock Transfer via Copy From via Post & New', async ({ page }) => {
    test.setTimeout(90000);
    const sourceRef = `TESTING_NCXSN${runSuffix()}`;
    const transferRef = `TESTING_NCXTN${runSuffix()}`;

    const stockTransferRequestPage = new StockTransferRequestPage(page);
    await stockTransferRequestPage.goto();
    await stockTransferRequestPage.createStockTransferRequest({ referenceNo: sourceRef, itemName: 'SAFETY PIN' });
    await stockTransferRequestPage.clickPost();
    await stockTransferRequestPage.clickBack();

    const stockTransferPage = new StockTransferPage(page);
    await stockTransferPage.goto();
    await stockTransferPage.createStockTransferViaCopyFrom({
      referenceNo: transferRef,
      sourceReferenceNo: sourceRef,
    });
    await stockTransferPage.clickPostAndNew();
    // Post & New leaves a fresh, blank, unsaved New form behind — safe to
    // leave via Back without entering anything into it.
    await stockTransferPage.clickBack();

    // No cleanup: see class doc — same reasoning as [Post, No Cancel].
  });
});
