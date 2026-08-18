const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Inventory (transactional module) > Stock Transfer.
 *
 * SOURCE: built directly from Jin's own Playwright codegen recording
 * (2026-08-18) plus a full live exploration/confirmation of the same SIT
 * environment (uat/admin) — no Katalon Object Repository entry exists for
 * this screen yet.
 *
 * SHAPE: nearly identical to stockTransferRequestPage.js (same From/To
 * Warehouse combo pair, Reason/Reference No fields, item-search-icon popup
 * with auto-populated Qty) — CONFIRMED live rather than assumed by analogy:
 * every field id/behavior below was independently verified against this
 * screen's own DOM, not copied blind from its sibling.
 *
 * CONFIRMED LIVE (2026-08-18): AMPANG confirmed index 0, BERCHAM RAYA
 * index 1 in both From/To Warehouse combos (same master data as every
 * other Inventory module); the To Warehouse list is NOT filtered against
 * the already-selected From Warehouse.
 *
 * CONFIRMED LIVE (2026-08-18): Save Draft, Post, and Post & New all
 * complete with NO confirmation dialog. Post opens a NEW in-app workspace
 * tab named "Stock Transfer Detail Report" (note: "Detail", not "Summary"
 * like Stock Transfer Request's own report) — Post & New does NOT open a
 * report tab, same as Stock Transfer Request/Stock Issue/Stock Adjustment.
 *
 * CONFIRMED LIVE (2026-08-18): this screen has NO soft-cancel concept at
 * all — the row's own action link is genuinely labelled "Delete" (not
 * "Cancel"), using the same app-wide "Delete Confirmation" dialog /
 * `pcConfirmDel_btnYes_CD` control confirmed everywhere else in this app.
 * CONFIRMED this is a genuine HARD DELETE that works for BOTH DRAFT and
 * POSTED documents (verified by creating, Posting, then Deleting a real
 * POSTED test document and confirming via a fresh reload that the row was
 * completely gone) — unlike Close Stock Transfer Request's confirmed
 * DRAFT-delete bug, there is no such issue here. Also confirmed: opening
 * an already-POSTED document via its Document No. link (view mode) shows
 * a completely different toolbar (New, Preview Report, More Options — no
 * Back, no Cancel anywhere including inside More Options), so "Cancel" as
 * a scenario genuinely resolves to this row-level Delete, same as
 * stockTransferRequestPage.js.
 *
 * This module ALSO has its own "Copy From" toolbar button — see
 * stockTransferCopyFromPage.js (or equivalent) for that flow; this class
 * only covers the manual item-entry flow matching the original recording.
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable — always re-resolved via findFrame() by content, never
 * hardcoded.
 */
class StockTransferPage {
  constructor(page) {
    this.page = page;
    this.listFrame = null;
    this.formFrame = null;
  }

  /** Scoped to `#navBar` — same confirmed fix as stockTransferRequestPage.js's goto(): avoids ambiguity with an already-open "Stock Transfer" workspace tab. */
  async goto() {
    const p = this.page;
    await p.getByRole('link', { name: 'Inventory', exact: true }).click();
    await p.locator('#navBar').getByRole('link', { name: 'Stock Transfer', exact: true }).click();
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
      await p.screenshot({ path: 'test-results/debug-stock-transfer-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the frame containing the Stock Transfer list "New" icon. ' +
        'Saved test-results/debug-stock-transfer-list-page.png for inspection.'
      );
    }
  }

  /** CONFIRMED live (2026-08-18): "Reason:" genuinely has that accessible name on this screen's own form. */
  async _resolveFormFrame() {
    const p = this.page;
    this.formFrame = await findFrame(p, async (frame) => {
      const field = frame.getByRole('textbox', { name: 'Reason:', exact: true });
      return (await field.count().catch(() => 0)) > 0 && (await field.first().isVisible().catch(() => false));
    });
    if (!this.formFrame) {
      await p.screenshot({ path: 'test-results/debug-stock-transfer-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Stock Transfer create/edit form frame (Reason field). ' +
        'Saved test-results/debug-stock-transfer-form-not-found.png for inspection.'
      );
    }
  }

  /** CONFIRMED live (2026-08-18): the grid header's own "New"/Insert icon. */
  async clickNew() {
    const addIcon = this.listFrame.getByRole('img', { name: /Click Here Or Press \[Insert\]/i }).first();
    await addIcon.waitFor({ state: 'visible', timeout: 5000 });
    await addIcon.click();
    await this._resolveFormFrame();
  }

  /** Opens the From Warehouse combo's dropdown and selects a row by its Code. */
  async selectFromWarehouse(warehouseCode) {
    const f = this.formFrame;
    const dropdownArrow = f.locator('#ctl00_MainContent_InventoryTransferDetail1_cbpInventoryTransferDetails_ASPxRoundPanel1_formInventoryTransfer_cbFromWarehouse_cbWarehouse_B-1Img');
    await dropdownArrow.click();
    await this.page.waitForTimeout(500);

    const option = f.getByRole('row', { name: `${warehouseCode} ${warehouseCode}`, exact: true }).first();
    await option.waitFor({ state: 'visible', timeout: 5000 });
    await option.click();
    await this.page.waitForTimeout(500);
  }

  /** Opens the To Warehouse combo's dropdown and selects a row by its Code — CONFIRMED live (2026-08-18) NOT filtered against the already-selected From Warehouse. */
  async selectToWarehouse(warehouseCode) {
    const f = this.formFrame;
    const dropdownArrow = f.locator('#ctl00_MainContent_InventoryTransferDetail1_cbpInventoryTransferDetails_ASPxRoundPanel1_formInventoryTransfer_cbToWarehouse_cbWarehouse_B-1Img');
    await dropdownArrow.click();
    await this.page.waitForTimeout(500);

    const option = f.getByRole('row', { name: `${warehouseCode} ${warehouseCode}`, exact: true }).first();
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

  /** Fills the header's Reference No field — the reliable way to find this specific document again, since Document No. stays "[DEFAULT]" until Posted. Keep to 20 characters or fewer (confirmed display truncation). */
  async fillReferenceNo(referenceNo) {
    const field = this.formFrame.getByRole('textbox', { name: 'Reference No:', exact: true });
    await field.click();
    await field.fill(referenceNo);
  }

  /**
   * Adds one stock transfer line: click the Items grid's own search-icon
   * trigger, pick an item by name (single click — a double-click here was
   * confirmed to be a recorder artifact, dropped), confirm via the
   * popup's own OK button.
   *
   * CONFIRMED live (2026-08-18): Qty auto-populates to 1 from the item's
   * master data on selection — no manual fill needed, same as every other
   * Inventory module.
   */
  async addItemLine(itemName) {
    const f = this.formFrame;
    const searchTrigger = f.locator('#ctl00_MainContent_InventoryTransferDetail1_cbpInventoryTransferDetails_cpnlITDetail_formITDetail_PC_0_ItemAdvanceSearchControlSIDetail_txtItemSearchUpdate_B0');
    await searchTrigger.click();
    await this.page.waitForTimeout(500);

    const itemOption = f.getByRole('cell', { name: itemName, exact: true }).first();
    await itemOption.waitFor({ state: 'visible', timeout: 5000 });
    await itemOption.click();
    await this.page.waitForTimeout(500);

    const okButton = f.locator('#ctl00_MainContent_InventoryTransferDetail1_cbpInventoryTransferDetails_cpnlITDetail_formITDetail_PC_0_ItemAdvanceSearchControlSIDetail_pcItemSearchControl_cpnlItemSearchControl_formItemSearchControl_btnItemSearchOk_CD');
    await okButton.click();
    await this.page.waitForTimeout(500);
  }

  /** New -> From Warehouse -> To Warehouse -> Reason -> Reference No -> one item line. Stops before any save action. */
  async createStockTransfer({ fromWarehouseCode = 'AMPANG', toWarehouseCode = 'BERCHAM RAYA', reason = 'Testing', referenceNo, itemName }) {
    await this.clickNew();
    await this.selectFromWarehouse(fromWarehouseCode);
    await this.selectToWarehouse(toWarehouseCode);
    await this.fillReason(reason);
    await this.fillReferenceNo(referenceNo);
    await this.addItemLine(itemName);
  }

  /**
   * Clicks the "Copy From" toolbar button and picks a source Stock
   * Transfer Request by matching its own Reference No text in the
   * "TransferFrom" picker grid (never by blind row index, even though the
   * newest document is always row 0 — see class doc). Confirms via the
   * picker's own "OK" button.
   *
   * CONFIRMED live (2026-08-18): this screen's Copy From sources from
   * Stock Transfer Request (same "TransferFrom" picker component/ids as
   * Close Stock Transfer Request's own Copy From — shared across this
   * app). Must be called AFTER From Warehouse, To Warehouse, and Reason
   * are already filled, or the click is rejected with a validation toast
   * and no picker opens. Goes DIRECTLY to the picker grid — no
   * intermediate document-type selector, same as Close Stock Transfer
   * Request.
   *
   * CONFIRMED live (2026-08-18): a source Stock Transfer Request remains
   * available in the picker after being copied into a DRAFT Stock
   * Transfer (copying into a draft does not consume it) — it is only
   * consumed once the Stock Transfer that copied it is itself POSTED.
   */
  async copyFromSource(sourceReferenceNo) {
    const f = this.formFrame;
    const copyFromButton = f.getByRole('listitem', { name: 'Copy From [Alt + M]' });
    await copyFromButton.click();
    await this.page.waitForTimeout(800);

    // CONFIRMED live (2026-08-18, see closeStockTransferRequestPage.js):
    // matching by rendered TEXT CONTENT on the grid's own data rows
    // (scoped by their confirmed "gvTransferFrom_DXDataRow" id fragment)
    // is what this picker's structure reliably supports — an accessible-
    // name role match was confirmed unreliable here (over-matched).
    const pickerRows = f.locator('tr[id*="gvTransferFrom_DXDataRow"]').filter({ hasText: sourceReferenceNo });
    await pickerRows.first().waitFor({ state: 'visible', timeout: 10000 });
    const matchCount = await pickerRows.count();
    if (matchCount !== 1) {
      await this.page.screenshot({
        path: `test-results/debug-stock-transfer-copyfrom-ambiguous-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `Expected exactly one TransferFrom picker row matching "${sourceReferenceNo}", found ${matchCount} — ` +
        'refusing to guess which one to select.'
      );
    }
    const sourceRow = pickerRows.first();
    await sourceRow.getByRole('cell', { name: 'U', exact: true }).click();
    await this.page.waitForTimeout(300);

    const { locator: okButton } = await heal(f, {
      id: 'stockTransfer.transferFromOkButton',
      label: 'TransferFrom OK',
      strategies: [
        { type: 'css', value: '[id*="formTransferFrom_btnPurchaseTransferOk_CD" i]' },
      ],
      timeout: 5000,
    });
    await okButton.click();
    await this.page.waitForTimeout(800);
  }

  /** New -> From Warehouse -> To Warehouse -> Reason -> Reference No -> Copy From a source Stock Transfer Request. Stops before any save action. */
  async createStockTransferViaCopyFrom({ fromWarehouseCode = 'AMPANG', toWarehouseCode = 'BERCHAM RAYA', reason = 'Testing', referenceNo, sourceReferenceNo }) {
    await this.clickNew();
    await this.selectFromWarehouse(fromWarehouseCode);
    await this.selectToWarehouse(toWarehouseCode);
    await this.fillReason(reason);
    await this.fillReferenceNo(referenceNo);
    await this.copyFromSource(sourceReferenceNo);
  }

  /** CONFIRMED live (2026-08-18): no confirmation dialog appears for Save Draft on this screen. */
  async clickSaveDraft() {
    const saveButton = this.formFrame.getByRole('listitem', { name: 'Save Draft [Alt + S]' });
    await saveButton.click();
    await this.page.waitForTimeout(1000);
  }

  /** CONFIRMED live (2026-08-18): no confirmation dialog appears for Post either — opens a "Stock Transfer Detail Report" tab. */
  async clickPost() {
    const postButton = this.formFrame.getByRole('listitem', { name: 'Post [Alt + P]' });
    await postButton.click();
    await this.page.waitForTimeout(1000);
  }

  /** CONFIRMED live (2026-08-18): posts the current document and leaves a fresh blank New form behind, all in the SAME tab — does NOT open a report tab on this screen. */
  async clickPostAndNew() {
    const postAndNewButton = this.formFrame.getByRole('listitem', { name: 'Post & New [Alt + Ctrl + P]' });
    await postAndNewButton.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * CONFIRMED live (2026-08-18): Post (but not Post & New, on this screen)
   * opens a NEW in-app workspace tab ("Stock Transfer Detail Report") that
   * becomes frontmost, leaving the "Stock Transfer" tab's own toolbar
   * uninteractable until switched back to. Best-effort — a no-op if
   * there's nothing to switch.
   */
  async _switchBackToStockTransferTab() {
    await this.page.getByRole('link', { name: 'Stock Transfer', exact: true }).last()
      .click({ timeout: 3000 }).catch(() => {});
    await this.page.waitForTimeout(500);
  }

  /**
   * Re-resolves the form frame before looking for Back — Post & New
   * rebuilds the SAME tab's form in place, genuinely detaching any
   * previously-cached frame reference (same fix as
   * stockTransferRequestPage.js/stockAdjustmentPage.js/arCreditNotePage.js).
   */
  async clickBack() {
    await this._switchBackToStockTransferTab();
    await this._resolveFormFrame().catch(() => {});
    const backButton = this.formFrame.getByRole('listitem', { name: 'Back [Alt + B]' });
    await backButton.click();
    await this.page.waitForTimeout(1000);
    await this._resolveListFrame();
  }

  async getStatus() {
    const field = this.formFrame.getByRole('textbox', { name: 'Status:', exact: true });
    return (await field.inputValue().catch(() => null)) || (await field.textContent().catch(() => null));
  }

  /** Reads the header's Document No. field — stays "[DEFAULT]" until Posted, then becomes the real "ST-XXXXXXXX" number (needed by stockTransferReceiptPage.js to find this document's own pending receipt row). */
  async getDocumentNo() {
    const field = this.formFrame.getByRole('textbox', { name: 'Document No.:', exact: true });
    return (await field.inputValue().catch(() => null)) || (await field.textContent().catch(() => null));
  }

  /**
   * Switches back from the report tab that clickPost() opens and reads
   * the real Document No. it assigned — a convenience wrapper so callers
   * (e.g. stock-transfer-receipt.spec.js, which needs this exact
   * "ST-XXXXXXXX" text to find the document's own pending receipt row
   * elsewhere) don't need to reach into this class's private tab-
   * switching internals directly.
   */
  async getDocumentNoAfterPost() {
    await this._switchBackToStockTransferTab();
    await this._resolveFormFrame();
    return this.getDocumentNo();
  }

  /** Waits for a genuine GRID DATA ROW matching the given Reference No — same principle as every other module's equivalent. */
  async _waitForRowMatchingReference(referenceNo, timeout = 15000) {
    const escaped = referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dataRowPattern = new RegExp(`^InventoryTransferDetail\\s+Delete\\b.*\\b${escaped}\\b`, 'i');
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
   * CONFIRMED live (2026-08-18) as this screen's real cleanup mechanism —
   * a genuine HARD DELETE (see class doc), for both DRAFT and POSTED
   * documents. Click the row's own Delete link, confirm the app-wide
   * "Delete Confirmation" dialog via the SAME `pcConfirmDel_btnYes_CD`
   * control. Scoped to this.listFrame, never page-wide.
   */
  async deleteDocument(referenceNo) {
    await this._resolveListFrame();
    const matched = await this._waitForRowMatchingReference(referenceNo);
    if (!matched) {
      await this.page.screenshot({
        path: `test-results/debug-stock-transfer-delete-not-found-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `Stock Transfer grid never showed a row matching Reference No. "${referenceNo}" — ` +
        'refusing to proceed with Delete against a possibly-stale/unfiltered row.'
      );
    }
    const row = this.listFrame.getByRole('row', {
      name: new RegExp(`^InventoryTransferDetail\\s+Delete\\b.*\\b${referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
    }).first();
    await row.getByRole('link', { name: 'Delete', exact: true }).click();

    const { locator: yesButton } = await heal(this.listFrame, {
      id: 'stockTransfer.deleteConfirmYesButton',
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
   * CONFIRMED live (2026-08-18): verify via the listing grid — the row
   * must disappear entirely (a real hard delete, not a status change).
   * Polls for up to `timeout` to tolerate the stale-render trap already
   * documented elsewhere in this repo.
   */
  async isDeleteSuccessful(referenceNo, timeout = 10000) {
    const escaped = referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dataRowPattern = new RegExp(`^InventoryTransferDetail\\s+Delete\\b.*\\b${escaped}\\b`, 'i');
    const row = this.listFrame.getByRole('row', { name: dataRowPattern });
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if ((await row.count().catch(() => 0)) === 0) return true;
      await this.page.waitForTimeout(300);
    }
    return false;
  }
}

module.exports = { StockTransferPage };
