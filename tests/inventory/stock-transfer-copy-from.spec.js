const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { StockTransferRequestPage } = require('../../framework/pages/stockTransferRequestPage');
const { StockTransferPage } = require('../../framework/pages/stockTransferPage');

/**
 * Covers Inventory > Stock Transfer's "Copy From" flow — building the
 * document by copying a source Stock Transfer Request's header + item
 * lines in, rather than adding item lines manually (see
 * stock-transfer.spec.js for that flow). Built from a full live
 * exploration/confirmation against SIT (uat/admin), following the same
 * "must start with Copy From, then Save Draft/Post/Post & New/Cancel"
 * shape already confirmed for Close Stock Transfer Request.
 *
 * CONFIRMED LIVE (2026-08-18): requires From Warehouse, To Warehouse, and
 * Reason to already be filled before Copy From will proceed (clicking it
 * on a blank form is rejected with a validation toast and no picker
 * opens). Goes DIRECTLY to the "TransferFrom" picker grid — no
 * intermediate document-type selector.
 *
 * SAFETY: rather than depending on any pre-existing real Stock Transfer
 * Request in this environment, each scenario here first creates its OWN
 * source Stock Transfer Request via StockTransferRequestPage and Posts
 * it, then copies THAT document.
 *
 * CONFIRMED LIVE (2026-08-18) — genuinely different from Close Stock
 * Transfer Request, NOT assumed by analogy: Posting a Stock Transfer built
 * via Copy From does NOT consume/finalize its source — the source Stock
 * Transfer Request remains PENDING (not IN TRANSIT) even after the
 * copying Stock Transfer is POSTED or Post & New'd. So every scenario
 * here, including Post and Post & New, must explicitly delete its own
 * source afterward — there is no free consumption to rely on.
 *
 * CONFIRMED LIVE (2026-08-18): unlike Close Stock Transfer Request, this
 * screen has NO Delete bug — Delete genuinely works for both DRAFT and
 * POSTED documents built via Copy From, same as the manual-entry flow in
 * stock-transfer.spec.js. Reference numbers include a short unique
 * timestamp suffix per this repo's confirmed collision-avoidance pattern
 * (see close-stock-transfer-request.spec.js), so repeated runs never
 * collide with leftover data from a previous run.
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

  test('[Save Draft] builds a Stock Transfer via Copy From, saved as draft, then deletes it', async ({ page }) => {
    test.setTimeout(90000);
    const sourceRef = `TESTING_SCD${runSuffix()}`;
    const transferRef = `TESTING_SCCD${runSuffix()}`;

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

    await stockTransferPage.deleteDocument(transferRef);
    expect(await stockTransferPage.isDeleteSuccessful(transferRef)).toBe(true);

    // The source Stock Transfer Request was only copied into a DRAFT
    // transfer (never Posted), so per CONFIRMED LIVE behavior it was
    // never consumed — clean it up too.
    await stockTransferRequestPage.goto();
    await stockTransferRequestPage.deleteDocument(sourceRef);
    expect(await stockTransferRequestPage.isDeleteSuccessful(sourceRef)).toBe(true);
  });

  test('[Post] builds a Stock Transfer via Copy From, then deletes it', async ({ page }) => {
    test.setTimeout(90000);
    const sourceRef = `TESTING_SCP${runSuffix()}`;
    const transferRef = `TESTING_SCCP${runSuffix()}`;

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

    await stockTransferPage.deleteDocument(transferRef);
    expect(await stockTransferPage.isDeleteSuccessful(transferRef)).toBe(true);

    // CONFIRMED LIVE (2026-08-18): unlike Close Stock Transfer Request,
    // Posting this screen's Copy-From transfer does NOT consume its
    // source — it stays PENDING, so it must be cleaned up explicitly.
    await stockTransferRequestPage.goto();
    await stockTransferRequestPage.deleteDocument(sourceRef);
    expect(await stockTransferRequestPage.isDeleteSuccessful(sourceRef)).toBe(true);
  });

  test('[Post & New] builds a Stock Transfer via Copy From via Post & New, then deletes it', async ({ page }) => {
    test.setTimeout(90000);
    const sourceRef = `TESTING_SCN${runSuffix()}`;
    const transferRef = `TESTING_SCCN${runSuffix()}`;

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

    await stockTransferPage.deleteDocument(transferRef);
    expect(await stockTransferPage.isDeleteSuccessful(transferRef)).toBe(true);

    // Same as plain Post — CONFIRMED LIVE (2026-08-18) Post & New does not
    // consume the source either, so it needs its own explicit cleanup.
    await stockTransferRequestPage.goto();
    await stockTransferRequestPage.deleteDocument(sourceRef);
    expect(await stockTransferRequestPage.isDeleteSuccessful(sourceRef)).toBe(true);
  });

  test('[Cancel] builds a draft Stock Transfer via Copy From then cancels it via the row\'s Delete action', async ({ page }) => {
    test.setTimeout(90000);
    const sourceRef = `TESTING_SCX${runSuffix()}`;
    const transferRef = `TESTING_SCCX${runSuffix()}`;

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

    // CONFIRMED LIVE (2026-08-18): this screen has no distinct "Cancel"
    // dialog — the row's own "Delete" action is the real cancel/cleanup
    // mechanism, and it's what this scenario exercises.
    await stockTransferPage.deleteDocument(transferRef);
    expect(await stockTransferPage.isDeleteSuccessful(transferRef)).toBe(true);

    await stockTransferRequestPage.goto();
    await stockTransferRequestPage.deleteDocument(sourceRef);
    expect(await stockTransferRequestPage.isDeleteSuccessful(sourceRef)).toBe(true);
  });
});
