const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Sales > Sales Invoice.
 *
 * SOURCE: no recording available — built by live-probing the real app
 * directly (2026-08-19) via a throwaway Node script. Same overall shape as
 * DeliveryReturnPage: New -> select Customer -> Copy From -> "Delivery
 * Order" menu item -> "Transfer from DO" dialog (Full Transfer tab,
 * checkbox-select one row, OK) -> Sales Branch + Warehouse + Reference No +
 * Items all auto-fill -> Post. Internal form header reads "Sales Header",
 * document prefix "IV-".
 *
 * CONFIRMED live, things worth flagging:
 * 1. Copy From opens a MENU with several source types (Purchase Order,
 *    Sales Quotation, Sales Order, Delivery Order, Cash Sales, Cash
 *    Purchase, ...) — "Delivery Order" is the one used here, matching the
 *    natural "bill what was delivered" flow. Same direct-DOM-click
 *    technique confirmed necessary on Close Sales Order/Delivery Return
 *    used for both the Copy From button and the submenu item.
 * 2. Unlike Delivery Return, the New-record insert icon here DOES have a
 *    proper `alt` attribute — plain `getByRole('img', {name: ...})`
 *    matching works fine, no title-based fallback needed.
 * 3. No Delivery Address requirement (confirmed live: Post succeeds right
 *    after the transfer, no Logistics-tab fields touched).
 * 4. "Save Draft" is not available once a Transfer From has completed
 *    (same pattern confirmed throughout this module) — Post is the only
 *    way to persist a real document here.
 * 5. Post does NOT auto-open a report tab (confirmed live: same
 *    report-less shape as Close Sales Order/Delivery Return) — success and
 *    document number are both read directly from the Document No. field
 *    (`txtDocNo_I`).
 * 6. CONFIRMED live: right after clicking Post, the Document No. field can
 *    still briefly read "[DEFAULT]" (server still processing under load,
 *    same class of slow-render-under-load already documented repo-wide) —
 *    don't treat a single fast read as authoritative; give it a real wait
 *    before checking, same as every other Post-completion signal in this
 *    repo.
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable across navigations — always re-resolved via findFrame() by
 * content, never hardcoded.
 */
class SalesInvoicePage {
  constructor(page) {
    this.page = page;
    this.listFrame = null;
    this.formFrame = null;
  }

  async goto() {
    const p = this.page;
    const navBar = p.locator('#navBar');
    const link = navBar.getByRole('link', { name: 'Sales Invoice', exact: true });
    const alreadyExpanded = await link.isVisible().catch(() => false);
    if (!alreadyExpanded) {
      await navBar.getByRole('link', { name: 'Sales', exact: true }).click();
    }
    await link.click();
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
      await p.screenshot({ path: 'test-results/debug-sales-invoice-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Sales Invoice listing frame. ' +
        'Saved test-results/debug-sales-invoice-list-page.png for inspection.'
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
      await p.screenshot({ path: 'test-results/debug-sales-invoice-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Sales Invoice create/edit form frame. ' +
        'Saved test-results/debug-sales-invoice-form-not-found.png for inspection.'
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
      id: 'salesInvoice.customerTrigger',
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
      id: 'salesInvoice.customerPopupOkButton',
      label: 'OK',
      strategies: [
        { type: 'css', value: '[id*="cbSelectCust" i][id*="GeneralSearchControl" i][id$="btnOk_CD" i]' },
      ],
      timeout: 5000,
    });
    await okButton.click();
  }

  /**
   * Clicks "Copy From" -> "Delivery Order" submenu item. CONFIRMED live:
   * both clicks need a direct DOM `.evaluate(el => el.click())` — same
   * confirmed-necessary technique as Close Sales Order/Delivery Return's
   * own Copy From submenus.
   */
  async clickCopyFromDeliveryOrder() {
    const f = this.formFrame;
    const { locator: copyFromButton } = await heal(f, {
      id: 'salesInvoice.copyFromButton',
      label: 'Copy From',
      strategies: [
        { type: 'css', value: '[title="Copy From [Alt + M]"]' },
      ],
      timeout: 5000,
    });
    await copyFromButton.first().evaluate((el) => el.click());
    await this.page.waitForTimeout(1000);

    const menuItem = f.locator('span.dx-vam:text-is("Delivery Order")');
    await menuItem.first().evaluate((el) => el.click());
    await this.page.waitForTimeout(1500);
  }

  /**
   * Checks the given DO's row in the "Transfer from DO" dialog (Full
   * Transfer tab, selected by default) and confirms with the dialog's own
   * OK. Same row-scoping fix already applied throughout this module.
   */
  async selectDeliveryOrderToTransfer(doDocNo) {
    const f = this.formFrame;
    await f.getByText('Transfer from DO', { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 });

    const targetRow = f.locator('tr.dxgvDataRow_iOS').filter({ hasText: doDocNo });
    await targetRow.first().waitFor({ state: 'visible', timeout: 10000 });
    await targetRow.first().locator('td.dxgvCommandColumn_iOS').first().click();
    await this.page.waitForTimeout(500);

    const { locator: okButton } = await heal(f, {
      id: 'salesInvoice.transferOkButton',
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

  /** Full flow: select customer, transfer from the given DO. No Delivery Address needed for this screen (confirmed live). Post is the caller's own next step. */
  async prepareSalesInvoice({ customerCode, doDocNo }) {
    await this.selectCustomer(customerCode);
    await this.clickCopyFromDeliveryOrder();
    await this.selectDeliveryOrderToTransfer(doDocNo);
  }

  /** CONFIRMED live: no auto-opened report tab — just waits for the server round trip to settle before the caller checks the Document No. field. */
  async clickPost() {
    const { locator } = await heal(this.formFrame, {
      id: 'salesInvoice.postButton',
      label: 'Post',
      strategies: [
        { type: 'css', value: '[title="Post [Alt + P]"]' },
        { type: 'text', value: 'Post', options: { exact: true } },
      ],
      timeout: 5000,
    });
    await locator.click();
    // CONFIRMED live: the Document No. field can still briefly read
    // "[DEFAULT]" right after this click (server still processing) — give
    // it a real wait, not just a few seconds, before the caller checks it.
    await this.page.waitForTimeout(6000);
  }

  /** "Post & New" doesn't open a report tab either — waits for the form to genuinely reset instead. */
  async clickPostAndNew() {
    const { locator } = await heal(this.formFrame, {
      id: 'salesInvoice.postAndNewButton',
      label: 'Post & New',
      strategies: [
        { type: 'css', value: '[title="Post & New [Alt + Ctrl + P]"]' },
        { type: 'text', value: 'Post & New', options: { exact: true } },
      ],
      timeout: 5000,
    });
    await locator.click();
    const customerField = this.formFrame.locator('[id$="cbCustomer_cbSelectCust_I" i]');
    await customerField.first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    await this.page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        return el && el.value.trim() === '';
      },
      '[id$="cbCustomer_cbSelectCust_I"]',
      { timeout: 20000 }
    ).catch(() => {});
  }

  /** CONFIRMED live: no auto-opened report tab for this screen — reads the Document No. field directly, same convention as CloseSalesOrderPage/DeliveryReturnPage. */
  async expectPostSuccess() {
    const docNoField = this.formFrame.locator('[id$="txtDocNo_I" i]');
    const value = await docNoField.first().inputValue().catch(() => '');
    return /IV-\d+/.test(value);
  }

  /** Reads the posted document's own number directly from the Document No. field. Only call this after expectPostSuccess() is true. */
  async getPostedDocumentNumber() {
    const docNoField = this.formFrame.locator('[id$="txtDocNo_I" i]');
    const value = await docNoField.first().inputValue().catch(() => '');
    const match = value.match(/IV-\d+/);
    return match ? match[0] : null;
  }

  /** Checks the form reset to a blank state after "Post & New". */
  async expectFormReset() {
    const customerField = this.formFrame.locator('[id$="cbCustomer_cbSelectCust_I" i]');
    const value = await customerField.first().inputValue().catch(() => 'unknown');
    return value.trim() === '';
  }

  /** Fills the listing grid's own live-filter textbox and waits for a genuine matching row before returning. */
  async searchListing(searchText) {
    await this._resolveListFrame();
    const { locator: filterBox } = await heal(this.listFrame, {
      id: 'salesInvoice.listingSearchFilterBox',
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
        path: `test-results/debug-sales-invoice-search-not-found-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `Sales Invoice listing never showed a row matching "${searchText}" after searching — ` +
        'refusing to proceed with Cancel against a possibly-stale/unfiltered row.'
      );
    }
    await this.page.waitForTimeout(300);
  }

  /**
   * Polls until a genuine grid DATA ROW matching the search text is
   * visible, carries its own "Cancel" row-action icon, AND is the ONLY row
   * in the grid.
   *
   * CONFIRMED live (2026-08-19, Sales Order): checking only "a matching
   * row exists" isn't enough on a listing with real clutter (leftover
   * documents from other, non-cleaning-up tests run earlier the same day)
   * — the live-filter textbox's own async callback can still be narrowing
   * the grid down from many rows to one when clickCancelIcon() fires.
   * Clicking a row's Cancel icon while that callback is mid-flight can
   * silently lose the click (the callback's response replaces the grid's
   * HTML, including the just-clicked row, before the server round-trip for
   * that click completes) — the confirm dialog still opens and "Yes" still
   * closes it, but nothing actually gets cancelled. Requiring the grid to
   * have narrowed to exactly this one row proves the callback has settled.
   */
  async _waitForListingRowMatching(searchText, timeout = 15000) {
    const allRows = this.listFrame.locator('tr.dxgvDataRow_iOS');
    const row = allRows.filter({ hasText: searchText });
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if ((await allRows.count().catch(() => 0)) === 1
        && (await row.count().catch(() => 0)) === 1
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
    // CONFIRMED live (2026-08-19) on QuotationPage's own copy of this method:
    // clicking Yes immediately once the popup is merely "visible" (non-zero
    // size, not display:none) can silently no-op — the popup's own
    // DevExpress click handler isn't wired up until slightly after the
    // fade-in animation completes. Applied here defensively too since this
    // is the identical dialog/markup.
    await this.page.waitForTimeout(500);

    const { locator: yesButton } = await heal(this.listFrame, {
      id: 'salesInvoice.cancelConfirmYesButton',
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
      id: 'salesInvoice.cancelReasonTrigger',
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
      id: 'salesInvoice.cancelReasonOkButton',
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
      id: 'salesInvoice.listingSearchFilterBox',
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

module.exports = { SalesInvoicePage };
