const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Inventory (transactional module) > Stock Take.
 *
 * SOURCE: built directly from Jin's own Playwright codegen recording
 * (2026-08-18) plus a full live exploration/confirmation of the same SIT
 * environment (uat/admin) — no Katalon Object Repository entry exists for
 * this screen yet.
 *
 * SHAPE: genuinely different from every other Inventory module built this
 * session:
 * - A single "Warehouse:*" field (not a From/To pair).
 * - "Description:" instead of "Reason:" as the mandatory free-text field.
 * - NO "Copy From" toolbar button — this screen only supports adding items
 *   via its own "Add Item" flow (an "Item Filter" popup), never copying
 *   from another document.
 * - Item lines are added via an "Item Filter" popup (opened by the
 *   Items grid's own "Add Item" button), not the item-search-icon-then-
 *   pick-cell pattern used elsewhere in this app. CONFIRMED live
 *   (2026-08-18) the exact sequence: (1) the popup's "Bin Location" row
 *   already defaults to "Filter By Selection" mode with its own
 *   "Selection" combo ready to use — select a bin location there; (2) the
 *   "Item" row defaults to "ALL" mode and must be explicitly switched to
 *   "Filter By Selection" first (via its own mode-selector combo) before
 *   ITS "Selection" combo appears — select an item there; (3) click the
 *   popup's own "OK" button (internal control name
 *   `btnSaveItemFilter_CD`, though its visible label is "OK", not "Save")
 *   to add the resulting line(s) to the Items grid.
 * - CONFIRMED live (2026-08-18): "Physical Qty" is NOT required to Save
 *   Draft, but IS mandatory to Post — attempting to Post with it blank
 *   shows a genuine validation alert ("Physical Qty is a mandatory field.
 *   Please fill in the Physical Qty for item <code> at row <n> before
 *   posting."), confirmed via its own `pcAlertMessageBox_btnOK_CD`
 *   dialog. The cell has no stable/predictable input id (DevExpress
 *   assigns it a dynamically-numbered `DXEditorN` id that shifts with
 *   grid state) — `fillPhysicalQty()` below instead clicks the cell by
 *   its stable CSS position within the (confirmed single, per this
 *   session's own recording/testing) item row to activate its inline
 *   editor, then types directly into whatever now has focus, matching
 *   this repo's convention of never hardcoding a per-row/per-cell
 *   DevExpress-generated id.
 *
 * CONFIRMED LIVE (2026-08-18): Save Draft and Post & New complete with NO
 * confirmation dialog. Post also has none, but opens a NEW in-app
 * workspace tab ("Stock Take Summary with Different Qty Only Report").
 * Post & New does NOT open a report tab, leaving a fresh blank form in
 * the SAME tab instead — same pattern as Stock Transfer Request/Stock
 * Issue/Stock Adjustment.
 *
 * CONFIRMED LIVE (2026-08-18): unlike Stock Transfer/Stock Transfer
 * Request/Close Stock Transfer Request (all hard-Delete-only), this
 * screen genuinely has a soft "Cancel" action — the SAME app-wide "Cancel
 * Confirmation" dialog / `pcConfirmCancel_btnYesCancel_CD` control
 * already confirmed on A/R Invoice, Stock Receive, and Stock Issue.
 * CONFIRMED this dialog is NOT reliably visible in a plain accessibility
 * snapshot immediately after clicking Cancel (same known trap as A/R
 * Debit Note's stacked "Cancel Reason" dialog) — a screenshot is what
 * actually revealed it live; `cancelDocument()` below waits on the
 * dialog's own confirmed control rather than assuming a snapshot will
 * show it. CONFIRMED working for BOTH DRAFT and POSTED documents
 * (verified by creating, Posting, then Cancelling a real POSTED test
 * document and confirming via a fresh reload that the row was gone from
 * the default DRAFT+POSTED filtered view).
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable — always re-resolved via findFrame() by content, never
 * hardcoded.
 */
class StockTakePage {
  constructor(page) {
    this.page = page;
    this.listFrame = null;
    this.formFrame = null;
  }

  /** Scoped to `#navBar` — same confirmed fix as stockTransferPage.js's goto(): avoids ambiguity with an already-open "Stock Take" workspace tab. */
  async goto() {
    const p = this.page;
    await p.getByRole('link', { name: 'Inventory', exact: true }).click();
    await p.locator('#navBar').getByRole('link', { name: 'Stock Take', exact: true }).click();
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
      await p.screenshot({ path: 'test-results/debug-stock-take-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the frame containing the Stock Take list "New" icon. ' +
        'Saved test-results/debug-stock-take-list-page.png for inspection.'
      );
    }
  }

  /** CONFIRMED live (2026-08-18): "Description:" genuinely has that accessible name on this screen's own form. */
  async _resolveFormFrame() {
    const p = this.page;
    this.formFrame = await findFrame(p, async (frame) => {
      const field = frame.getByRole('textbox', { name: 'Description:', exact: true });
      return (await field.count().catch(() => 0)) > 0 && (await field.first().isVisible().catch(() => false));
    });
    if (!this.formFrame) {
      await p.screenshot({ path: 'test-results/debug-stock-take-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Stock Take create/edit form frame (Description field). ' +
        'Saved test-results/debug-stock-take-form-not-found.png for inspection.'
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

  /** Opens the single Warehouse combo's dropdown and selects a row by its Code. */
  async selectWarehouse(warehouseCode) {
    const f = this.formFrame;
    const dropdownArrow = f.locator('#ctl00_MainContent_StockTakeDetail_cbpStockTakeDetails_ASPxRoundPanel1_formStockTake_cbWarehouse_cbWarehouse_B-1Img');
    await dropdownArrow.click();
    await this.page.waitForTimeout(500);

    const option = f.getByRole('row', { name: `${warehouseCode} ${warehouseCode}`, exact: true }).first();
    await option.waitFor({ state: 'visible', timeout: 5000 });
    await option.click();
    await this.page.waitForTimeout(500);
  }

  /** Fills the header's mandatory Description field. */
  async fillDescription(description) {
    const field = this.formFrame.getByRole('textbox', { name: 'Description:', exact: true });
    await field.click();
    await field.fill(description);
  }

  /** Fills the header's Reference No field — the reliable way to find this specific document again, since Document No. stays "[DEFAULT]" until Posted. Keep to 20 characters or fewer (confirmed display truncation). */
  async fillReferenceNo(referenceNo) {
    const field = this.formFrame.getByRole('textbox', { name: 'Reference No:', exact: true });
    await field.click();
    await field.fill(referenceNo);
  }

  /**
   * Adds one Stock Take line for a single item at a single bin location,
   * via the Items grid's "Add Item" button and the resulting "Item
   * Filter" popup — see class doc for the confirmed exact sequence
   * (Bin Location's Selection combo is ready immediately; Item's requires
   * switching its mode to "Filter By Selection" first).
   */
  async addItemLine({ binLocationCode, itemName }) {
    const f = this.formFrame;

    const addItemButton = f.getByText('Add Item Add Item');
    await addItemButton.click();
    await this.page.waitForTimeout(800);

    // Bin Location: already in "Filter By Selection" mode — its own
    // Selection combo is immediately available.
    const binLocationCombo = f.locator('#ctl00_MainContent_StockTakeDetail_pcItemFilter_formItemFilter_cbBinLocation_glBinLocation_B-1Img');
    await binLocationCombo.click();
    await this.page.waitForTimeout(500);
    const binLocationRow = f.getByRole('row', { name: new RegExp(`^U\\s+${binLocationCode}\\b`) }).first();
    await binLocationRow.waitFor({ state: 'visible', timeout: 5000 });
    await binLocationRow.getByRole('cell', { name: 'U', exact: true }).click();
    await this.page.waitForTimeout(300);

    // Item: defaults to "ALL" — must switch mode to "Filter By Selection"
    // first, which reveals Item's own Selection combo.
    const itemModeSelector = f.locator('#ctl00_MainContent_StockTakeDetail_pcItemFilter_formItemFilter_cbItem_cbItem_Filter_B-1Img');
    await itemModeSelector.click();
    await this.page.waitForTimeout(500);
    const filterBySelectionOption = f.getByText('Filter By Selection', { exact: true }).first();
    await filterBySelectionOption.click();
    await this.page.waitForTimeout(500);

    const itemSelectionCombo = f.locator('#ctl00_MainContent_StockTakeDetail_pcItemFilter_formItemFilter_cbItem_glItem_B-1Img');
    await itemSelectionCombo.click();
    await this.page.waitForTimeout(500);
    const itemRow = f.getByRole('row', { name: new RegExp(`^U\\s+\\S+\\s+${itemName}$`) }).first();
    await itemRow.waitFor({ state: 'visible', timeout: 5000 });
    await itemRow.getByRole('cell', { name: 'U', exact: true }).click();
    await this.page.waitForTimeout(300);

    const { locator: okButton } = await heal(f, {
      id: 'stockTake.itemFilterOkButton',
      label: 'Item Filter OK',
      strategies: [
        { type: 'css', value: '[id*="formItemFilter_btnSaveItemFilter_CD" i]' },
      ],
      timeout: 5000,
    });
    await okButton.click();
    await this.page.waitForTimeout(800);
  }

  /**
   * Fills the Physical Qty of the FIRST (and, per this class's own
   * confirmed/intended usage, only) item row — CONFIRMED live (2026-08-18)
   * mandatory before Post, optional for Save Draft. Clicks the cell by
   * its stable CSS column position (9th column: #, checkbox, Item Code,
   * Description, Bin Location, UOM, On Hand Qty, Physical Qty) to reveal
   * its inline editor, then types directly into whatever now has focus —
   * the editor's own id is a dynamically-numbered DevExpress `DXEditorN`
   * that is NOT stable across grid states, per this repo's rule against
   * hardcoding such ids.
   */
  async fillPhysicalQty(quantity) {
    const f = this.formFrame;
    const row = f.locator('[id*="gvItem_DXDataRow0"]').first();
    await row.locator('td:nth-child(9)').click();
    await this.page.waitForTimeout(300);
    await this.page.keyboard.type(String(quantity));
    await this.page.keyboard.press('Tab');
    await this.page.waitForTimeout(300);
  }

  /** New -> Warehouse -> Description -> Reference No -> one item line. Stops before any save action. Does NOT fill Physical Qty — call fillPhysicalQty() separately when the scenario needs to Post. */
  async createStockTake({ warehouseCode = 'AMPANG', description = 'Testing', referenceNo, binLocationCode = 'AMPANG', itemName }) {
    await this.clickNew();
    await this.selectWarehouse(warehouseCode);
    await this.fillDescription(description);
    await this.fillReferenceNo(referenceNo);
    await this.addItemLine({ binLocationCode, itemName });
  }

  /** CONFIRMED live (2026-08-18): no confirmation dialog appears for Save Draft on this screen. Physical Qty is NOT required. */
  async clickSaveDraft() {
    const saveButton = this.formFrame.getByRole('listitem', { name: 'Save Draft [Alt + S]' });
    await saveButton.click();
    await this.page.waitForTimeout(1000);
  }

  /** CONFIRMED live (2026-08-18): Physical Qty MUST already be filled (see fillPhysicalQty()) or this is rejected with a validation alert. No confirmation dialog on success — opens a "Stock Take Summary with Different Qty Only Report" tab. */
  async clickPost() {
    const postButton = this.formFrame.getByRole('listitem', { name: 'Post [Alt + P]' });
    await postButton.click();
    await this.page.waitForTimeout(1000);
  }

  /** CONFIRMED live (2026-08-18): same Physical Qty requirement as clickPost(). Posts the current document and leaves a fresh blank New form behind, all in the SAME tab — does NOT open a report tab on this screen. */
  async clickPostAndNew() {
    const postAndNewButton = this.formFrame.getByRole('listitem', { name: 'Post & New [Alt + Ctrl + P]' });
    await postAndNewButton.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * CONFIRMED live (2026-08-18): Post (but not Post & New, on this screen)
   * opens a NEW in-app workspace tab ("Stock Take Summary with Different
   * Qty Only Report") that becomes frontmost, leaving the "Stock Take"
   * tab's own toolbar uninteractable until switched back to. Best-effort —
   * a no-op if there's nothing to switch.
   */
  async _switchBackToStockTakeTab() {
    await this.page.getByRole('link', { name: 'Stock Take', exact: true }).last()
      .click({ timeout: 3000 }).catch(() => {});
    await this.page.waitForTimeout(500);
  }

  /**
   * Re-resolves the form frame before looking for Back — Post & New
   * rebuilds the SAME tab's form in place, genuinely detaching any
   * previously-cached frame reference (same fix as
   * stockTransferPage.js/stockAdjustmentPage.js/arCreditNotePage.js).
   */
  async clickBack() {
    await this._switchBackToStockTakeTab();
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

  /** Waits for a genuine GRID DATA ROW matching the given Reference No — same principle as every other module's equivalent. */
  async _waitForRowMatchingReference(referenceNo, timeout = 15000) {
    const escaped = referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dataRowPattern = new RegExp(`^JEDetailPage\\s+Cancel\\b.*\\b${escaped}\\b`, 'i');
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
   * a genuine SOFT CANCEL (see class doc), working for both DRAFT and
   * POSTED documents. Click the row's own Cancel link, confirm the
   * app-wide "Cancel Confirmation" dialog via the SAME
   * `pcConfirmCancel_btnYesCancel_CD` control confirmed elsewhere in this
   * app. Scoped to this.listFrame, never page-wide. CONFIRMED live this
   * dialog does not reliably appear in an accessibility snapshot taken
   * immediately after the click (same trap as A/R Debit Note's stacked
   * dialog) — waiting directly on the dialog's own confirmed control
   * (rather than re-snapshotting first) is what actually works.
   */
  async cancelDocument(referenceNo) {
    await this._resolveListFrame();
    const matched = await this._waitForRowMatchingReference(referenceNo);
    if (!matched) {
      await this.page.screenshot({
        path: `test-results/debug-stock-take-cancel-not-found-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `Stock Take grid never showed a row matching Reference No. "${referenceNo}" — ` +
        'refusing to proceed with Cancel against a possibly-stale/unfiltered row.'
      );
    }
    const row = this.listFrame.getByRole('row', {
      name: new RegExp(`^JEDetailPage\\s+Cancel\\b.*\\b${referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
    }).first();
    await row.getByRole('link', { name: 'Cancel', exact: true }).click();

    const { locator: yesButton } = await heal(this.listFrame, {
      id: 'stockTake.cancelConfirmYesButton',
      label: 'Yes',
      strategies: [
        { type: 'css', value: '#ctl00_pcConfirmCancel_btnYesCancel_CD' },
        { type: 'css', value: '[id*="pcConfirmCancel" i][id*="btnYesCancel_CD" i]' },
      ],
      timeout: 5000,
    });
    await yesButton.click();
    await yesButton.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    await this.page.waitForTimeout(1000);
  }

  /**
   * CONFIRMED live (2026-08-18): verify via the listing grid, filtered to
   * DRAFT+POSTED by default — a cancelled document genuinely disappears
   * from this default view. Polls for up to `timeout` to tolerate the
   * stale-render trap already documented elsewhere in this repo.
   */
  async isCancelSuccessful(referenceNo, timeout = 10000) {
    const escaped = referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dataRowPattern = new RegExp(`^JEDetailPage\\s+Cancel\\b.*\\b${escaped}\\b`, 'i');
    const row = this.listFrame.getByRole('row', { name: dataRowPattern });
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if ((await row.count().catch(() => 0)) === 0) return true;
      await this.page.waitForTimeout(300);
    }
    return false;
  }
}

module.exports = { StockTakePage };
