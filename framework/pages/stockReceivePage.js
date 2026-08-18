const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Inventory (transactional module) > Stock Receive.
 *
 * SOURCE: built directly from Jin's own Playwright codegen recording
 * (2026-08-17) plus a full live exploration/confirmation of the same SIT
 * environment (uat/admin) — no Katalon Object Repository entry exists for
 * this screen yet. Every selector below was exercised live end-to-end
 * (Save Draft, Post, and Post & New, each followed by Cancel + a fresh
 * grid check to confirm gone) against a real Item ("SAFETY PIN", code
 * 01234) and Warehouse ("AMPANG") — both cleaned up before this page
 * object was written, zero residual test data left behind.
 *
 * SHAPE: nav (Inventory > Stock Receive) > listing grid with its own
 * header "New" icon > New opens a create form in its own iframe >
 * Warehouse combo (Code/Name popup list, AMPANG confirmed the first
 * option) > Description (mandatory) > Reference No (optional on this
 * screen — Jin's own recording never filled it, but it's filled here
 * anyway as this screen's one reliable lookup key, matching every other
 * module's convention, since Document No. stays "[DEFAULT]" until
 * Posted) > an Items grid with its own search-icon-triggered popup
 * (Code/Description columns) — CONFIRMED live the selected item's Qty
 * and Unit Cost auto-populate from item master data (1 and 7.39 for
 * SAFETY PIN); no manual Qty/Unit Cost fill needed.
 *
 * CONFIRMED LIVE (2026-08-17): unlike every A/R module built this
 * session, Save Draft, Post, AND Post & New all complete with NO
 * confirmation dialog whatsoever on this screen — no knock-off, no
 * unapplied-amount check. This is a genuinely simpler save flow.
 *
 * CONFIRMED LIVE (2026-08-17): Post opens a NEW in-app workspace tab
 * ("Stock Receive Summary Report"). Post & New ALSO opens this same
 * report tab (matching the general pattern most modules follow — A/R
 * Credit Note's Post & New NOT opening one was the exception, not the
 * rule) and additionally leaves a fresh, blank, unsaved New form behind
 * in the original tab.
 *
 * CONFIRMED LIVE (2026-08-17): Cancel is SIMPLE for both DRAFT and
 * POSTED documents — only the standard "Cancel Confirmation" dialog via
 * the same `pcConfirmCancel_btnYesCancel_CD` control confirmed across
 * every other module. UNLIKE A/R Debit Note/A/R Credit Note, cancelling
 * a POSTED Stock Receive does NOT reveal a second stacked "Cancel
 * Reason" dialog — confirmed via a full screenshot immediately after
 * confirming Yes, not just the accessibility snapshot, per this repo's
 * own established lesson that a stacked dialog can be invisible in the
 * accessibility tree.
 *
 * CONFIRMED LIVE (2026-08-17): opening an ALREADY-SAVED document via its
 * Document No. link in the list (edit mode) shows NO "Back" toolbar
 * button at all — only Post & New/Post/Save Draft/New/More Options,
 * same pattern already confirmed on A/R Credit Note. Does not affect
 * this page object, since every method here reaches the form exclusively
 * via clickNew() (which DOES show Back).
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable — always re-resolved via findFrame() by content, never
 * hardcoded.
 */
class StockReceivePage {
  constructor(page) {
    this.page = page;
    this.listFrame = null;
    this.formFrame = null;
  }

  async goto() {
    const p = this.page;
    await p.getByRole('link', { name: 'Inventory', exact: true }).click();
    await p.getByRole('link', { name: 'Stock Receive', exact: true }).click();
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
      await p.screenshot({ path: 'test-results/debug-stock-receive-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the frame containing the Stock Receive list "New" icon. ' +
        'Saved test-results/debug-stock-receive-list-page.png for inspection.'
      );
    }
  }

  /** CONFIRMED live (2026-08-17): the Description field has an accessible name — check it directly. */
  async _resolveFormFrame() {
    const p = this.page;
    this.formFrame = await findFrame(p, async (frame) => {
      const field = frame.getByRole('textbox', { name: 'Description:', exact: true });
      return (await field.count().catch(() => 0)) > 0 && (await field.first().isVisible().catch(() => false));
    });
    if (!this.formFrame) {
      await p.screenshot({ path: 'test-results/debug-stock-receive-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Stock Receive create/edit form frame (Description field). ' +
        'Saved test-results/debug-stock-receive-form-not-found.png for inspection.'
      );
    }
  }

  /** CONFIRMED live (2026-08-17): the grid header's own "New"/Insert icon; role match as fallback. */
  async clickNew() {
    let addIcon;
    try {
      const { locator } = await heal(this.listFrame, {
        id: 'stockReceive.newIcon',
        label: 'New',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_StockReceiveHeader_cbpStockReceiveHdr_formC_gvStockReceive_header17_Add' },
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
   * CONFIRMED live this is a popup list (Code/Name columns), not a plain
   * HTML select. "AMPANG" confirmed the first option, matching Jin's own
   * recording (`_DDD_L_LBI0T1`) — verified directly, not assumed.
   */
  async selectWarehouse(warehouseCode) {
    const f = this.formFrame;
    const dropdownArrow = f.locator('#ctl00_MainContent_StockReceiveDetail_cbpStockReceiveDetails_ASPxRoundPanel1_formStockReceive_cbWarehouse_cbWarehouse_B-1Img');
    await dropdownArrow.click();
    await this.page.waitForTimeout(500);

    const option = f.getByRole('cell', { name: warehouseCode, exact: true }).first();
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

  /** Fills the header's Reference No field — this screen's one reliable way to find a specific document again later, since Document No. stays "[DEFAULT]" until Posted. Keep to 20 characters or fewer (confirmed display truncation on this app-wide pattern). */
  async fillReferenceNo(referenceNo) {
    const field = this.formFrame.getByRole('textbox', { name: 'Reference No:', exact: true });
    await field.click();
    await field.fill(referenceNo);
  }

  /**
   * Adds one stock receive line: click the Items grid's own search-icon
   * trigger, pick an item by name, confirm via the popup's own OK button.
   *
   * CONFIRMED live (2026-08-17): Qty and Unit Cost auto-populate from the
   * item's master data on selection (1 and 7.39 for SAFETY PIN) — no
   * manual fill needed, unlike the AR modules' Amount fields.
   */
  async addItemLine(itemName) {
    const f = this.formFrame;
    const searchTrigger = f.locator('#ctl00_MainContent_StockReceiveDetail_cbpStockReceiveDetails_cpnlSRDetail_formSRDetail_PC_0_ItemAdvanceSearchControlSRDetail_txtItemSearchUpdate_B0Img');
    await searchTrigger.click();
    await this.page.waitForTimeout(500);

    const itemOption = f.getByRole('cell', { name: itemName, exact: true }).first();
    await itemOption.waitFor({ state: 'visible', timeout: 5000 });
    await itemOption.click();
    await this.page.waitForTimeout(500);

    const okButton = f.locator('#ctl00_MainContent_StockReceiveDetail_cbpStockReceiveDetails_cpnlSRDetail_formSRDetail_PC_0_ItemAdvanceSearchControlSRDetail_pcItemSearchControl_cpnlItemSearchControl_formItemSearchControl_btnItemSearchOk_CD');
    await okButton.click();
    await this.page.waitForTimeout(500);
  }

  /** CONFIRMED live (2026-08-17): no confirmation dialog appears for Save Draft on this screen. */
  async clickSaveDraft() {
    const saveButton = this.formFrame.getByRole('listitem', { name: 'Save Draft [Alt + S]' });
    await saveButton.click();
    await this.page.waitForTimeout(1000);
  }

  /** CONFIRMED live (2026-08-17): no confirmation dialog appears for Post either — opens a "Stock Receive Summary Report" tab. */
  async clickPost() {
    const postButton = this.formFrame.getByRole('listitem', { name: 'Post [Alt + P]' });
    await postButton.click();
    await this.page.waitForTimeout(1000);
  }

  /** CONFIRMED live (2026-08-17): posts the current document (also opening the report tab, unlike A/R Credit Note) AND leaves a fresh blank New form behind. */
  async clickPostAndNew() {
    const postAndNewButton = this.formFrame.getByRole('listitem', { name: 'Post & New [Alt + Ctrl + P]' });
    await postAndNewButton.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * CONFIRMED live (2026-08-17), same pattern as every other Post-capable
   * module: Post and Post & New both open a NEW in-app workspace tab
   * ("Stock Receive Summary Report") that becomes the active/frontmost
   * one, leaving the "Stock Receive" tab's own toolbar no longer
   * interactable until switched back to. Best-effort — a no-op if
   * there's nothing to switch (Save Draft never opens one).
   */
  async _switchBackToStockReceiveTab() {
    await this.page.getByRole('link', { name: 'Stock Receive', exact: true }).last()
      .click({ timeout: 3000 }).catch(() => {});
    await this.page.waitForTimeout(500);
  }

  async clickBack() {
    await this._switchBackToStockReceiveTab();
    const backButton = this.formFrame.getByRole('listitem', { name: 'Back [Alt + B]' });
    await backButton.click();
    await this.page.waitForTimeout(1000);
    await this._resolveListFrame();
  }

  /** New -> Warehouse -> Description -> Reference No -> one item line. Stops before any save action. */
  async createStockReceive({ warehouseCode = 'AMPANG', description = 'Testing', referenceNo, itemName }) {
    await this.clickNew();
    await this.selectWarehouse(warehouseCode);
    await this.fillDescription(description);
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
   * CONFIRMED live (2026-08-17) as this screen's real cleanup mechanism —
   * no hard-delete exists here (the row's trash-can-looking icon's
   * accessible name is "Cancel", not "Delete"). Click the row's own
   * Cancel link, confirm the "Cancel Confirmation" dialog via the SAME
   * `pcConfirmCancel_btnYesCancel_CD` control already confirmed for every
   * other module. UNLIKE A/R Debit Note/A/R Credit Note, this screen
   * needs NO additional Cancel Reason step for POSTED documents —
   * confirmed live via full screenshot. Scoped to this.listFrame, never
   * page-wide.
   */
  async cancelDocument(referenceNo) {
    await this._resolveListFrame();
    const matched = await this._waitForRowMatchingReference(referenceNo);
    if (!matched) {
      await this.page.screenshot({
        path: `test-results/debug-stock-receive-cancel-not-found-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `Stock Receive grid never showed a row matching Reference No. "${referenceNo}" — ` +
        'refusing to proceed with Cancel against a possibly-stale/unfiltered row.'
      );
    }
    const row = this.listFrame.getByRole('row', {
      name: new RegExp(`^JEDetailPage\\s+Cancel\\b.*\\b${referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
    }).first();
    await row.getByRole('link', { name: 'Cancel', exact: true }).click();

    const { locator: yesButton } = await heal(this.listFrame, {
      id: 'stockReceive.cancelConfirmYesButton',
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
   * CONFIRMED live (2026-08-17): verify via the listing grid — the row
   * must disappear from the default DRAFT+POSTED view. Same "verify via
   * grid" approach already established for A/R Debit Note/A/R Credit
   * Note (this screen's own banner behavior was not independently
   * confirmed either way, so the grid check is used directly rather than
   * risk a false negative from an unconfirmed banner).
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

module.exports = { StockReceivePage };
