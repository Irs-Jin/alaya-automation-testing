const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Purchase > Close Purchase Order.
 *
 * SOURCE: built from a screen recording the user provided (Close Purchase
 * Order Flow 1, 2026-08-17) showing New -> select Vendor -> Copy From >
 * Purchase Order -> "Transfer from PO" dialog (Full Transfer tab, check
 * one existing open PO's row, OK) -> Warehouse + Items auto-fill from that
 * PO -> Post -> auto-opened ClosePurchaseOrderSummaryGST Report tab. Every
 * selector was then CONFIRMED live (2026-08-17) via a throwaway diagnostic
 * script, not guessed from the recording.
 *
 * SHAPE: this screen shares the exact same underlying header/vendor/items
 * control as PurchaseOrderPage (confirmed live: its Vendor field is
 * literally the same "PurchaseOrderDetail1...cbVendor" control, same ids),
 * plus its own "Transfer from PO" control (root id prefix
 * "CancelPurchaseOrderDetail1...TransferFrom" — the app's internal name
 * for this screen is "CancelPurchaseOrder", not "ClosePurchaseOrder").
 *
 * IMPORTANT — test independence: closing a PO consumes it (it stops
 * appearing as "open" in Transfer from PO afterward), so a repeatable test
 * cannot just pick an arbitrary existing PO from the shared environment —
 * it might already be closed, or get closed by someone else's test.
 * selectPurchaseOrderToTransfer() is designed to target a doc number the
 * CALLER supplies — the spec is expected to create+post a fresh
 * PurchaseOrderPage document first (via getPostedDocumentNumber()) and
 * transfer from THAT, guaranteeing a valid, not-yet-closed target every
 * run, rather than depending on shared/pre-existing data.
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable across navigations — always re-resolved via findFrame() by
 * content, never hardcoded.
 */
class ClosePurchaseOrderPage {
  constructor(page) {
    this.page = page;
    this.listFrame = null;
    this.formFrame = null;
  }

  async goto() {
    const p = this.page;
    // BUG FIXED (2026-08-17): clicking "Purchase" TOGGLES its submenu
    // open/closed rather than idempotently opening it — confirmed live
    // via a failure screenshot showing the Purchase submenu COLLAPSED
    // (not expanded) after this click, because a prior PurchaseOrderPage
    // navigation earlier in the same test had already expanded it. Only
    // click it if the target link isn't already visible.
    //
    // BUG FIXED (2026-08-18): scoped to #navBar (the actual left-nav
    // sidebar), same fix already applied to CashPurchasePage's goto() —
    // needed since cancelDocument() navigates back to this listing after
    // Post, and the unscoped locator becomes ambiguous the second time
    // goto() runs (the already-open browser tab's own label also matches
    // getByRole('link', {name: 'Close Purchase Order', exact:true})).
    const navBar = p.locator('#navBar');
    const closePoLink = navBar.getByRole('link', { name: 'Close Purchase Order', exact: true });
    const alreadyExpanded = await closePoLink.isVisible().catch(() => false);
    if (!alreadyExpanded) {
      await navBar.getByRole('link', { name: 'Purchase', exact: true }).click();
    }
    await closePoLink.click();
    // BUG FIXED (2026-08-17): 'networkidle' was confirmed live to hang
    // indefinitely once other in-app tabs (e.g. a Purchase Order tab and
    // its auto-opened GST report) are already open in the background —
    // their own residual activity seems to keep the page from ever
    // reaching network-idle. 'domcontentloaded' + a short settle wait,
    // same pattern already used elsewhere in this repo, avoids it.
    await p.waitForLoadState('domcontentloaded');
    await p.waitForTimeout(2000);
    await this._resolveListFrame();
  }

  async _resolveListFrame() {
    const p = this.page;
    this.listFrame = await findFrame(p, async (frame) => {
      // "Company:" + "POSTED" together (not "Company:" alone — that also
      // matches this app's left-nav menu frame) AND visible — Purchase
      // Order's own listing screen has the exact same two markers, so a
      // Purchase Order list tab left open in the background would
      // otherwise false-match here too (confirmed live during the probe
      // that built this page object).
      const company = frame.getByText('Company:', { exact: false });
      const posted = frame.getByText('POSTED', { exact: false });
      if ((await company.count().catch(() => 0)) === 0) return false;
      if ((await posted.count().catch(() => 0)) === 0) return false;
      return await company.first().isVisible().catch(() => false);
    });
    if (!this.listFrame) {
      await p.screenshot({ path: 'test-results/debug-close-purchase-order-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Close Purchase Order listing frame. ' +
        'Saved test-results/debug-close-purchase-order-list-page.png for inspection.'
      );
    }
  }

  async _resolveFormFrame() {
    const p = this.page;
    this.formFrame = await findFrame(p, async (frame) => {
      const marker = frame.getByText('Next Possible No', { exact: false });
      if ((await marker.count().catch(() => 0)) === 0) return false;
      return await marker.first().isVisible().catch(() => false);
    });
    if (!this.formFrame) {
      await p.screenshot({ path: 'test-results/debug-close-purchase-order-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Close Purchase Order create/edit form frame. ' +
        'Saved test-results/debug-close-purchase-order-form-not-found.png for inspection.'
      );
    }
  }

  async clickNew() {
    const addIcon = this.listFrame.getByRole('img', { name: /Click Here Or Press \[Insert\]/i }).first();
    await addIcon.waitFor({ state: 'visible', timeout: 5000 });
    await addIcon.click();
    await this._resolveFormFrame();
  }

  /** Same Vendor search-popup control as PurchaseOrderPage (confirmed live: identical ids). */
  async selectVendor(vendorCode) {
    const f = this.formFrame;
    const { locator: trigger } = await heal(f, {
      id: 'closePurchaseOrder.vendorTrigger',
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
      id: 'closePurchaseOrder.vendorPopupOkButton',
      label: 'OK',
      strategies: [
        { type: 'css', value: '[id$="cbVendor_gsc_cbVendor_pcGeneralSearchControl_cpnlGeneralSearchControl_formGeneralSearchControl_btnOk_CD" i]' },
      ],
      timeout: 5000,
    });
    await okButton.click();
  }

  /**
   * Clicks "Copy From" then "Purchase Order". CONFIRMED live: with only
   * one PO available to copy from, clicking "Copy From" opened the
   * "Transfer from PO" dialog directly, with no separate visible menu
   * item to click afterward — so this checks for the dialog first and
   * only falls back to clicking the "Purchase Order" menu item (the same
   * "multiple hidden dx-vam clones, only one genuinely visible" pattern
   * already documented for Cash Sales/Purchase Order's own OK/Yes
   * buttons) if the dialog didn't already open on its own.
   */
  async clickCopyFromPurchaseOrder() {
    const f = this.formFrame;
    const { locator: copyFromButton } = await heal(f, {
      id: 'closePurchaseOrder.copyFromButton',
      label: 'Copy From',
      strategies: [
        { type: 'css', value: '[title="Copy From [Alt + M]"]' },
      ],
      timeout: 5000,
    });
    await copyFromButton.click();
    await this.page.waitForTimeout(800);

    const dialogAlreadyOpen = await f.getByText('Transfer from PO', { exact: false })
      .first().isVisible().catch(() => false);
    if (dialogAlreadyOpen) return;

    const menuItem = f.locator('span.dx-vam:visible:text-is("Purchase Order")');
    await menuItem.first().click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Checks the given PO's row in the "Transfer from PO" dialog (Full
   * Transfer tab, selected by default) and confirms with the dialog's own
   * OK. Scoped to the row's own checkbox cell rather than the row itself —
   * confirmed live that matching by getByRole('row', {name: poDocNo})
   * produced 4 ambiguous matches for what should be a unique doc number
   * (likely counting nested/virtualized duplicates), and clicking the
   * wrong one left nothing actually selected (a real "Please select at
   * least 1 document" error was reproduced this way). Filtering
   * `tr.dxgvDataRow_iOS` by text content, then clicking that row's own
   * `td.dxgvCommandColumn_iOS` checkbox cell, resolved unambiguously.
   */
  async selectPurchaseOrderToTransfer(poDocNo) {
    const f = this.formFrame;
    await f.getByText('Transfer from PO', { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 });

    const targetRow = f.locator('tr.dxgvDataRow_iOS').filter({ hasText: poDocNo });
    await targetRow.first().waitFor({ state: 'visible', timeout: 10000 });
    await targetRow.first().locator('td.dxgvCommandColumn_iOS').first().click();
    await this.page.waitForTimeout(500);

    const { locator: okButton } = await heal(f, {
      id: 'closePurchaseOrder.transferOkButton',
      label: 'OK',
      strategies: [
        { type: 'css', value: '[id$="btnPurchaseTransferOk_CD" i]' },
      ],
      timeout: 5000,
    });
    await okButton.click();
    await this.page.waitForTimeout(1500);
  }

  async clickPost() {
    const { locator } = await heal(this.formFrame, {
      id: 'closePurchaseOrder.postButton',
      label: 'Post',
      strategies: [
        { type: 'css', value: '[title="Post [Alt + P]"]' },
        { type: 'text', value: 'Post', options: { exact: true } },
      ],
      timeout: 5000,
    });
    await locator.click();
    // Waits for the actual report-tab signal rather than guessing a fixed
    // delay, same fix already applied to PurchaseInvoicePage/GoodsReceivePage's
    // own clickPost().
    await this.page.getByText('CancelPurchaseOrderDetailGST Report', { exact: false })
      .first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    await this.page.waitForTimeout(1000);
  }

  /** Full flow: select vendor, transfer from the given PO, Post. */
  async closePurchaseOrder({ vendorCode, poDocNo }) {
    await this.selectVendor(vendorCode);
    await this.clickCopyFromPurchaseOrder();
    await this.selectPurchaseOrderToTransfer(poDocNo);
    await this.clickPost();
  }

  /**
   * Checks whether the document actually posted — same "strongest
   * available proof" approach as PurchaseOrderPage.expectPostSuccess():
   * Post auto-opens a report tab. CORRECTED (2026-08-20): the original
   * qa3-era title ("ClosePurchaseOrderSummaryGST Report") no longer
   * matches under UAT/TANJAK MEGA GROUP SDN BHD — a live failure
   * screenshot showed the real tab is titled "CancelPurchaseOrderDetailGST
   * Report" instead (matching this screen's own internal "CancelPurchaseOrder"
   * naming, already noted elsewhere in this file; Post itself was
   * genuinely succeeding the whole time, only this title string was
   * stale).
   */
  async expectPostSuccess() {
    const reportTab = this.page.getByText('CancelPurchaseOrderDetailGST Report', { exact: false });
    return (await reportTab.count().catch(() => 0)) > 0;
  }

  /**
   * Reads the posted Close Purchase Order's own assigned document number
   * from the auto-opened GST report — CONFIRMED live via screenshot
   * (2026-08-18): the report label is "Purchase Ord. No" (identical text
   * to PurchaseOrderPage's own report), but the assigned number itself
   * uses a DIFFERENT prefix — "XP-XXXXX", not "PO-" or "CPO-" as might be
   * guessed from the screen's display name. Needed as this screen's
   * search key for cancelDocument(), since it has no free-text reference
   * field (matching PurchaseOrderPage.getPostedDocumentNumber()'s own
   * reasoning). Only call this after expectPostSuccess() is true.
   */
  async getClosedDocumentNumber() {
    const reportFrame = await findFrame(this.page, async (frame) => {
      const marker = frame.getByText('Purchase Ord. No', { exact: false });
      if ((await marker.count().catch(() => 0)) === 0) return false;
      return await marker.first().isVisible().catch(() => false);
    }, { timeout: 10000 });
    if (!reportFrame) return null;
    const text = await reportFrame.locator('body').innerText().catch(() => '');
    const match = text.match(/XP-\d+/);
    return match ? match[0] : null;
  }

  /**
   * Fills the listing grid's own live-filter textbox and waits for a
   * genuine matching row before returning — same id suffix
   * (FilterTextBoxGridView_txtFilterGridView_I) and same
   * triple-click-then-pressSequentially convention confirmed across this
   * whole module. Required before clickCancelIcon() so the row we act on
   * is provably the one we searched for.
   */
  async searchListing(searchText) {
    await this._resolveListFrame();
    const { locator: filterBox } = await heal(this.listFrame, {
      id: 'closePurchaseOrder.listingSearchFilterBox',
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
        path: `test-results/debug-close-purchase-order-search-not-found-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `Close Purchase Order listing never showed a row matching "${searchText}" after searching — ` +
        'refusing to proceed with Cancel against a possibly-stale/unfiltered row.'
      );
    }
    await this.page.waitForTimeout(300);
  }

  /**
   * Polls until a genuine grid DATA ROW matching the search text is
   * visible AND carries its own "Cancel" row-action icon — proof this is
   * a real filtered data row, not the filter textbox's own wrapping cell.
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
   * Clicks the matching row's own "Cancel" icon. Scoped to the ONE row
   * matching searchText, never a grid-wide selector, per this repo's
   * safety rule for delete/cancel actions.
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
   * Purchase/Purchase Invoice/Goods Receive/Purchase Return/Purchase
   * Order). Scoped to this.listFrame, never page-wide.
   */
  async confirmCancelYes() {
    const popup = this.listFrame.locator('#ctl00_pcConfirmCancel_PW-1');
    await popup.waitFor({ state: 'visible', timeout: 45000 });

    const { locator: yesButton } = await heal(this.listFrame, {
      id: 'closePurchaseOrder.cancelConfirmYesButton',
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
   * Handles a "Cancel Reason" popup if one appears — CONFIRMED required on
   * Purchase Return (see PurchaseReturnPage's own
   * handleCancelReasonIfPresent()); presence check here, not an assumption
   * it always appears.
   */
  async handleCancelReasonIfPresent() {
    const popup = this.listFrame.locator('[id*="pcCancelReason" i][id$="_PW-1" i]');
    const present = await popup.first().waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    if (!present) return;

    const { locator: reasonTrigger } = await heal(this.listFrame, {
      id: 'closePurchaseOrder.cancelReasonTrigger',
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
      id: 'closePurchaseOrder.cancelReasonOkButton',
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
   * settle before returning to the listing, same reasoning as
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
   * per this repo's "confirm it deletes it again" convention.
   */
  async isDocumentPresent(searchText) {
    await this._resolveListFrame();
    const { locator: filterBox } = await heal(this.listFrame, {
      id: 'closePurchaseOrder.listingSearchFilterBox',
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

module.exports = { ClosePurchaseOrderPage };
