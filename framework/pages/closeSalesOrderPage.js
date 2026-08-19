const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Sales > Close Sales Order.
 *
 * SOURCE: no recording available — built by live-probing the real app
 * directly (2026-08-19), using a throwaway Node script (playwright-cli hit
 * repeated session timeouts on this screen — the multi-step manual
 * exploration took longer between actual server round-trips than this
 * server's own idle-session timeout tolerates). Same overall shape as
 * ClosePurchaseOrderPage: New -> select Customer -> Copy From -> "Transfer
 * from SO" dialog (Full Transfer tab, checkbox-select one row, OK) ->
 * Sales Branch + Warehouse + Reference No + Items all auto-fill from that
 * Sales Order -> Post. Internal control root "CancelSalesOrderDetail" /
 * "cbpCancelSalesOrder" (the app's own internal name for this screen is
 * "CancelSalesOrder", not "CloseSalesOrder" — same naming mismatch already
 * confirmed for Close Purchase Order / "CancelPurchaseOrder"). Document
 * prefix "XS-".
 *
 * CONFIRMED live, two real gotchas specific to this screen:
 *
 * 1. "Copy From"'s dropdown ("Sales Order" is the only source, since
 *    that's the only thing this screen closes) does NOT open on a plain
 *    click OR a hover of the parent button — both were tried and
 *    confirmed live to leave the `<li title="Sales Order">` menu item
 *    genuinely not-visible (Playwright's own actionability check timed
 *    out both ways). A direct DOM `el.click()` on that menu item DOES
 *    work — confirmed live it opens the real "Transfer from SO" dialog
 *    populated with genuine live data (not a false positive), and the
 *    subsequent OK/Post flow completes for real. Unlike the Purchase
 *    module's own documented "force-click hits the wrong overlay element"
 *    class of failure, this is a case of the RIGHT element accepting a
 *    direct DOM click when neither real-mouse-click nor hover reach it —
 *    kept as the confirmed-necessary approach here, not a shortcut around
 *    an unrelated problem.
 * 2. Post does NOT auto-open a report tab (unlike almost every other
 *    screen in this module) — confirmed live via a screenshot showing a
 *    genuinely POSTED document (Document No. changed from "[DEFAULT]" to
 *    a real "XS-XXXXX", Status field showing "POSTED") with the toolbar's
 *    Post button replaced by a "Preview Report" button instead of any
 *    auto-opened tab. expectPostSuccess() therefore checks the Document
 *    No. field directly for a real "XS-" value, same class of signal
 *    CashSalesPage.expectPostSuccess() already uses for the same reason.
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable across navigations — always re-resolved via findFrame() by
 * content, never hardcoded.
 */
class CloseSalesOrderPage {
  constructor(page) {
    this.page = page;
    this.listFrame = null;
    this.formFrame = null;
  }

  async goto() {
    const p = this.page;
    const navBar = p.locator('#navBar');
    const closeSoLink = navBar.getByRole('link', { name: 'Close Sales Order', exact: true });
    const alreadyExpanded = await closeSoLink.isVisible().catch(() => false);
    if (!alreadyExpanded) {
      await navBar.getByRole('link', { name: 'Sales', exact: true }).click();
    }
    await closeSoLink.click();
    await p.waitForLoadState('domcontentloaded');
    await p.waitForTimeout(2000);
    await this._resolveListFrame();
  }

  async _resolveListFrame() {
    const p = this.page;
    this.listFrame = await findFrame(p, async (frame) => {
      const company = frame.getByText('Company:', { exact: false });
      const posted = frame.getByText('POSTED', { exact: false });
      if ((await company.count().catch(() => 0)) === 0) return false;
      if ((await posted.count().catch(() => 0)) === 0) return false;
      return await company.first().isVisible().catch(() => false);
    });
    if (!this.listFrame) {
      await p.screenshot({ path: 'test-results/debug-close-sales-order-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Close Sales Order listing frame. ' +
        'Saved test-results/debug-close-sales-order-list-page.png for inspection.'
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
      await p.screenshot({ path: 'test-results/debug-close-sales-order-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Close Sales Order create/edit form frame. ' +
        'Saved test-results/debug-close-sales-order-form-not-found.png for inspection.'
      );
    }
  }

  async clickNew() {
    const addIcon = this.listFrame.getByRole('img', { name: /Click Here Or Press \[Insert\]/i }).first();
    await addIcon.waitFor({ state: 'visible', timeout: 5000 });
    await addIcon.click();
    await this._resolveFormFrame();
  }

  /** Same `cbSelectCust` customer search-popup shape confirmed across the Sales module. */
  async selectCustomer(customerCode) {
    const f = this.formFrame;
    const { locator: trigger } = await heal(f, {
      id: 'closeSalesOrder.customerTrigger',
      label: 'Customer',
      strategies: [
        { type: 'css', value: '[id$="cbCustomer_cbSelectCust_B1Img" i]' },
        { type: 'css', value: '[id*="cbSelectCust" i][id$="B1Img" i]' },
      ],
      timeout: 5000,
    });
    await trigger.click();

    const popupFrame = (await findFrame(this.page, async (frame) => {
      const cell = frame.getByRole('cell', { name: customerCode, exact: true });
      return (await cell.count()) > 0;
    }, { timeout: 10000 })) || f;

    const customerCell = popupFrame.getByRole('cell', { name: customerCode, exact: true });
    await customerCell.first().waitFor({ state: 'visible', timeout: 10000 });
    await customerCell.first().click();

    const { locator: okButton } = await heal(popupFrame, {
      id: 'closeSalesOrder.customerPopupOkButton',
      label: 'OK',
      strategies: [
        { type: 'css', value: '[id*="cbSelectCust" i][id*="GeneralSearchControl" i][id$="btnOk_CD" i]' },
      ],
      timeout: 5000,
    });
    await okButton.click();
  }

  /**
   * Clicks "Copy From" then the "Sales Order" submenu item. CONFIRMED
   * live: this screen's dropdown menu (only one source — "Sales Order")
   * does NOT open on a plain click or hover of the parent button; a
   * direct DOM `el.click()` on the menu item does work and reaches the
   * real handler (see class comment for the full confirmation).
   */
  async clickCopyFromSalesOrder() {
    const f = this.formFrame;
    const { locator: copyFromButton } = await heal(f, {
      id: 'closeSalesOrder.copyFromButton',
      label: 'Copy From',
      strategies: [
        { type: 'css', value: '[title="Copy From [Alt + M]"]' },
      ],
      timeout: 5000,
    });
    await copyFromButton.first().click();
    await this.page.waitForTimeout(500);

    const dialogAlreadyOpen = await f.getByText('Transfer from SO', { exact: false })
      .first().isVisible().catch(() => false);
    if (dialogAlreadyOpen) return;

    const menuItem = f.locator('li[title="Sales Order"]');
    await menuItem.first().evaluate((el) => el.click());
    await this.page.waitForTimeout(1000);
  }

  /**
   * Checks the given SO's row in the "Transfer from SO" dialog (Full
   * Transfer tab, selected by default) and confirms with the dialog's own
   * OK. Same row-scoping fix already applied throughout this module.
   */
  async selectSalesOrderToTransfer(soDocNo) {
    const f = this.formFrame;
    await f.getByText('Transfer from SO', { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 });

    const targetRow = f.locator('tr.dxgvDataRow_iOS').filter({ hasText: soDocNo });
    await targetRow.first().waitFor({ state: 'visible', timeout: 10000 });
    await targetRow.first().locator('td.dxgvCommandColumn_iOS').first().click();
    await this.page.waitForTimeout(500);

    const { locator: okButton } = await heal(f, {
      id: 'closeSalesOrder.transferOkButton',
      label: 'OK',
      strategies: [
        { type: 'css', value: '[id$="btnPurchaseTransferOk_CD" i]' },
        { type: 'css', value: '[id$="btnSalesTransferOk_CD" i]' },
        { type: 'css', value: '[id$="btnTransferOk_CD" i]' },
      ],
      timeout: 5000,
    });
    await okButton.click();
    await this.page.waitForTimeout(1500);
  }

  /** Full flow: select customer, transfer from the given SO, Post. Sales Branch/Warehouse/Reference No/Items all auto-fill from the transferred SO. */
  async closeSalesOrder({ customerCode, soDocNo }) {
    await this.selectCustomer(customerCode);
    await this.clickCopyFromSalesOrder();
    await this.selectSalesOrderToTransfer(soDocNo);
    await this.clickPost();
  }

  /**
   * Clicks Post. CONFIRMED live: no report tab auto-opens for this screen
   * (see class comment) — the completion signal is the Document No. field
   * itself changing to a real value, checked by expectPostSuccess().
   */
  async clickPost() {
    const { locator } = await heal(this.formFrame, {
      id: 'closeSalesOrder.postButton',
      label: 'Post',
      strategies: [
        { type: 'css', value: '[title="Post [Alt + P]"]' },
        { type: 'text', value: 'Post', options: { exact: true } },
      ],
      timeout: 5000,
    });
    await locator.click();
    // Same class of "posting isn't instant" timing already documented
    // throughout this repo — confirmed live this needs several seconds.
    await this.page.waitForTimeout(5000);
  }

  /**
   * Checks whether the document actually posted. CONFIRMED live: unlike
   * almost every other screen in this module, Post does NOT auto-open a
   * report tab here — the real, confirmed signal is the Document No.
   * field's own value changing from "[DEFAULT]" to a real "XS-XXXXX"
   * (same class of check CashSalesPage.expectPostSuccess() already uses
   * for the same reason, just a plain visible field here rather than a
   * hidden one).
   */
  async expectPostSuccess() {
    const docNoField = this.formFrame.locator('[id$="txtDocNo_I" i]');
    const value = await docNoField.first().inputValue().catch(() => '');
    return /XS-\d+/.test(value);
  }

  /**
   * Reads the posted document's own number directly from the Document No.
   * field (see expectPostSuccess()'s comment on why this screen needs its
   * own approach rather than reading an auto-opened report).
   */
  async getPostedDocumentNumber() {
    const docNoField = this.formFrame.locator('[id$="txtDocNo_I" i]');
    const value = await docNoField.first().inputValue().catch(() => '');
    const match = value.match(/XS-\d+/);
    return match ? match[0] : null;
  }

  /**
   * Fills the listing grid's own live-filter textbox and waits for a
   * genuine matching row before returning.
   */
  async searchListing(searchText) {
    await this._resolveListFrame();
    const { locator: filterBox } = await heal(this.listFrame, {
      id: 'closeSalesOrder.listingSearchFilterBox',
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
        path: `test-results/debug-close-sales-order-search-not-found-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `Close Sales Order listing never showed a row matching "${searchText}" after searching — ` +
        'refusing to proceed with Cancel against a possibly-stale/unfiltered row.'
      );
    }
    await this.page.waitForTimeout(300);
  }

  /** Polls until a genuine grid DATA ROW matching the search text is visible AND carries its own "Cancel" row-action icon. */
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

  /** Clicks the matching row's own "Cancel" icon. Scoped to the ONE row matching searchText, never a grid-wide selector. */
  async clickCancelIcon(searchText) {
    const row = this.listFrame.locator('tr.dxgvDataRow_iOS').filter({ hasText: searchText });
    const cancelIcon = row.first().getByRole('img', { name: 'Cancel', exact: true });
    await cancelIcon.waitFor({ state: 'visible', timeout: 15000 });
    await cancelIcon.click({ timeout: 30000 });
  }

  /** Confirms the row-level Cancel action via its own "Cancel Confirmation" dialog (`pcConfirmCancel`, same id root confirmed across this module). */
  async confirmCancelYes() {
    const popup = this.listFrame.locator('#ctl00_pcConfirmCancel_PW-1');
    await popup.waitFor({ state: 'visible', timeout: 45000 });

    const { locator: yesButton } = await heal(this.listFrame, {
      id: 'closeSalesOrder.cancelConfirmYesButton',
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

  /** Handles a "Cancel Reason" popup if one appears — presence check, not an assumption it always appears. */
  async handleCancelReasonIfPresent() {
    const popup = this.listFrame.locator('[id*="pcCancelReason" i][id$="_PW-1" i]');
    const present = await popup.first().waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    if (!present) return;

    const { locator: reasonTrigger } = await heal(this.listFrame, {
      id: 'closeSalesOrder.cancelReasonTrigger',
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
      id: 'closeSalesOrder.cancelReasonOkButton',
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

  /** Full flow: search -> click row's Cancel icon -> confirm Yes -> handle the Cancel Reason popup if it appears. */
  async cancelDocument(searchText) {
    await this.page.waitForTimeout(8000);
    await this.goto();
    await this.searchListing(searchText);
    await this.clickCancelIcon(searchText);
    await this.confirmCancelYes();
    await this.handleCancelReasonIfPresent();
  }

  /** Read-only check: is a row matching searchText still present in the default (DRAFT + POSTED, no Cancel status) listing view? */
  async isDocumentPresent(searchText) {
    await this._resolveListFrame();
    const { locator: filterBox } = await heal(this.listFrame, {
      id: 'closeSalesOrder.listingSearchFilterBox',
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

module.exports = { CloseSalesOrderPage };
