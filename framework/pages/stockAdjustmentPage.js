const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Inventory (transactional module) > Stock Adjustment.
 *
 * SOURCE: built directly from Jin's own Playwright codegen recording
 * (2026-08-17) plus a full live exploration/confirmation of the same SIT
 * environment (uat/admin) — no Katalon Object Repository entry exists for
 * this screen yet. Every selector below was exercised live end-to-end
 * (Save Draft, Post, and Post & New, each followed by Delete + a fresh
 * grid check to confirm gone) against a real Item ("SAFETY PIN", code
 * 01234) and Warehouse ("AMPANG") — both cleaned up before this page
 * object was written, zero residual test data left behind.
 *
 * SHAPE: similar to stockReceivePage.js/stockIssuePage.js (same Warehouse
 * combo, same item-search-icon popup with auto-populated Qty), but with
 * three genuine differences confirmed live:
 *
 * 1. An additional mandatory "Reason:*" combo (Code/Name popup list) —
 *    CONFIRMED live options include OPENING/ADJUST/MINUMAN PAPAN BUKA
 *    UNTUK JUAL LOOSE/STOK ROSAK-EXPIRED/BARCODE ADA 2, BACKUP — "ADJUST"
 *    (the second option) matches Jin's own recording and reads as a
 *    reasonable generic reason for a test adjustment; selected by
 *    role/name match, not index, so a reordered list doesn't silently
 *    pick the wrong one.
 *
 * 2. Description is NOT mandatory on this screen (no red asterisk,
 *    confirmed live) — filled here anyway for consistency, but Jin's own
 *    recording never touched it either.
 *
 * 3. The Items grid has a QtyOnHand/AdjQty/NewBalance shape instead of a
 *    plain Qty — CONFIRMED live AdjQty auto-populates to 1 on item
 *    selection (NewBalance = QtyOnHand + 1), no manual fill needed, same
 *    convenience as Stock Receive/Issue's Qty auto-fill. An "Adjustment
 *    IN/OUT" vs "Actual Qty" radio also exists (IN/OUT selected by
 *    default) — left untouched, matching the recording.
 *
 * CONFIRMED LIVE (2026-08-17): like Stock Receive/Issue, Save Draft,
 * Post, and Post & New all complete with NO confirmation dialog
 * whatsoever.
 *
 * CONFIRMED LIVE (2026-08-17): Post opens a NEW in-app workspace tab
 * ("Stock Adjustment Detail Report"). Post & New does NOT open a report
 * tab on this screen — same as Stock Issue, the opposite of Stock
 * Receive — it just posts and leaves a fresh blank form in the SAME tab.
 *
 * CRITICAL DIFFERENCE CONFIRMED LIVE (2026-08-17): unlike every other
 * transactional module in this app, this screen has NO soft-cancel
 * concept at all. The row's action link is genuinely labelled "Delete"
 * (not "Cancel" wearing a trash-can icon), and clicking it shows the
 * app-wide "Delete Confirmation" / "Are you sure you want to delete this
 * row?" dialog via the SAME `pcConfirmDel_btnYes_CD` control already
 * confirmed in itemPage.js — CONFIRMED this is a genuine HARD DELETE,
 * for BOTH DRAFT and POSTED documents (verified by creating, Posting,
 * then Deleting a real POSTED test document and confirming via a fresh
 * reload that the row was completely gone, not just marked Cancelled).
 * Method names below reflect this (`deleteDocument`/
 * `isDeleteSuccessful`), not `cancelDocument`, to avoid describing a
 * soft-cancel that doesn't exist on this screen.
 *
 * SAFETY LESSON (2026-08-17, confirmed live during manual exploration): a
 * single screenshot/snapshot taken immediately after confirming Delete
 * can show a stale render (the row still appearing) even though the
 * delete genuinely succeeded — same trap already documented in
 * stockIssuePage.js. `isDeleteSuccessful()`'s poll-based check (retrying
 * for up to 10s) already tolerates this; never trust a single
 * immediately-following screenshot or snapshot on this screen.
 *
 * CONFIRMED LIVE (2026-08-17): opening an ALREADY-SAVED document via its
 * Document No. link in the list (edit mode) shows NO "Back" toolbar
 * button at all, same pattern already confirmed on Stock Receive/Issue.
 * Does not affect this page object, since every method here reaches the
 * form exclusively via clickNew() (which DOES show Back).
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable — always re-resolved via findFrame() by content, never
 * hardcoded.
 */
class StockAdjustmentPage {
  constructor(page) {
    this.page = page;
    this.listFrame = null;
    this.formFrame = null;
  }

  async goto() {
    const p = this.page;
    await p.getByRole('link', { name: 'Inventory', exact: true }).click();
    await p.getByRole('link', { name: 'Stock Adjustment', exact: true }).click();
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
      await p.screenshot({ path: 'test-results/debug-stock-adjustment-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the frame containing the Stock Adjustment list "New" icon. ' +
        'Saved test-results/debug-stock-adjustment-list-page.png for inspection.'
      );
    }
  }

  /**
   * BUG FIXED (2026-08-17, live test run): the "Reason:" label is NOT
   * actually attached as this field's accessible name — same
   * unassociated-label DevExpress trap already documented in
   * apPaymentPage.js/arInvoicePage.js for their Vendor/Customer fields
   * (my own exploration snapshot showed this textbox with no name at
   * all, I just didn't cross-check it when first writing this method).
   * Checks the Reason dropdown's confirmed CSS id directly instead.
   */
  async _resolveFormFrame() {
    const p = this.page;
    this.formFrame = await findFrame(p, async (frame) => {
      const field = frame.locator('#ctl00_MainContent_InventoryAdjustmentDetail1_cbpInventoryAdjustmentDetails_ASPxRoundPanel1_formInventoryAdjustment_cbSelectInventoryReason_cbInventoryReason_B-1Img');
      return (await field.count().catch(() => 0)) > 0 && (await field.first().isVisible().catch(() => false));
    });
    if (!this.formFrame) {
      await p.screenshot({ path: 'test-results/debug-stock-adjustment-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Stock Adjustment create/edit form frame (Reason dropdown trigger). ' +
        'Saved test-results/debug-stock-adjustment-form-not-found.png for inspection.'
      );
    }
  }

  /** CONFIRMED live (2026-08-17): the grid header's own "New"/Insert icon; role match as fallback. */
  async clickNew() {
    let addIcon;
    try {
      const { locator } = await heal(this.listFrame, {
        id: 'stockAdjustment.newIcon',
        label: 'New',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_InventoryAdjustment_cpnlInventoryAdjustment_formInventoryAdjustment_gvInventoryAdjustment_header17_Add' },
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
   * Opens the Warehouse combo's dropdown and selects a row by its Code —
   * CONFIRMED live this is a popup list (Code/Name columns). "AMPANG"
   * confirmed the first option, same master data already confirmed in
   * Stock Receive/Issue.
   */
  async selectWarehouse(warehouseCode) {
    const f = this.formFrame;
    const dropdownArrow = f.locator('#ctl00_MainContent_InventoryAdjustmentDetail1_cbpInventoryAdjustmentDetails_ASPxRoundPanel1_formInventoryAdjustment_cbWarehouse_cbWarehouse_B-1Img');
    await dropdownArrow.click();
    await this.page.waitForTimeout(500);

    const option = f.getByRole('cell', { name: warehouseCode, exact: true }).first();
    await option.waitFor({ state: 'visible', timeout: 5000 });
    await option.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Opens the Reason combo's dropdown and selects a row by its Code —
   * CONFIRMED live this is a popup list (Code/Name columns), mandatory
   * on this screen. "ADJUST" confirmed a valid option, matching Jin's
   * own recording.
   */
  async selectReason(reasonCode) {
    const f = this.formFrame;
    const dropdownArrow = f.locator('#ctl00_MainContent_InventoryAdjustmentDetail1_cbpInventoryAdjustmentDetails_ASPxRoundPanel1_formInventoryAdjustment_cbSelectInventoryReason_cbInventoryReason_B-1Img');
    await dropdownArrow.click();
    await this.page.waitForTimeout(500);

    const option = f.getByRole('cell', { name: reasonCode, exact: true }).first();
    await option.waitFor({ state: 'visible', timeout: 5000 });
    await option.click();
    await this.page.waitForTimeout(500);
  }

  /** Fills the header's Reference No field — this screen's one reliable way to find a specific document again later, since Document No. stays "[DEFAULT]" until Posted. Keep to 20 characters or fewer (confirmed display truncation on this app-wide pattern). */
  async fillReferenceNo(referenceNo) {
    const field = this.formFrame.getByRole('textbox', { name: 'Reference No:', exact: true });
    await field.click();
    await field.fill(referenceNo);
  }

  /**
   * Adds one stock adjustment line: click the Items grid's own
   * search-icon trigger, pick an item by name, confirm via the popup's
   * own OK button.
   *
   * CONFIRMED live (2026-08-17): AdjQty auto-populates to 1 from the
   * item's master data on selection (NewBalance = QtyOnHand + 1) — no
   * manual fill needed, same as Stock Receive/Issue's Qty.
   */
  async addItemLine(itemName) {
    const f = this.formFrame;
    const searchTrigger = f.locator('#ctl00_MainContent_InventoryAdjustmentDetail1_cbpInventoryAdjustmentDetails_cpnlIADetail_formIADetail_PC_0_ItemAdvanceSearchControlIADetail_txtItemSearchUpdate_B0Img');
    await searchTrigger.click();
    await this.page.waitForTimeout(500);

    const itemOption = f.getByRole('cell', { name: itemName, exact: true }).first();
    await itemOption.waitFor({ state: 'visible', timeout: 5000 });
    await itemOption.click();
    await this.page.waitForTimeout(500);

    const okButton = f.locator('#ctl00_MainContent_InventoryAdjustmentDetail1_cbpInventoryAdjustmentDetails_cpnlIADetail_formIADetail_PC_0_ItemAdvanceSearchControlIADetail_pcItemSearchControl_cpnlItemSearchControl_formItemSearchControl_btnItemSearchOk_CD');
    await okButton.click();
    await this.page.waitForTimeout(500);
  }

  /** CONFIRMED live (2026-08-17): no confirmation dialog appears for Save Draft on this screen. */
  async clickSaveDraft() {
    const saveButton = this.formFrame.getByRole('listitem', { name: 'Save Draft [Alt + S]' });
    await saveButton.click();
    await this.page.waitForTimeout(1000);
  }

  /** CONFIRMED live (2026-08-17): no confirmation dialog appears for Post either — opens a "Stock Adjustment Detail Report" tab. */
  async clickPost() {
    const postButton = this.formFrame.getByRole('listitem', { name: 'Post [Alt + P]' });
    await postButton.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * CONFIRMED live (2026-08-17): posts the current document and leaves a
   * fresh blank New form behind, all in the SAME tab — like Stock Issue
   * (not Stock Receive), this does NOT open a report tab on this screen.
   */
  async clickPostAndNew() {
    const postAndNewButton = this.formFrame.getByRole('listitem', { name: 'Post & New [Alt + Ctrl + P]' });
    await postAndNewButton.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * CONFIRMED live (2026-08-17): Post (but not Post & New, on this
   * screen) opens a NEW in-app workspace tab ("Stock Adjustment Detail
   * Report") that becomes the active/frontmost one, leaving the "Stock
   * Adjustment" tab's own toolbar no longer interactable until switched
   * back to. Best-effort — a no-op if there's nothing to switch (Save
   * Draft and Post & New never open one here).
   */
  async _switchBackToStockAdjustmentTab() {
    await this.page.getByRole('link', { name: 'Stock Adjustment', exact: true }).last()
      .click({ timeout: 3000 }).catch(() => {});
    await this.page.waitForTimeout(500);
  }

  /**
   * BUG FIXED (2026-08-17, live test run): calling Back with the
   * `formFrame` reference cached back when the New form first opened
   * threw "Frame was detached" specifically after Post & New — unlike
   * Post (which opens a separate report tab, leaving the original form's
   * iframe untouched), Post & New rebuilds the SAME tab's form in place
   * (posting the current document and replacing it with a fresh blank
   * one), genuinely detaching the previously-cached frame. Re-resolving
   * the form frame fresh, right before looking for Back, removes the
   * dependency on that cached reference ever still being valid — same
   * fix already applied in arCreditNotePage.js for an analogous issue.
   */
  async clickBack() {
    await this._switchBackToStockAdjustmentTab();
    await this._resolveFormFrame().catch(() => {});
    const backButton = this.formFrame.getByRole('listitem', { name: 'Back [Alt + B]' });
    await backButton.click();
    await this.page.waitForTimeout(1000);
    await this._resolveListFrame();
  }

  /** New -> Warehouse -> Reason -> Reference No -> one item line. Stops before any save action. */
  async createStockAdjustment({ warehouseCode = 'AMPANG', reasonCode = 'ADJUST', referenceNo, itemName }) {
    await this.clickNew();
    await this.selectWarehouse(warehouseCode);
    await this.selectReason(reasonCode);
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
    const dataRowPattern = new RegExp(`^InventoryAdjustmentDetail\\s+Delete\\b.*\\b${escaped}\\b`, 'i');
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
   * a genuine HARD DELETE (see class doc's CRITICAL DIFFERENCE), for
   * both DRAFT and POSTED documents. Click the row's own Delete link,
   * confirm the app-wide "Delete Confirmation" dialog via the SAME
   * `pcConfirmDel_btnYes_CD` control already confirmed in itemPage.js.
   * Scoped to this.listFrame, never page-wide.
   */
  async deleteDocument(referenceNo) {
    await this._resolveListFrame();
    const matched = await this._waitForRowMatchingReference(referenceNo);
    if (!matched) {
      await this.page.screenshot({
        path: `test-results/debug-stock-adjustment-delete-not-found-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `Stock Adjustment grid never showed a row matching Reference No. "${referenceNo}" — ` +
        'refusing to proceed with Delete against a possibly-stale/unfiltered row.'
      );
    }
    const row = this.listFrame.getByRole('row', {
      name: new RegExp(`^InventoryAdjustmentDetail\\s+Delete\\b.*\\b${referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
    }).first();
    await row.getByRole('link', { name: 'Delete', exact: true }).click();

    const { locator: yesButton } = await heal(this.listFrame, {
      id: 'stockAdjustment.deleteConfirmYesButton',
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
    const dataRowPattern = new RegExp(`^InventoryAdjustmentDetail\\s+Delete\\b.*\\b${escaped}\\b`, 'i');
    const row = this.listFrame.getByRole('row', { name: dataRowPattern });
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if ((await row.count().catch(() => 0)) === 0) return true;
      await this.page.waitForTimeout(300);
    }
    return false;
  }
}

module.exports = { StockAdjustmentPage };
