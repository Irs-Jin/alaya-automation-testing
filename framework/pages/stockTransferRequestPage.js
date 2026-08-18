const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Inventory (transactional module) > Stock Transfer
 * Request.
 *
 * SOURCE: built directly from Jin's own Playwright codegen recording
 * (2026-08-17) plus a full live exploration/confirmation of the same SIT
 * environment (uat/admin) — no Katalon Object Repository entry exists for
 * this screen yet. Every selector below was exercised live end-to-end
 * (Save Draft, Post, and Post & New, each followed by Delete + a fresh
 * grid check to confirm gone) against a real Item ("SAFETY PIN", code
 * 01234) and Warehouses ("AMPANG"/"BERCHAM RAYA") — all cleaned up before
 * this page object was written, zero residual test data left behind.
 *
 * SHAPE: similar to stockReceivePage.js/stockIssuePage.js/
 * stockAdjustmentPage.js (same item-search-icon popup with
 * auto-populated Qty), but with two Warehouse fields instead of one:
 *
 * 1. "From Warehouse:*" and "To Warehouse:*" — CONFIRMED live both are
 *    the same Code/Name popup-list combo already confirmed elsewhere.
 *    AMPANG confirmed index 0 (same as every other Inventory module);
 *    BERCHAM RAYA confirmed index 1 — CONFIRMED LIVE the To Warehouse
 *    list is NOT filtered to exclude the already-selected From Warehouse
 *    (both AMPANG and BERCHAM RAYA appear in it), so index-1 selection
 *    genuinely lands on BERCHAM RAYA, matching Jin's own recording.
 *
 * 2. "Reason:*" (mandatory) and "Authorized By:" (optional) are BOTH
 *    plain textboxes with a genuinely confirmed accessible name attached
 *    (unlike Stock Adjustment's "Reason:" label, which was NOT actually
 *    associated with its field) — verified directly via
 *    `getByRole('textbox', {name: ...})` matching live, not assumed by
 *    analogy to the similarly-named Stock Adjustment field.
 *
 * CONFIRMED LIVE (2026-08-17): like every other Inventory module built
 * this session, Save Draft, Post, and Post & New all complete with NO
 * confirmation dialog whatsoever.
 *
 * CONFIRMED LIVE (2026-08-17): Post opens a NEW in-app workspace tab
 * ("Stock Transfer Request Summary Report"). Post & New does NOT open a
 * report tab on this screen — same as Stock Issue/Stock Adjustment (Stock
 * Receive is the one exception in this app) — it just posts and leaves a
 * fresh blank form in the SAME tab.
 *
 * CONFIRMED LIVE (2026-08-17): like Stock Adjustment, this screen has NO
 * soft-cancel concept at all. The row's action link is genuinely
 * labelled "Delete" (not "Cancel"), and clicking it shows the app-wide
 * "Delete Confirmation" dialog via the SAME `pcConfirmDel_btnYes_CD`
 * control already confirmed in itemPage.js/stockAdjustmentPage.js —
 * CONFIRMED this is a genuine HARD DELETE, for BOTH DRAFT and POSTED
 * documents (verified by creating, Posting, then Deleting a real POSTED
 * test document and confirming via a fresh reload that the row was
 * completely gone). Method names below reflect this
 * (`deleteDocument`/`isDeleteSuccessful`), matching
 * stockAdjustmentPage.js's convention.
 *
 * SAFETY LESSON (2026-08-17): a single screenshot/snapshot taken
 * immediately after confirming Delete can show a stale render (the row
 * still appearing) even though the delete genuinely succeeded — same
 * trap already documented in stockIssuePage.js/stockAdjustmentPage.js.
 * `isDeleteSuccessful()`'s poll-based check (retrying for up to 10s)
 * already tolerates this.
 *
 * CONFIRMED LIVE (2026-08-17): opening an ALREADY-SAVED document via its
 * Document No. link in the list (edit mode) shows NO "Back" toolbar
 * button at all, same pattern already confirmed on every other Inventory
 * module. Does not affect this page object, since every method here
 * reaches the form exclusively via clickNew() (which DOES show Back).
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable — always re-resolved via findFrame() by content, never
 * hardcoded.
 */
class StockTransferRequestPage {
  constructor(page) {
    this.page = page;
    this.listFrame = null;
    this.formFrame = null;
  }

  /**
   * CONFIRMED live (2026-08-18): scoped to `#navBar` — if a "Stock
   * Transfer Request" workspace tab is already open (e.g. calling goto()
   * a second time later in the same test, to reach a source document for
   * cleanup), the app's own open-tab bar ALSO carries a link with the
   * exact same accessible name, causing a strict-mode ambiguity without
   * this scope.
   */
  async goto() {
    const p = this.page;
    await p.getByRole('link', { name: 'Inventory', exact: true }).click();
    await p.locator('#navBar').getByRole('link', { name: 'Stock Transfer Request', exact: true }).click();
    await p.waitForLoadState('domcontentloaded');
    await this._resolveListFrame();
  }

  async _resolveListFrame() {
    const p = this.page;
    this.listFrame = await findFrame(p, async (frame) => {
      const addIcon = frame.getByRole('img', { name: /Click Here Or Press \[Insert\]/i });
      return (await addIcon.count().catch(() => 0)) > 0 && (await addIcon.first().isVisible().catch(() => false));
    });
    if (!this.listFrame) {
      await p.screenshot({ path: 'test-results/debug-stock-transfer-request-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the frame containing the Stock Transfer Request list "New" icon. ' +
        'Saved test-results/debug-stock-transfer-request-list-page.png for inspection.'
      );
    }
  }

  /** CONFIRMED live (2026-08-17): unlike Stock Adjustment's equivalent, the Reason field here genuinely has "Reason:" as its accessible name — verified directly, not assumed. */
  async _resolveFormFrame() {
    const p = this.page;
    this.formFrame = await findFrame(p, async (frame) => {
      const field = frame.getByRole('textbox', { name: 'Reason:', exact: true });
      return (await field.count().catch(() => 0)) > 0 && (await field.first().isVisible().catch(() => false));
    });
    if (!this.formFrame) {
      await p.screenshot({ path: 'test-results/debug-stock-transfer-request-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Stock Transfer Request create/edit form frame (Reason field). ' +
        'Saved test-results/debug-stock-transfer-request-form-not-found.png for inspection.'
      );
    }
  }

  /** CONFIRMED live (2026-08-17): the grid header's own "New"/Insert icon; role match as fallback. */
  async clickNew() {
    let addIcon;
    try {
      const { locator } = await heal(this.listFrame, {
        id: 'stockTransferRequest.newIcon',
        label: 'New',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_InventoryTransferRequest1_cpnlInventoryTransferRequest_formInventoryTransferRequest_gvInventoryTransferRequest_header17_Add' },
        ],
        timeout: 5000,
      });
      addIcon = locator;
    } catch {
      addIcon = this.listFrame.getByRole('img', { name: /Click Here Or Press \[Insert\]/i }).first();
      await addIcon.waitFor({ state: 'visible', timeout: 5000 });
    }
    await addIcon.click();
    await this._resolveFormFrame();
  }

  /**
   * Opens the From Warehouse combo's dropdown and selects a row by its
   * Code — CONFIRMED live this is a popup list (Code/Name columns).
   * "AMPANG" confirmed the first option, same master data already
   * confirmed in every other Inventory module.
   */
  async selectFromWarehouse(warehouseCode) {
    const f = this.formFrame;
    const dropdownArrow = f.locator('#ctl00_MainContent_InventoryTransferRequestDetail1_cbpInventoryTransferRequestDetails_ASPxRoundPanel1_formInventoryTransferRequest_cbFromWarehouse_cbWarehouse_B-1Img');
    await dropdownArrow.click();
    await this.page.waitForTimeout(500);

    const option = f.getByRole('cell', { name: warehouseCode, exact: true }).first();
    await option.waitFor({ state: 'visible', timeout: 5000 });
    await option.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Opens the To Warehouse combo's dropdown and selects a row by its
   * Code — CONFIRMED live this list is NOT filtered against the already
   * -selected From Warehouse (both appear together), so "BERCHAM RAYA"
   * is selected here by name/role match, never by index, avoiding any
   * dependency on that (unconfirmed-to-persist) ordering.
   */
  async selectToWarehouse(warehouseCode) {
    const f = this.formFrame;
    const dropdownArrow = f.locator('#ctl00_MainContent_InventoryTransferRequestDetail1_cbpInventoryTransferRequestDetails_ASPxRoundPanel1_formInventoryTransferRequest_cbToWarehouse_cbWarehouse_B-1Img');
    await dropdownArrow.click();
    await this.page.waitForTimeout(500);

    const option = f.getByRole('cell', { name: warehouseCode, exact: true }).first();
    await option.waitFor({ state: 'visible', timeout: 5000 });
    await option.click();
    await this.page.waitForTimeout(500);
  }

  /** Fills the header's mandatory Reason field. */
  async fillReason(reason) {
    const field = this.formFrame.getByRole('textbox', { name: 'Reason:', exact: true });
    await field.click();
    await field.fill(reason);
  }

  /** Fills the header's optional Authorized By field — matches Jin's own recording. */
  async fillAuthorizedBy(authorizedBy) {
    const field = this.formFrame.getByRole('textbox', { name: 'Authorized By:', exact: true });
    await field.click();
    await field.fill(authorizedBy);
  }

  /** Fills the header's Reference No field — this screen's one reliable way to find a specific document again later, since Document No. stays "[DEFAULT]" until Posted. Keep to 20 characters or fewer (confirmed display truncation on this app-wide pattern). */
  async fillReferenceNo(referenceNo) {
    const field = this.formFrame.getByRole('textbox', { name: 'Reference No:', exact: true });
    await field.click();
    await field.fill(referenceNo);
  }

  /**
   * Adds one stock transfer line: click the Items grid's own search-icon
   * trigger, pick an item by name, confirm via the popup's own OK button.
   *
   * CONFIRMED live (2026-08-17): Qty auto-populates to 1 from the item's
   * master data on selection — no manual fill needed, same as every
   * other Inventory module.
   */
  async addItemLine(itemName) {
    const f = this.formFrame;
    const searchTrigger = f.locator('#ctl00_MainContent_InventoryTransferRequestDetail1_cbpInventoryTransferRequestDetails_cpnlITDetail_formITDetail_PC_0_ItemAdvanceSearchControlSIDetail_txtItemSearchUpdate_B0Img');
    await searchTrigger.click();
    await this.page.waitForTimeout(500);

    const itemOption = f.getByRole('cell', { name: itemName, exact: true }).first();
    await itemOption.waitFor({ state: 'visible', timeout: 5000 });
    await itemOption.click();
    await this.page.waitForTimeout(500);

    const okButton = f.locator('#ctl00_MainContent_InventoryTransferRequestDetail1_cbpInventoryTransferRequestDetails_cpnlITDetail_formITDetail_PC_0_ItemAdvanceSearchControlSIDetail_pcItemSearchControl_cpnlItemSearchControl_formItemSearchControl_btnItemSearchOk_CD');
    await okButton.click();
    await this.page.waitForTimeout(500);
  }

  /** CONFIRMED live (2026-08-17): no confirmation dialog appears for Save Draft on this screen. */
  async clickSaveDraft() {
    const saveButton = this.formFrame.getByRole('listitem', { name: 'Save Draft [Alt + S]' });
    await saveButton.click();
    await this.page.waitForTimeout(1000);
  }

  /** CONFIRMED live (2026-08-17): no confirmation dialog appears for Post either — opens a "Stock Transfer Request Summary Report" tab. */
  async clickPost() {
    const postButton = this.formFrame.getByRole('listitem', { name: 'Post [Alt + P]' });
    await postButton.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * CONFIRMED live (2026-08-17): posts the current document and leaves a
   * fresh blank New form behind, all in the SAME tab — like Stock
   * Issue/Stock Adjustment (not Stock Receive), this does NOT open a
   * report tab on this screen.
   */
  async clickPostAndNew() {
    const postAndNewButton = this.formFrame.getByRole('listitem', { name: 'Post & New [Alt + Ctrl + P]' });
    await postAndNewButton.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * CONFIRMED live (2026-08-17): Post (but not Post & New, on this
   * screen) opens a NEW in-app workspace tab ("Stock Transfer Request
   * Summary Report") that becomes the active/frontmost one, leaving the
   * "Stock Transfer Request" tab's own toolbar no longer interactable
   * until switched back to. Best-effort — a no-op if there's nothing to
   * switch (Save Draft and Post & New never open one here).
   */
  async _switchBackToStockTransferRequestTab() {
    await this.page.getByRole('link', { name: 'Stock Transfer Request', exact: true }).last()
      .click({ timeout: 3000 }).catch(() => {});
    await this.page.waitForTimeout(500);
  }

  /**
   * Re-resolves the form frame before looking for Back, same fix already
   * applied in arCreditNotePage.js/stockAdjustmentPage.js — Post & New
   * rebuilds the SAME tab's form in place, genuinely detaching any
   * previously-cached frame reference.
   */
  async clickBack() {
    await this._switchBackToStockTransferRequestTab();
    await this._resolveFormFrame().catch(() => {});
    const backButton = this.formFrame.getByRole('listitem', { name: 'Back [Alt + B]' });
    await backButton.click();
    await this.page.waitForTimeout(1000);
    await this._resolveListFrame();
  }

  /** New -> From Warehouse -> To Warehouse -> Reason -> Reference No -> one item line. Stops before any save action. */
  async createStockTransferRequest({ fromWarehouseCode = 'AMPANG', toWarehouseCode = 'BERCHAM RAYA', reason = 'Testing', referenceNo, itemName }) {
    await this.clickNew();
    await this.selectFromWarehouse(fromWarehouseCode);
    await this.selectToWarehouse(toWarehouseCode);
    await this.fillReason(reason);
    await this.fillReferenceNo(referenceNo);
    await this.addItemLine(itemName);
  }

  async getStatus() {
    const field = this.formFrame.getByRole('textbox', { name: 'Status:', exact: true });
    return (await field.inputValue().catch(() => null)) || (await field.textContent().catch(() => null));
  }

  /** Waits for a genuine GRID DATA ROW matching the given Reference No — same principle as every other module's equivalent. */
  async _waitForRowMatchingReference(referenceNo, timeout = 15000) {
    const escaped = referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dataRowPattern = new RegExp(`^InventoryTransferRequestDetail\\s+Delete\\b.*\\b${escaped}\\b`, 'i');
    const row = this.listFrame.getByRole('row', { name: dataRowPattern });
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if ((await row.count().catch(() => 0)) > 0 && (await row.first().isVisible().catch(() => false))) {
        return true;
      }
      await this.page.waitForTimeout(300);
    }
    return false;
  }

  /**
   * CONFIRMED live (2026-08-17) as this screen's real cleanup mechanism —
   * a genuine HARD DELETE (see class doc), for both DRAFT and POSTED
   * documents, same as Stock Adjustment. Click the row's own Delete
   * link, confirm the app-wide "Delete Confirmation" dialog via the SAME
   * `pcConfirmDel_btnYes_CD` control. Scoped to this.listFrame, never
   * page-wide.
   */
  async deleteDocument(referenceNo) {
    await this._resolveListFrame();
    const matched = await this._waitForRowMatchingReference(referenceNo);
    if (!matched) {
      await this.page.screenshot({
        path: `test-results/debug-stock-transfer-request-delete-not-found-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `Stock Transfer Request grid never showed a row matching Reference No. "${referenceNo}" — ` +
        'refusing to proceed with Delete against a possibly-stale/unfiltered row.'
      );
    }
    const row = this.listFrame.getByRole('row', {
      name: new RegExp(`^InventoryTransferRequestDetail\\s+Delete\\b.*\\b${referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
    }).first();
    await row.getByRole('link', { name: 'Delete', exact: true }).click();

    const { locator: yesButton } = await heal(this.listFrame, {
      id: 'stockTransferRequest.deleteConfirmYesButton',
      label: 'Yes',
      strategies: [
        { type: 'css', value: '#ctl00_pcConfirmDel_btnYes_CD' },
        { type: 'css', value: '[id*="pcConfirmDel" i][id*="btnYes_CD" i]' },
      ],
      timeout: 5000,
    });
    await yesButton.click();
    await yesButton.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    await this.page.waitForTimeout(1000);
  }

  /**
   * CONFIRMED live (2026-08-17): verify via the listing grid — the row
   * must disappear entirely (a real hard delete, not a status change).
   * See this file's SAFETY LESSON: a single immediately-following read
   * can show a stale "still there" render — this polls for up to
   * `timeout`, not a single-shot check, which tolerates that.
   */
  async isDeleteSuccessful(referenceNo, timeout = 10000) {
    const escaped = referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dataRowPattern = new RegExp(`^InventoryTransferRequestDetail\\s+Delete\\b.*\\b${escaped}\\b`, 'i');
    const row = this.listFrame.getByRole('row', { name: dataRowPattern });
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if ((await row.count().catch(() => 0)) === 0) return true;
      await this.page.waitForTimeout(300);
    }
    return false;
  }
}

module.exports = { StockTransferRequestPage };
