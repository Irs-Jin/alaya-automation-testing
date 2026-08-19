const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Sales > Delivery Order.
 *
 * SOURCE: no recording available — built by live-probing the real app
 * directly (2026-08-19) via a throwaway Node script. Same overall shape as
 * GoodsReturnPage: New -> select Customer -> Copy From -> "Transfer from
 * SQ" dialog (Full Transfer tab, checkbox-select one row, OK) -> Sales
 * Branch + Warehouse + Reference No + Items all auto-fill -> fill Delivery
 * Address (Logistics tab) -> Post. Internal control root
 * "DeliveryOrderDetail"/"cbpDeliveryOrder", document prefix "DO-".
 *
 * CONFIRMED live, two things worth flagging:
 * 1. Transfers from a POSTED QUOTATION ("Transfer from SQ"), NOT a Sales
 *    Order — confirmed live the dialog opens directly (single source, no
 *    menu step) once Customer is selected. This is a real gap in the
 *    otherwise linear Quotation -> Sales Order -> Delivery Order cycle:
 *    Delivery Order transfers straight from Quotation, skipping Sales
 *    Order entirely.
 * 2. Delivery Address (Logistics tab) requires BOTH Address1 and
 *    Address3 plus City — same `ucDeliveryAddress` control shape, same id
 *    root, as GoodsReturnPage's own confirmed requirement. City defaults
 *    to "PUCHONG", same reasoning as every other screen with this
 *    control (this company's own registered city).
 * 3. "Save Draft" is not available once a Transfer From has completed
 *    (same pattern already confirmed for Goods Return/Close Sales Order)
 *    — Post is the only way to persist a real document here.
 * 4. Report titled "Delivery Order Detail GST Report" (corrected
 *    2026-08-19 — the original probe misread the tab title; a live failure
 *    screenshot showed the real one), doc-number
 *    label "Delivery Ord. No".
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable across navigations — always re-resolved via findFrame() by
 * content, never hardcoded.
 */
class DeliveryOrderPage {
  constructor(page) {
    this.page = page;
    this.listFrame = null;
    this.formFrame = null;
  }

  async goto() {
    const p = this.page;
    const navBar = p.locator('#navBar');
    const link = navBar.getByRole('link', { name: 'Delivery Order', exact: true });
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
      await p.screenshot({ path: 'test-results/debug-delivery-order-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Delivery Order listing frame. ' +
        'Saved test-results/debug-delivery-order-list-page.png for inspection.'
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
      await p.screenshot({ path: 'test-results/debug-delivery-order-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Delivery Order create/edit form frame. ' +
        'Saved test-results/debug-delivery-order-form-not-found.png for inspection.'
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
      id: 'deliveryOrder.customerTrigger',
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
      id: 'deliveryOrder.customerPopupOkButton',
      label: 'OK',
      strategies: [
        { type: 'css', value: '[id*="cbSelectCust" i][id*="GeneralSearchControl" i][id$="btnOk_CD" i]' },
      ],
      timeout: 5000,
    });
    await okButton.click();
  }

  /**
   * Clicks "Copy From" — CONFIRMED live: with only one source available
   * (Quotation), the "Transfer from SQ" dialog opens directly, no separate
   * menu item to click (same "dialog may open directly" shape already
   * confirmed elsewhere in this repo).
   */
  async clickCopyFromQuotation() {
    const f = this.formFrame;
    const { locator: copyFromButton } = await heal(f, {
      id: 'deliveryOrder.copyFromButton',
      label: 'Copy From',
      strategies: [
        { type: 'css', value: '[title="Copy From [Alt + M]"]' },
      ],
      timeout: 5000,
    });
    await copyFromButton.first().click();
    await this.page.waitForTimeout(800);

    const dialogAlreadyOpen = await f.getByText('Transfer from SQ', { exact: false })
      .first().isVisible().catch(() => false);
    if (dialogAlreadyOpen) return;

    const menuItem = f.locator('span.dx-vam:visible:text-is("Sales Quotation")');
    await menuItem.first().click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Checks the given SQ's row in the "Transfer from SQ" dialog (Full
   * Transfer tab, selected by default) and confirms with the dialog's own
   * OK. Same row-scoping fix already applied throughout this module.
   */
  async selectQuotationToTransfer(sqDocNo) {
    const f = this.formFrame;
    await f.getByText('Transfer from SQ', { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 });

    const targetRow = f.locator('tr.dxgvDataRow_iOS').filter({ hasText: sqDocNo });
    await targetRow.first().waitFor({ state: 'visible', timeout: 10000 });
    await targetRow.first().locator('td.dxgvCommandColumn_iOS').first().click();
    await this.page.waitForTimeout(500);

    const { locator: okButton } = await heal(f, {
      id: 'deliveryOrder.transferOkButton',
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

  /**
   * Fills the required Delivery Address (Logistics tab > Address1 +
   * Address3 + City). CONFIRMED live: Post fails with "Changes not saved
   * because of incomplete required field(s)" without this — same
   * `ucDeliveryAddress` control shape as GoodsReturnPage's own confirmed
   * requirement (BOTH Address1 and Address3 needed, unlike Purchase
   * Return's single-Address1 version of this control). City defaults to
   * "PUCHONG", same reasoning as every other screen with this control.
   */
  async fillDeliveryAddress(address1 = 'TESTING ADDRESS 1', address3 = 'TESTING ADDRESS 3', cityName = 'PUCHONG') {
    const f = this.formFrame;
    await f.getByText('Logistics', { exact: true }).first().click();
    await this.page.waitForTimeout(500);

    const address1Field = f.locator('[id$="txtAddress1_I" i]');
    await address1Field.first().click();
    await address1Field.first().pressSequentially(address1, { delay: 20 });

    const address3Field = f.locator('[id$="txtAddress3_I" i]');
    await address3Field.first().click();
    await address3Field.first().pressSequentially(address3, { delay: 20 });

    const { locator: cityTrigger } = await heal(f, {
      id: 'deliveryOrder.cityTrigger',
      label: 'City',
      strategies: [
        { type: 'css', value: '[id$="cbCity_B0Img" i]' },
      ],
      timeout: 5000,
    });
    await cityTrigger.click();
    await this.page.waitForTimeout(1000);

    const cityCell = f.getByRole('cell', { name: cityName, exact: true });
    await cityCell.first().waitFor({ state: 'visible', timeout: 10000 });
    await cityCell.first().click();

    const { locator: cityOkButton } = await heal(f, {
      id: 'deliveryOrder.cityPopupOkButton',
      label: 'OK',
      strategies: [
        { type: 'css', value: '[id$="gsc_cbCity_pcGeneralSearchControl_cpnlGeneralSearchControl_formGeneralSearchControl_btnOk_CD" i]' },
      ],
      timeout: 5000,
    });
    await cityOkButton.click();
    await this.page.waitForTimeout(500);
  }

  /** Full flow through transfer + delivery address — Post is the caller's own next step. */
  async prepareDeliveryOrder({ customerCode, sqDocNo, address1, address3, cityName }) {
    await this.selectCustomer(customerCode);
    await this.clickCopyFromQuotation();
    await this.selectQuotationToTransfer(sqDocNo);
    await this.fillDeliveryAddress(address1, address3, cityName);
  }

  /** Waits for the actual report-tab signal rather than a fixed delay. CONFIRMED live: report titled "Delivery Order Detail GST Report". */
  async clickPost() {
    const { locator } = await heal(this.formFrame, {
      id: 'deliveryOrder.postButton',
      label: 'Post',
      strategies: [
        { type: 'css', value: '[title="Post [Alt + P]"]' },
        { type: 'text', value: 'Post', options: { exact: true } },
      ],
      timeout: 5000,
    });
    await locator.click();
    await this.page.getByText('Delivery Order Detail GST Report', { exact: false })
      .first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    await this.page.waitForTimeout(1000);
  }

  /** "Post & New" doesn't open a report tab (same shape confirmed throughout this module) — waits for the form to genuinely reset instead. */
  async clickPostAndNew() {
    const { locator } = await heal(this.formFrame, {
      id: 'deliveryOrder.postAndNewButton',
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

  /** CONFIRMED live: Post auto-opens a "Delivery Order Detail GST Report" tab. */
  async expectPostSuccess() {
    const reportTab = this.page.getByText('Delivery Order Detail GST Report', { exact: false });
    return (await reportTab.count().catch(() => 0)) > 0;
  }

  /**
   * Reads the posted document's assigned number from the auto-opened GST
   * report — CONFIRMED live: label "Delivery Ord. No". Only call this
   * after expectPostSuccess() is true.
   */
  async getPostedDocumentNumber() {
    const reportFrame = await findFrame(this.page, async (frame) => {
      const marker = frame.getByText('Delivery Ord. No', { exact: false });
      if ((await marker.count().catch(() => 0)) === 0) return false;
      return await marker.first().isVisible().catch(() => false);
    }, { timeout: 10000 });
    if (!reportFrame) return null;
    const text = await reportFrame.locator('body').innerText().catch(() => '');
    const match = text.match(/DO-\d+/);
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
      id: 'deliveryOrder.listingSearchFilterBox',
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
        path: `test-results/debug-delivery-order-search-not-found-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `Delivery Order listing never showed a row matching "${searchText}" after searching — ` +
        'refusing to proceed with Cancel against a possibly-stale/unfiltered row.'
      );
    }
    await this.page.waitForTimeout(300);
  }

  /** Polls until a genuine grid DATA ROW matching the search text is visible AND carries its own "Cancel" row-action icon. */
  async _waitForListingRowMatching(searchText, timeout = 15000) {
    // CONFIRMED live (2026-08-19, Sales Order): checking only "a matching
    // row exists" isn't enough on a listing with real clutter (leftover
    // documents from other, non-cleaning-up tests run earlier the same
    // day) — the live-filter textbox's own async callback can still be
    // narrowing the grid down from many rows to one when clickCancelIcon()
    // fires. Clicking a row's Cancel icon while that callback is mid-flight
    // can silently lose the click (the callback's response replaces the
    // grid's HTML, including the just-clicked row, before the server
    // round-trip for that click completes) — the confirm dialog still
    // opens and "Yes" still closes it, but nothing actually gets
    // cancelled. Requiring the grid to have narrowed to exactly this one
    // row proves the callback has settled.
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
      id: 'deliveryOrder.cancelConfirmYesButton',
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
      id: 'deliveryOrder.cancelReasonTrigger',
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
      id: 'deliveryOrder.cancelReasonOkButton',
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
      id: 'deliveryOrder.listingSearchFilterBox',
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

module.exports = { DeliveryOrderPage };
