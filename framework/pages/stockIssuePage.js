const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Inventory (transactional module) > Stock Issue.
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
 * SHAPE: near-identical to stockReceivePage.js — same underlying control
 * shape (`cbpStockIssueDetails`/`SIDetail` instead of
 * `cbpStockReceiveDetails`/`SRDetail`), same Warehouse combo (Code/Name
 * popup list, AMPANG confirmed the first option, same as Stock Receive —
 * confirmed directly, not assumed by analogy), same item-search-icon
 * popup with auto-populated Qty/Unit Cost from item master data. Jin's
 * own recording never filled Reference No; it is filled here anyway as
 * this screen's one reliable lookup key, matching every other module's
 * convention.
 *
 * CONFIRMED LIVE (2026-08-17): like Stock Receive, Save Draft, Post, and
 * Post & New all complete with NO confirmation dialog whatsoever.
 *
 * CONFIRMED LIVE (2026-08-17): Post opens a NEW in-app workspace tab
 * ("Stock Issue Detail Report" — note the different name from Stock
 * Receive's "Stock Receive Summary Report", confirmed directly, not
 * assumed). Post & New, HOWEVER, does NOT open a report tab on this
 * screen — confirmed live via the tab bar immediately after Post & New
 * showing only the "Stock Issue" tab — it just posts and leaves a fresh
 * blank form in the SAME tab. This is the OPPOSITE of Stock Receive's own
 * Post & New behavior (which does open the report tab there) — CONFIRMED
 * this is a genuine per-module difference, not an assumption.
 *
 * CONFIRMED LIVE (2026-08-17): Cancel is SIMPLE for both DRAFT and
 * POSTED documents — only the standard "Cancel Confirmation" dialog via
 * the same `pcConfirmCancel_btnYesCancel_CD` control confirmed across
 * every other module, no stacked "Cancel Reason" step, same as Stock
 * Receive.
 *
 * SAFETY LESSON (2026-08-17, confirmed live during manual exploration): a
 * single screenshot taken immediately after confirming Cancel on a
 * POSTED document showed the row STILL as POSTED — a stale render, not a
 * real failure (a genuinely fresh reload + re-navigate confirmed the
 * cancel had actually succeeded). `isCancelSuccessful()`'s poll-based
 * check (retrying for up to 10s, not a single-shot read) already
 * tolerates this; never trust a single immediately-following screenshot
 * or snapshot on this screen.
 *
 * CONFIRMED LIVE (2026-08-17): opening an ALREADY-SAVED document via its
 * Document No. link in the list (edit mode) shows NO "Back" toolbar
 * button at all, same pattern already confirmed on Stock Receive/A/R
 * Credit Note. Does not affect this page object, since every method here
 * reaches the form exclusively via clickNew() (which DOES show Back).
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable — always re-resolved via findFrame() by content, never
 * hardcoded.
 */
class StockIssuePage {
  constructor(page) {
    this.page = page;
    this.listFrame = null;
    this.formFrame = null;
  }

  async goto() {
    const p = this.page;
    await p.getByRole('link', { name: 'Inventory', exact: true }).click();
    await p.getByRole('link', { name: 'Stock Issue', exact: true }).click();
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
      await p.screenshot({ path: 'test-results/debug-stock-issue-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the frame containing the Stock Issue list "New" icon. ' +
        'Saved test-results/debug-stock-issue-list-page.png for inspection.'
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
      await p.screenshot({ path: 'test-results/debug-stock-issue-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Stock Issue create/edit form frame (Description field). ' +
        'Saved test-results/debug-stock-issue-form-not-found.png for inspection.'
      );
    }
  }

  /** CONFIRMED live (2026-08-17): the grid header's own "New"/Insert icon; role match as fallback. */
  async clickNew() {
    let addIcon;
    try {
      const { locator } = await heal(this.listFrame, {
        id: 'stockIssue.newIcon',
        label: 'New',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_StockIssueHeader_cbpStockIssueHdr_formC_gvStockIssue_header17_Add' },
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
   * HTML select. "AMPANG" confirmed the first option, matching Stock
   * Receive's own confirmed Warehouse list (same master data) — verified
   * directly, not assumed.
   */
  async selectWarehouse(warehouseCode) {
    const f = this.formFrame;
    const dropdownArrow = f.locator('#ctl00_MainContent_StockIssueDetail_cbpStockIssueDetails_ASPxRoundPanel1_formStockIssue_cbWarehouse_cbWarehouse_B-1Img');
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
   * Adds one stock issue line: click the Items grid's own search-icon
   * trigger, pick an item by name, confirm via the popup's own OK button.
   *
   * CONFIRMED live (2026-08-17): Qty and Unit Cost auto-populate from the
   * item's master data on selection (1 and 7.39 for SAFETY PIN) — no
   * manual fill needed, same as Stock Receive.
   */
  async addItemLine(itemName) {
    const f = this.formFrame;
    const searchTrigger = f.locator('#ctl00_MainContent_StockIssueDetail_cbpStockIssueDetails_cpnlSIDetail_formSIDetail_PC_0_ItemAdvanceSearchControlSIDetail_txtItemSearchUpdate_B0Img');
    await searchTrigger.click();
    await this.page.waitForTimeout(500);

    const itemOption = f.getByRole('cell', { name: itemName, exact: true }).first();
    await itemOption.waitFor({ state: 'visible', timeout: 5000 });
    await itemOption.click();
    await this.page.waitForTimeout(500);

    const okButton = f.locator('#ctl00_MainContent_StockIssueDetail_cbpStockIssueDetails_cpnlSIDetail_formSIDetail_PC_0_ItemAdvanceSearchControlSIDetail_pcItemSearchControl_cpnlItemSearchControl_formItemSearchControl_btnItemSearchOk_CD');
    await okButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Adds one stock issue line by ITEM CODE, filtering the item search
   * popup's own filter box first — CONFIRMED live (2026-08-22) necessary
   * when the target item isn't on the popup's default unfiltered first
   * page (unlike addItemLine(), which assumes the item is already visible
   * without filtering). Real keystrokes into the filter box per this
   * repo's search/filter-field convention. Same shape as
   * stockReceivePage.js's addItemLineByCode().
   */
  async addItemLineByCode(itemCode) {
    const f = this.formFrame;
    const searchTrigger = f.locator('#ctl00_MainContent_StockIssueDetail_cbpStockIssueDetails_cpnlSIDetail_formSIDetail_PC_0_ItemAdvanceSearchControlSIDetail_txtItemSearchUpdate_B0Img');
    await searchTrigger.click();
    await this.page.waitForTimeout(500);

    const filterBox = f.locator('#ctl00_MainContent_StockIssueDetail_cbpStockIssueDetails_cpnlSIDetail_formSIDetail_PC_0_ItemAdvanceSearchControlSIDetail_pcItemSearchControl_cpnlItemSearchControl_formItemSearchControl_txtFilterItemSearchGridView_I');
    await filterBox.click();
    await filterBox.pressSequentially(itemCode, { delay: 30 });
    await this.page.waitForTimeout(800);

    const itemOption = f.getByRole('cell', { name: itemCode, exact: true }).first();
    await itemOption.waitFor({ state: 'visible', timeout: 5000 });
    await itemOption.click();
    await this.page.waitForTimeout(500);

    const okButton = f.locator('#ctl00_MainContent_StockIssueDetail_cbpStockIssueDetails_cpnlSIDetail_formSIDetail_PC_0_ItemAdvanceSearchControlSIDetail_pcItemSearchControl_cpnlItemSearchControl_formItemSearchControl_btnItemSearchOk_CD');
    await okButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Reads the auto-populated Qty of the line matching the given item code —
   * CONFIRMED live (2026-08-22) same fixed column order as Stock Receive
   * (No/Item Code/Description/2nd Description/Bin Location/UOM/Qty/Unit
   * Cost/Total), so the last 3 numbers in the row are always Qty, Unit
   * Cost, Total. Anchored to `^Delete\s+Edit\b` — same bug already fixed
   * in stockReceivePage.js's getLineQty(): an unanchored match picks up
   * the OUTER wrapping grid row (headers + data + trailing Total row
   * concatenated) instead of the actual single data row.
   */
  async getLineQty(itemCode) {
    const escaped = itemCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const row = this.formFrame.getByRole('row', {
      name: new RegExp(`^Delete\\s+Edit\\b[\\s\\S]*\\b${escaped}\\b`, 'i'),
    }).first();
    const text = await row.innerText();
    const numbers = (text.match(/\d+(?:\.\d+)?/g) || []).map(Number);
    if (numbers.length < 3) {
      throw new Error(`Could not read Qty for item "${itemCode}" from stock issue line: "${text}"`);
    }
    return numbers[numbers.length - 3];
  }

  /** CONFIRMED live (2026-08-17): no confirmation dialog appears for Save Draft on this screen. */
  async clickSaveDraft() {
    const saveButton = this.formFrame.getByRole('listitem', { name: 'Save Draft [Alt + S]' });
    await saveButton.click();
    await this.page.waitForTimeout(1000);
  }

  /** CONFIRMED live (2026-08-17): no confirmation dialog appears for Post either — opens a "Stock Issue Detail Report" tab. */
  async clickPost() {
    const postButton = this.formFrame.getByRole('listitem', { name: 'Post [Alt + P]' });
    await postButton.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * CONFIRMED live (2026-08-17): posts the current document and leaves a
   * fresh blank New form behind, all in the SAME tab — UNLIKE Stock
   * Receive, this does NOT open a report tab on this screen (confirmed
   * via the tab bar immediately afterward showing only "Stock Issue").
   */
  async clickPostAndNew() {
    const postAndNewButton = this.formFrame.getByRole('listitem', { name: 'Post & New [Alt + Ctrl + P]' });
    await postAndNewButton.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * CONFIRMED live (2026-08-17): Post (but not Post & New, on this
   * screen) opens a NEW in-app workspace tab ("Stock Issue Detail
   * Report") that becomes the active/frontmost one, leaving the "Stock
   * Issue" tab's own toolbar no longer interactable until switched back
   * to. Best-effort — a no-op if there's nothing to switch (Save Draft
   * and Post & New never open one here).
   */
  async _switchBackToStockIssueTab() {
    await this.page.getByRole('link', { name: 'Stock Issue', exact: true }).last()
      .click({ timeout: 3000 }).catch(() => {});
    await this.page.waitForTimeout(500);
  }

  async clickBack() {
    await this._switchBackToStockIssueTab();
    const backButton = this.formFrame.getByRole('listitem', { name: 'Back [Alt + B]' });
    await backButton.click();
    await this.page.waitForTimeout(1000);
    await this._resolveListFrame();
  }

  /** New -> Warehouse -> Description -> Reference No -> one item line. Stops before any save action. */
  async createStockIssue({ warehouseCode = 'AMPANG', description = 'Testing', referenceNo, itemName }) {
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
   * other module. No additional Cancel Reason step for POSTED documents,
   * same as Stock Receive. Scoped to this.listFrame, never page-wide.
   */
  async cancelDocument(referenceNo) {
    // Same fix as stockReceivePage.js's cancelDocument(): if another tab
    // (e.g. Item) was switched to in between, this screen's own tab is
    // hidden — its grid rows resolve but report isVisible()=false, so the
    // row-match wait fails even though the document genuinely exists.
    // Harmless no-op if this tab is already active.
    await this._switchBackToStockIssueTab();
    await this._resolveListFrame();
    const matched = await this._waitForRowMatchingReference(referenceNo);
    if (!matched) {
      await this.page.screenshot({
        path: `test-results/debug-stock-issue-cancel-not-found-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `Stock Issue grid never showed a row matching Reference No. "${referenceNo}" — ` +
        'refusing to proceed with Cancel against a possibly-stale/unfiltered row.'
      );
    }
    const row = this.listFrame.getByRole('row', {
      name: new RegExp(`^JEDetailPage\\s+Cancel\\b.*\\b${referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
    }).first();
    await row.getByRole('link', { name: 'Cancel', exact: true }).click();

    const { locator: yesButton } = await heal(this.listFrame, {
      id: 'stockIssue.cancelConfirmYesButton',
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
   * must disappear from the default DRAFT+POSTED view. See this file's
   * SAFETY LESSON: a single immediately-following read can show a stale
   * "still POSTED" render — this polls for up to `timeout`, not a
   * single-shot check, which tolerates that.
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

module.exports = { StockIssuePage };
