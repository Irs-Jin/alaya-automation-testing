const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Purchase > Purchase Order.
 *
 * SOURCE: built from a screen recording the user provided (Purchase Order
 * Flow 1, 2026-08-17) showing New -> select Vendor -> select Warehouse ->
 * add one item (accepting the "already exists in previous PO" prompt) ->
 * Post -> auto-opened PurchaseOrderSummaryGST Report tab -> back to the
 * listing grid showing the new POSTED record. The video alone only shows
 * what to click, not real selectors, so every id below was then CONFIRMED
 * live (2026-08-17) via a throwaway diagnostic script that logged in,
 * walked the exact same flow, and dumped the real DOM at each step —
 * not guessed from the recording.
 *
 * SHAPE: nav (Purchase > Purchase Order) > listing grid with its own
 * "New" icon (title "Click Here Or Press [Insert] To Add Record" — same
 * pattern already used elsewhere in this repo, just a differently-indexed
 * header column, "header19" not "header0") > New opens a create form in
 * its own iframe > Vendor and Item both use a big searchable popup grid
 * (same "click trigger -> click cell -> click popup's own OK" shape as
 * CashSalesPage's customer/item pickers, confirmed via live DOM dump to be
 * two DIFFERENT underlying DevExpress controls though — Vendor uses the
 * shared "GeneralSearchControl", Item uses its own distinct
 * "ItemSearchControl" with a different OK button id) > Warehouse is a
 * plain combo dropdown (click arrow, click the matching cell, no separate
 * OK) > adding an item that already appears on an earlier PO triggers an
 * "Information" dialog (shared "pcInfoMessageBox" control, reusable for
 * more than just this one scenario) that must be accepted before the item
 * actually lands in the grid > Post commits the document and auto-opens a
 * PurchaseOrderSummaryGST Report tab, matching Cash Sales' own
 * auto-opened GST report after Post.
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable across navigations — always re-resolved via findFrame() by
 * content, never hardcoded.
 */
class PurchaseOrderPage {
  constructor(page) {
    this.page = page;
    this.listFrame = null; // listing grid iframe
    this.formFrame = null; // create form iframe
  }

  async goto() {
    const p = this.page;
    // BUG FIXED (2026-08-18): scoped to #navBar (the actual left-nav
    // sidebar) — confirmed live via the same failure CashPurchasePage's
    // goto() already fixed: the unscoped page-wide locator becomes
    // ambiguous the SECOND time goto() runs for this same screen in one
    // test/script (needed here too, since cancelDocument() navigates back
    // to this listing after creating a document). The already-open
    // browser tab's own label ALSO matches
    // getByRole('link', {name: 'Purchase Order', exact:true}), causing a
    // strict-mode violation — confirmed live via the exact error:
    // "resolved to 2 elements: ... aka locator('#sub171')..." (the real
    // nav link) "... aka locator('#tt')..." (the open tab's own label).
    //
    // Clicking "Purchase" TOGGLES its submenu open/closed rather than
    // idempotently opening it — confirmed live (via ClosePurchaseOrderPage,
    // which reuses this same nav pattern) that a second click collapses an
    // already-expanded submenu instead of leaving it open. Only click it
    // if the target link isn't already visible, so this stays correct
    // even if goto() runs more than once in the same test/session.
    const navBar = p.locator('#navBar');
    const purchaseOrderLink = navBar.getByRole('link', { name: 'Purchase Order', exact: true });
    const alreadyExpanded = await purchaseOrderLink.isVisible().catch(() => false);
    if (!alreadyExpanded) {
      await navBar.getByRole('link', { name: 'Purchase', exact: true }).click();
    }
    await purchaseOrderLink.click();
    await p.waitForLoadState('networkidle');
    await this._resolveListFrame();
  }

  async _resolveListFrame() {
    const p = this.page;
    this.listFrame = await findFrame(p, async (frame) => {
      // Scoped to BOTH markers together — "Company:" alone also matches
      // this app's left-nav menu frame (which lists many unrelated
      // "...Company..." menu items), confirmed live via a false-positive
      // frame match during the diagnostic probe. Pairing it with "POSTED"
      // (the status filter checkbox, unique to this listing screen)
      // disambiguates reliably.
      // Also requires visibility - a Close Purchase Order (or any other
      // module's) listing tab left open in the background has the exact
      // same "Company:" + "POSTED" markers, confirmed live to otherwise
      // cause a false match on the wrong, inactive tab's frame.
      const company = frame.getByText('Company:', { exact: false });
      const posted = frame.getByText('POSTED', { exact: false });
      if ((await company.count().catch(() => 0)) === 0) return false;
      if ((await posted.count().catch(() => 0)) === 0) return false;
      return await company.first().isVisible().catch(() => false);
    });
    if (!this.listFrame) {
      await p.screenshot({ path: 'test-results/debug-purchase-order-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Purchase Order listing frame. ' +
        'Saved test-results/debug-purchase-order-list-page.png for inspection.'
      );
    }
  }

  async _resolveFormFrame() {
    const p = this.page;
    this.formFrame = await findFrame(p, async (frame) => {
      // BUG FIXED (2026-08-17): checking count() alone let this match a
      // Purchase Order tab left open in the background from an earlier
      // navigation (its header keeps showing "Next Possible No..." text
      // even once posted) — confirmed live once a second in-app tab
      // existed simultaneously. Requiring visibility ensures this only
      // matches the actual FRONT tab's frame.
      const marker = frame.getByText('Next Possible No', { exact: false });
      if ((await marker.count().catch(() => 0)) === 0) return false;
      return await marker.first().isVisible().catch(() => false);
    });
    if (!this.formFrame) {
      await p.screenshot({ path: 'test-results/debug-purchase-order-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Purchase Order create/edit form frame. ' +
        'Saved test-results/debug-purchase-order-form-not-found.png for inspection.'
      );
    }
  }

  /**
   * CONFIRMED live (2026-08-17): the listing grid's "New" control has a
   * misleading id (`..._header19_btnCheckAll`, not any kind of "Add"
   * name) — same "id substring can be misleading, trust the real
   * behavior/title" caution this repo already documents elsewhere. Its
   * title attribute is the reliable signal, kept as the role-based
   * fallback.
   */
  async clickNew() {
    let addIcon;
    try {
      const { locator } = await heal(this.listFrame, {
        id: 'purchaseOrder.newIcon',
        label: 'New',
        strategies: [
          { type: 'css', value: '[id*="header19_btnCheckAll" i]' },
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

  /** Selects a Vendor via its own searchable popup grid (AccountNo/Name columns). */
  async selectVendor(vendorCode) {
    const f = this.formFrame;
    const { locator: trigger } = await heal(f, {
      id: 'purchaseOrder.vendorTrigger',
      label: 'Vendor',
      strategies: [
        { type: 'css', value: '[id$="cbVendor_cbVendor_B1Img" i]' },
      ],
      timeout: 5000,
    });
    await trigger.click();

    const popupFrame = (await findFrame(this.page, async (frame) => {
      const cell = frame.getByRole('cell', { name: vendorCode, exact: true });
      return (await cell.count()) > 0;
    }, { timeout: 10000 })) || f;

    const vendorCell = popupFrame.getByRole('cell', { name: vendorCode, exact: true });
    await vendorCell.first().waitFor({ state: 'visible', timeout: 10000 });
    await vendorCell.first().click();

    const { locator: okButton } = await heal(popupFrame, {
      id: 'purchaseOrder.vendorPopupOkButton',
      label: 'OK',
      strategies: [
        { type: 'css', value: '[id$="cbVendor_gsc_cbVendor_pcGeneralSearchControl_cpnlGeneralSearchControl_formGeneralSearchControl_btnOk_CD" i]' },
      ],
      timeout: 5000,
    });
    await okButton.click();
  }

  /**
   * Selects Warehouse from its own combo dropdown (arrow -> matching
   * listbox item — no separate OK, confirmed live: clicking the item cell
   * alone commits the selection here, unlike Vendor's search-grid popup).
   */
  async selectWarehouse(warehouseCode) {
    const f = this.formFrame;
    const { locator: trigger } = await heal(f, {
      id: 'purchaseOrder.warehouseTrigger',
      label: 'Warehouse',
      strategies: [
        { type: 'css', value: '[id$="cbSelectWareHouse_cbWarehouse_B-1Img" i]' },
      ],
      timeout: 5000,
    });
    await trigger.click();

    const cell = f.getByRole('cell', { name: warehouseCode, exact: true });
    await cell.first().waitFor({ state: 'visible', timeout: 10000 });
    await cell.first().click();
  }

  /**
   * Selects an Item via its own searchable popup grid — a DIFFERENT
   * underlying control from Vendor's (confirmed live: distinct id root
   * "ItemSearchControl" vs. Vendor's "GeneralSearchControl", with its own
   * separate OK button), even though both render as the same-looking
   * "Search" dialog with Description/Item Code/... columns.
   */
  async selectItem(itemDescription) {
    const f = this.formFrame;
    const { locator: trigger } = await heal(f, {
      id: 'purchaseOrder.itemTrigger',
      label: 'Item',
      strategies: [
        { type: 'css', value: '[id$="ItemAdvanceSearchControlPODetail_txtItemSearchUpdate_B0Img" i]' },
      ],
      timeout: 5000,
    });
    await trigger.click();

    const popupFrame = (await findFrame(this.page, async (frame) => {
      const cell = frame.getByRole('cell', { name: itemDescription, exact: true });
      return (await cell.count()) > 0;
    }, { timeout: 10000 })) || f;

    const itemCell = popupFrame.getByRole('cell', { name: itemDescription, exact: true });
    await itemCell.first().waitFor({ state: 'visible', timeout: 10000 });
    await itemCell.first().click();

    const { locator: okButton } = await heal(popupFrame, {
      id: 'purchaseOrder.itemPopupOkButton',
      label: 'OK',
      strategies: [
        { type: 'css', value: '[id$="formItemSearchControl_btnItemSearchOk_CD" i]' },
      ],
      timeout: 5000,
    });
    await okButton.click();

    await this.handleDuplicateItemPromptIfPresent();
  }

  /**
   * Adding an item already used on an earlier PO shows an "Information"
   * dialog ("Following Item is detected exist in previous PO... Are you
   * sure you want to add those items to the document?") that must be
   * accepted before the item actually lands in the grid — confirmed live
   * the item silently does NOT get added while this sits open. The
   * underlying control ("pcInfoMessageBox") is a shared, reusable info
   * dialog, not specific to this one message, so this is a presence
   * check, not an assumption it always appears.
   */
  async handleDuplicateItemPromptIfPresent() {
    const f = this.formFrame;
    const present = await f.getByText('detected exist in previous PO', { exact: false })
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (!present) return;

    const { locator: yesButton } = await heal(f, {
      id: 'purchaseOrder.duplicateItemYesButton',
      label: 'Yes',
      strategies: [
        { type: 'css', value: '[id$="pcInfoMessageBox_btnInfoYes_CD" i]' },
      ],
      timeout: 5000,
    });
    await yesButton.click();
    await f.getByText('detected exist in previous PO', { exact: false }).first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }

  async clickSaveDraft() {
    const { locator } = await heal(this.formFrame, {
      id: 'purchaseOrder.saveDraftButton',
      label: 'Save Draft',
      strategies: [
        { type: 'css', value: '[title="Save Draft [Alt + S]"]' },
        { type: 'text', value: 'Save Draft', options: { exact: true } },
      ],
      timeout: 5000,
    });
    await locator.click();
    await this.page.waitForTimeout(1000);
  }

  async clickPost() {
    const { locator } = await heal(this.formFrame, {
      id: 'purchaseOrder.postButton',
      label: 'Post',
      strategies: [
        { type: 'css', value: '[title="Post [Alt + P]"]' },
        { type: 'text', value: 'Post', options: { exact: true } },
      ],
      timeout: 5000,
    });
    await locator.click();
    // Posting is itself a server round-trip (document numbering, GST
    // report generation) — confirmed live in the recording that this
    // takes several seconds before the status/document number update and
    // the GST report tab auto-opens. Matches the same class of "posting
    // isn't instant" timing already documented for Cash Sales' Post.
    await this.page.waitForTimeout(5000);
  }

  /** Full flow: select vendor + warehouse, add one item, Save Draft. */
  async createPurchaseOrder({ vendorCode, warehouseCode, itemDescription }) {
    if (vendorCode) await this.selectVendor(vendorCode);
    if (warehouseCode) await this.selectWarehouse(warehouseCode);
    if (itemDescription) await this.selectItem(itemDescription);
  }

  /** Full Post flow: select vendor + warehouse, add one item, Post. */
  async postPurchaseOrder({ vendorCode, warehouseCode, itemDescription }) {
    await this.createPurchaseOrder({ vendorCode, warehouseCode, itemDescription });
    await this.clickPost();
  }

  /**
   * Reads the current item grid's row(s) for verification — same
   * approach as CashSalesPage.hasItemRow(), scoped to the form frame's
   * Items grid rather than a page-wide search.
   */
  async hasItemRow(itemDescription) {
    const row = this.formFrame.getByRole('row', { name: new RegExp(itemDescription, 'i') });
    return (await row.count().catch(() => 0)) > 0 && (await row.first().isVisible().catch(() => false));
  }

  /**
   * Checks whether the document actually posted.
   *
   * BUG FIXED (2026-08-17): an earlier version tried reading the visible
   * Document No. field via a guessed accessible-label locator — confirmed
   * live via a failure screenshot that Post had genuinely succeeded
   * (PO-00000022 assigned, GST report auto-opened correctly, exactly per
   * the recording) even though the check itself failed, meaning the
   * guessed selector was simply wrong, not the flow. Replaced with the
   * same "strongest available proof" approach CashSalesPage uses for its
   * own Post check: Post auto-opens a "PurchaseOrderSummaryGST Report"
   * tab — its mere presence is direct, confirmed evidence Post committed,
   * without needing to guess at any in-form field id.
   */
  async expectPostSuccess() {
    const reportTab = this.page.getByText('PurchaseOrderSummaryGST Report', { exact: false });
    return (await reportTab.count().catch(() => 0)) > 0;
  }

  /**
   * Reads the posted document's assigned number (e.g. "PO-00000032") from
   * the auto-opened GST report's own content — the report always shows
   * "Purchase Ord. No : PO-XXXXX". Added (2026-08-17) for
   * ClosePurchaseOrderPage's own test, which needs a guaranteed-fresh,
   * still-open PO to transfer from rather than depending on whatever
   * happens to already exist in the shared environment. Only call this
   * after expectPostSuccess() is true.
   */
  async getPostedDocumentNumber() {
    const reportFrame = await findFrame(this.page, async (frame) => {
      const marker = frame.getByText('Purchase Ord. No', { exact: false });
      if ((await marker.count().catch(() => 0)) === 0) return false;
      return await marker.first().isVisible().catch(() => false);
    }, { timeout: 10000 });
    if (!reportFrame) return null;
    const text = await reportFrame.locator('body').innerText().catch(() => '');
    const match = text.match(/PO-\d+/);
    return match ? match[0] : null;
  }

  /**
   * Fills the listing grid's own live-filter textbox and waits for a
   * genuine matching row before returning — same id suffix
   * (FilterTextBoxGridView_txtFilterGridView_I) and same
   * triple-click-then-pressSequentially convention already confirmed
   * across this whole module (customerPage.js / CashPurchasePage /
   * PurchaseInvoicePage / GoodsReceivePage / PurchaseReturnPage). Required
   * before clickCancelIcon() so the row we act on is provably the one we
   * searched for, not whatever the default (unfiltered/paginated) grid
   * view happens to show.
   */
  async searchListing(searchText) {
    await this._resolveListFrame();
    const { locator: filterBox } = await heal(this.listFrame, {
      id: 'purchaseOrder.listingSearchFilterBox',
      label: 'Search',
      strategies: [
        { type: 'css', value: '[id*="FilterTextBoxGridView_txtFilterGridView_I" i]' },
      ],
      timeout: 5000,
    });
    await filterBox.click({ clickCount: 3 });
    await filterBox.pressSequentially(searchText, { delay: 60 });
    await filterBox.press('Space');
    await filterBox.press('Backspace');

    const matched = await this._waitForListingRowMatching(searchText, 15000);
    if (!matched) {
      await this.page.screenshot({
        path: `test-results/debug-purchase-order-search-not-found-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `Purchase Order listing never showed a row matching "${searchText}" after searching — ` +
        'refusing to proceed with Cancel against a possibly-stale/unfiltered row.'
      );
    }
    await this.page.waitForTimeout(300);
  }

  /**
   * Polls until a genuine grid DATA ROW matching the search text is
   * visible AND carries its own "Cancel" row-action icon — proof this is
   * a real filtered data row, not the filter textbox's own wrapping cell
   * (same false-positive class already root-caused in customerPage.js's
   * _waitForGridRowMatching(), reused as-is from CashPurchasePage).
   */
  async _waitForListingRowMatching(searchText, timeout = 15000) {
    const row = this.listFrame.locator('tr.dxgvDataRow_iOS').filter({ hasText: searchText });
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if ((await row.count().catch(() => 0)) > 0
        && (await row.first().isVisible().catch(() => false))
        && (await row.first().getByRole('img', { name: 'Cancel', exact: true }).count().catch(() => 0)) > 0) {
        return true;
      }
      await this.page.waitForTimeout(300);
    }
    return false;
  }

  /**
   * Clicks the matching row's own "Cancel" icon. CONFIRMED accessible name
   * "Cancel" everywhere else in this module (icon file Delete.svg) —
   * expected to hold here too. Scoped to the ONE row matching searchText,
   * never a grid-wide selector, per this repo's safety rule for
   * delete/cancel actions.
   *
   * Same app-wide loading-overlay risk documented in CashPurchasePage's
   * clickCancelIcon() applies here too (Post's own trailing async work can
   * still be finishing server-side right after Post returns) — handled at
   * the call site (cancelDocument()) with a settle wait before returning
   * to the listing.
   */
  async clickCancelIcon(searchText) {
    const row = this.listFrame.locator('tr.dxgvDataRow_iOS').filter({ hasText: searchText });
    const cancelIcon = row.first().getByRole('img', { name: 'Cancel', exact: true });
    await cancelIcon.waitFor({ state: 'visible', timeout: 15000 });
    await cancelIcon.click({ timeout: 30000 });
  }

  /**
   * Confirms the row-level Cancel action via its own "Cancel Confirmation"
   * dialog (`pcConfirmCancel` — same id root confirmed live across Cash
   * Purchase/Purchase Invoice/Goods Receive/Purchase Return). `_CD` (+
   * `_I` zero-size sibling) is the real clickable element. Scoped to
   * this.listFrame, never page-wide — per this repo's safety rule for
   * delete/cancel confirmations.
   */
  async confirmCancelYes() {
    const popup = this.listFrame.locator('#ctl00_pcConfirmCancel_PW-1');
    await popup.waitFor({ state: 'visible', timeout: 45000 });

    const { locator: yesButton } = await heal(this.listFrame, {
      id: 'purchaseOrder.cancelConfirmYesButton',
      label: 'Yes',
      strategies: [
        { type: 'css', value: '#ctl00_pcConfirmCancel_btnYesCancel_CD' },
        { type: 'css', value: '[id*="pcConfirmCancel" i][id*="btnYesCancel_CD" i]' },
      ],
      timeout: 5000,
    });
    await yesButton.click();
    await popup.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await this.page.waitForTimeout(1000);
  }

  /**
   * Handles a "Cancel Reason" popup if one appears — CONFIRMED on Purchase
   * Return to be a required second step after confirmCancelYes() (see
   * PurchaseReturnPage's own handleCancelReasonIfPresent()). Presence
   * check, not an assumption it always appears — Cash Purchase/Purchase
   * Invoice/Goods Receive never showed it. Picks the first available
   * reason (any valid one is fine for test purposes) via the same
   * `cbReason` combo shape, scoped generically (module id prefix not yet
   * confirmed for this screen specifically) rather than hardcoded to
   * Purchase Return's own "PurchaseReturns1" prefix.
   */
  async handleCancelReasonIfPresent() {
    const popup = this.listFrame.locator('[id*="pcCancelReason" i][id$="_PW-1" i]');
    const present = await popup.first().waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    if (!present) return;

    const { locator: reasonTrigger } = await heal(this.listFrame, {
      id: 'purchaseOrder.cancelReasonTrigger',
      label: 'Reason',
      strategies: [
        { type: 'css', value: '[id*="pcCancelReason" i][id*="cbReason_B-1Img" i]' },
      ],
      timeout: 5000,
    });
    await reasonTrigger.click();
    await this.page.waitForTimeout(800);

    const firstOption = this.listFrame.locator('[id*="pcCancelReason" i][id*="cbReason_DDD_L_LBI" i]:visible').first();
    await firstOption.waitFor({ state: 'visible', timeout: 10000 });
    await firstOption.click();
    await this.page.waitForTimeout(500);

    const { locator: okButton } = await heal(this.listFrame, {
      id: 'purchaseOrder.cancelReasonOkButton',
      label: 'OK',
      strategies: [
        { type: 'css', value: '[id*="pcCancelReason" i][id*="btnCancelDocument_CD" i]' },
      ],
      timeout: 5000,
    });
    await okButton.click();
    await popup.first().waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await this.page.waitForTimeout(1000);
  }

  /**
   * Full flow: search -> click row's Cancel icon -> confirm Yes -> handle
   * the Cancel Reason popup if it appears.
   *
   * Gives Post's trailing async work (GST report generation) time to
   * settle before returning to the listing, since this method is meant to
   * run right after a fresh Post in the same session — same reasoning as
   * CashPurchasePage.cancelDocument().
   */
  async cancelDocument(searchText) {
    await this.page.waitForTimeout(8000);
    await this.goto();
    await this.searchListing(searchText);
    await this.clickCancelIcon(searchText);
    await this.confirmCancelYes();
    await this.handleCancelReasonIfPresent();
  }

  /**
   * Read-only check: is a row matching searchText still present in the
   * default (DRAFT + POSTED, no Cancel status) listing view? Used to
   * verify a cancelled document is genuinely gone from the active list —
   * per this repo's "confirm it deletes it again" convention — not just
   * that confirmCancelYes() completed without error. Deliberately does
   * NOT reuse searchListing(), which throws when nothing matches — here
   * "nothing matches" is the expected, successful outcome.
   */
  async isDocumentPresent(searchText) {
    await this._resolveListFrame();
    const { locator: filterBox } = await heal(this.listFrame, {
      id: 'purchaseOrder.listingSearchFilterBox',
      label: 'Search',
      strategies: [
        { type: 'css', value: '[id*="FilterTextBoxGridView_txtFilterGridView_I" i]' },
      ],
      timeout: 5000,
    });
    await filterBox.click({ clickCount: 3 });
    await filterBox.pressSequentially(searchText, { delay: 60 });
    await filterBox.press('Space');
    await filterBox.press('Backspace');
    await this.page.waitForTimeout(2000);

    const row = this.listFrame.locator('tr.dxgvDataRow_iOS').filter({ hasText: searchText });
    return (await row.count().catch(() => 0)) > 0;
  }
}

module.exports = { PurchaseOrderPage };
