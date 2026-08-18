const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { StockTransferPage } = require('../../framework/pages/stockTransferPage');
const { StockTransferReceiptPage } = require('../../framework/pages/stockTransferReceiptPage');

/**
 * Built from Jin's own Playwright codegen recording (2026-08-18), plus a
 * full live exploration/confirmation against SIT (uat/admin), following
 * Jin's own explicit instruction: create a Stock Transfer first, then use
 * it to complete a Stock Transfer Receipt — Post only.
 *
 * This screen has NO "New" action — its list auto-shows one pending
 * (DRAFT) row for every currently-POSTED, not-yet-received Stock
 * Transfer, keyed by that Stock Transfer's own Document No. in the
 * "Reference No" column. So this spec first creates and Posts its own
 * source Stock Transfer via StockTransferPage, reads back the real
 * "ST-XXXXXXXX" number it was assigned, then opens THAT SPECIFIC pending
 * row in Stock Transfer Receipt (matched by that reference text, never by
 * row position/index — see stockTransferReceiptPage.js for why: the
 * recording's own hardcoded row id was confirmed live to NOT be stable).
 *
 * CONFIRMED LIVE (2026-08-18): unlike every other Inventory module built
 * this session, this screen genuinely only supports Post — no Save Draft,
 * Post & New, Copy From, or Delete/Cancel action exists anywhere on it
 * (checked the form's own toolbar and the list's row actions). A posted
 * Stock Transfer Receipt is a permanent record, same as the real
 * inventory movement it represents, so this test — unlike every other
 * spec in this repo — does NOT delete/clean up the document it creates;
 * there is no mechanism to do so, and that is expected, not an oversight.
 * The source Stock Transfer itself also cannot be cleaned up afterward,
 * since posting the receipt is what consumes it (matches this repo's
 * established pattern of a "closing"/finalizing action removing a
 * document from further available-source lists).
 */
test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Inventory > Stock Transfer Receipt', () => {

  test('[Post] receives a Stock Transfer via Stock Transfer Receipt', async ({ page }) => {
    test.setTimeout(90000);

    const stockTransferPage = new StockTransferPage(page);
    await stockTransferPage.goto();
    await stockTransferPage.createStockTransfer({ referenceNo: 'TESTING_STR_SRC', itemName: 'SAFETY PIN' });
    await stockTransferPage.clickPost();

    // Read the real Document No. assigned by Post — Stock Transfer
    // Receipt's own list identifies the pending row by this exact
    // "ST-XXXXXXXX" text, not by any reference we chose.
    const stockTransferDocumentNo = await stockTransferPage.getDocumentNoAfterPost();
    expect(stockTransferDocumentNo).toMatch(/^ST-\d+$/);
    await stockTransferPage.clickBack();

    const stockTransferReceiptPage = new StockTransferReceiptPage(page);
    await stockTransferReceiptPage.goto();
    await stockTransferReceiptPage.openPendingReceipt(stockTransferDocumentNo);
    expect(await stockTransferReceiptPage.getStatus()).toBe('DRAFT');

    await stockTransferReceiptPage.fillReason('Testing');
    await stockTransferReceiptPage.clickPost();
  });
});
