const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Sales > Sales Order.
 *
 * SOURCE: no recording available — built by live-probing the real app
 * directly (2026-08-19) using the playwright-cli interactive tool. Same
 * shape as QuotationPage (Customer -> Sales Branch -> Item -> Save Draft/
 * Post/Post & New), with a "Copy From" toolbar button also present (can
 * transfer from a Quotation) — not exercised here, this test uses the same
 * direct-entry path already confirmed for Quotation.
 *
 * CONFIRMED live differences from QuotationPage:
 * - Internal control root "SalesOrderDetail"/"cbpSalesOrder"/
 *   "formSalesOrderHeader" (Quotation's is "SalesQuotationDetail"/
 *   "cbpSalesQuotation"/"formSQHeader").
 * - Item search control root is "ItemAdvanceSearchControlSalesOrder"
 *   (spelled out in full — NOT abbreviated "SODetail" the way Quotation's
 *   is "SQDetail").
 * - Header title "Sales Header" (not "Sales Order"), document prefix
 *   "SO-".
 * - Has an extra required "Due Date" field — confirmed live it already
 *   defaults to a valid value (today's date), so no explicit action is
 *   needed for it.
 * - BUG FIXED (2026-08-19): a session timeout cut the live probe short
 *   before reaching Post, so the report tab title was first guessed by
 *   analogy to Quotation's own ("Sales Quotation Summary GST Report") —
 *   the real title, confirmed via a live failure screenshot, is "Sales
 *   Order Detail GST Report" (Detail, not Summary). Report shows "Sales
 *   Order No" as its doc-number label.
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable across navigations — always re-resolved via findFrame() by
 * content, never hardcoded.
 */
class SalesOrderPage {
  constructor(page) {
    this.page = page;
    this.listFrame = null;
    this.formFrame = null;
  }

  async goto() {
    const p = this.page;
    const navBar = p.locator('#navBar');
    const salesOrderLink = navBar.getByRole('link', { name: 'Sales Order', exact: true });
    const alreadyExpanded = await salesOrderLink.isVisible().catch(() => false);
    if (!alreadyExpanded) {
      await navBar.getByRole('link', { name: 'Sales', exact: true }).click();
    }
    await salesOrderLink.click();
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
      await p.screenshot({ path: 'test-results/debug-sales-order-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Sales Order listing frame. ' +
        'Saved test-results/debug-sales-order-list-page.png for inspection.'
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
      await p.screenshot({ path: 'test-results/debug-sales-order-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Sales Order create/edit form frame. ' +
        'Saved test-results/debug-sales-order-form-not-found.png for inspection.'
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
      id: 'salesOrder.customerTrigger',
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
      id: 'salesOrder.customerPopupOkButton',
      label: 'OK',
      strategies: [
        { type: 'css', value: '[id*="cbSelectCust" i][id*="GeneralSearchControl" i][id$="btnOk_CD" i]' },
      ],
      timeout: 5000,
    });
    await okButton.click();
  }

  /** Same "id doubles the field name" combo convention confirmed across the Sales module. */
  async selectComboByCode(fieldId, code) {
    const f = this.formFrame;
    const arrow = f.locator(`[id*="${fieldId}_${fieldId}_B-1Img" i]`);
    await arrow.first().click();
    const cell = f.getByRole('cell', { name: code, exact: true });
    await cell.first().waitFor({ state: 'visible', timeout: 10000 });
    await cell.first().click();
    await this.page.waitForTimeout(500);
  }

  /** Selects Sales Branch by code, but ONLY if the field is still genuinely unselected. */
  async ensureComboSelected(fieldId, code) {
    const f = this.formFrame;
    const hiddenValue = f.locator(`[id$="${fieldId}_${fieldId}_VI" i]`);
    const current = await hiddenValue.first().inputValue().catch(() => '');
    if (current.trim() !== '') return;
    await this.selectComboByCode(fieldId, code);
  }

  /**
   * Fills the (not required, but always given a unique value here)
   * "Reference No." field — same `txtRefNo_I` id suffix confirmed across
   * this whole module. Retry-and-verify from the start, matching the
   * established fix for this field class.
   */
  async fillReferenceNo(value = `TESTING-SO-${Date.now()}`) {
    const f = this.formFrame;
    const field = f.locator('[id$="txtRefNo_I" i]');

    for (let attempt = 1; attempt <= 3; attempt++) {
      await field.first().click({ clickCount: 3 });
      await field.first().pressSequentially(value, { delay: 30 });
      const actual = await field.first().inputValue().catch(() => '');
      if (actual === value) return;
      if (attempt === 3) {
        throw new Error(`Reference No. field shows "${actual}" after 3 attempts, expected "${value}".`);
      }
    }
  }

  /**
   * Item selection — same "ItemAdvanceSearchControl" popup-grid pick
   * pattern confirmed across the whole Purchase/Sales module, just under
   * this screen's own "ItemAdvanceSearchControlSalesOrder" id root
   * (spelled out in full, unlike Quotation's abbreviated "SQDetail").
   */
  async selectItem(itemDescription) {
    const f = this.formFrame;
    const { locator: trigger } = await heal(f, {
      id: 'salesOrder.itemTrigger',
      label: 'Item',
      strategies: [
        { type: 'css', value: '[id$="ItemAdvanceSearchControlSalesOrder_txtItemSearchUpdate_B0Img" i]' },
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
      id: 'salesOrder.itemPopupOkButton',
      label: 'OK',
      strategies: [
        { type: 'css', value: '[id$="formItemSearchControl_btnItemSearchOk_CD" i]' },
      ],
      timeout: 5000,
    });
    await okButton.click();
    await this.page.waitForTimeout(1500);
  }

  /** Full flow: select customer + sales branch, add one item. Due Date is left at its own valid default. */
  async prepareSalesOrder({ customerCode, salesBranchCode, itemDescription, referenceNo }) {
    if (customerCode) await this.selectCustomer(customerCode);
    if (salesBranchCode) await this.ensureComboSelected('cbSalesBranch', salesBranchCode);
    await this.fillReferenceNo(referenceNo);
    if (itemDescription) await this.selectItem(itemDescription);
  }

  async clickSaveDraft() {
    const { locator } = await heal(this.formFrame, {
      id: 'salesOrder.saveDraftButton',
      label: 'Save Draft',
      strategies: [
        { type: 'css', value: '[title="Save Draft [Alt + S]"]' },
        { type: 'text', value: 'Save Draft', options: { exact: true } },
      ],
      timeout: 5000,
    });
    await locator.click();
    await this.page.waitForTimeout(2000);
  }

  /** Waits for the actual report-tab signal rather than a fixed delay. CONFIRMED live: report titled "Sales Order Detail GST Report". */
  async clickPost() {
    const { locator } = await heal(this.formFrame, {
      id: 'salesOrder.postButton',
      label: 'Post',
      strategies: [
        { type: 'css', value: '[title="Post [Alt + P]"]' },
        { type: 'text', value: 'Post', options: { exact: true } },
      ],
      timeout: 5000,
    });
    await locator.click();
    await this.page.getByText('Sales Order Detail GST Report', { exact: false })
      .first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    await this.page.waitForTimeout(1000);
  }

  /** "Post & New" doesn't open a report tab (same shape confirmed throughout this module) — waits for the form to genuinely reset instead. */
  async clickPostAndNew() {
    const { locator } = await heal(this.formFrame, {
      id: 'salesOrder.postAndNewButton',
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

  /** CONFIRMED live (Quotation's own shared banner pattern): a "Saved Successfully" banner appears. */
  async expectSaveDraftSuccess() {
    const banner = this.formFrame.getByText(/saved success/i);
    return (await banner.count().catch(() => 0)) > 0;
  }

  /** CONFIRMED live: Post auto-opens a "Sales Order Detail GST Report" tab. */
  async expectPostSuccess() {
    const reportTab = this.page.getByText('Sales Order Detail GST Report', { exact: false });
    return (await reportTab.count().catch(() => 0)) > 0;
  }

  /** Reads the "[Next Possible No.SO-XXXXX]" number from the form header. */
  async getNextPossibleNo() {
    const header = this.formFrame.getByText('Next Possible No', { exact: false });
    const text = await header.first().innerText().catch(() => '');
    const match = text.match(/SO-\d+/);
    return match ? match[0] : null;
  }

  /**
   * Reads the posted document's assigned number from the auto-opened GST
   * report — CONFIRMED live: label "Sales Order No". Added for
   * ClosePurchaseOrderPage-equivalent screens (CloseSalesOrderPage) that
   * need a guaranteed-fresh, still-open SO to transfer from. Only call
   * this after expectPostSuccess() is true.
   */
  async getPostedDocumentNumber() {
    const reportFrame = await findFrame(this.page, async (frame) => {
      const marker = frame.getByText('Sales Order No', { exact: false });
      if ((await marker.count().catch(() => 0)) === 0) return false;
      return await marker.first().isVisible().catch(() => false);
    }, { timeout: 10000 });
    if (!reportFrame) return null;
    const text = await reportFrame.locator('body').innerText().catch(() => '');
    const match = text.match(/SO-\d+/);
    return match ? match[0] : null;
  }

  /** Checks the form reset to a blank state after "Post & New". */
  async expectFormReset() {
    const customerField = this.formFrame.locator('[id$="cbCustomer_cbSelectCust_I" i]');
    const value = await customerField.first().inputValue().catch(() => 'unknown');
    return value.trim() === '';
  }

  /** Dismisses the "Confirm to validate e-Invoice?" dialog if it appears after posting — same defensive check as QuotationPage/CashSalesPage. */
  async dismissEInvoiceValidationPromptIfPresent() {
    const f = this.formFrame;
    const dialog = f.locator('div, table', { hasText: 'Confirm to validate e-Invoice?' }).last();
    const present = await dialog.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    if (!present) return;

    const noButton = dialog.locator('span.dx-vam:visible:text-is("No")');
    await noButton.first().click();
    await dialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }

  /** Fills the listing grid's own live-filter textbox and waits for a genuine matching row before returning. */
  async searchListing(searchText) {
    await this._resolveListFrame();
    const { locator: filterBox } = await heal(this.listFrame, {
      id: 'salesOrder.listingSearchFilterBox',
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
        path: `test-results/debug-sales-order-search-not-found-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `Sales Order listing never showed a row matching "${searchText}" after searching — ` +
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
      id: 'salesOrder.cancelConfirmYesButton',
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
      id: 'salesOrder.cancelReasonTrigger',
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
      id: 'salesOrder.cancelReasonOkButton',
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
      id: 'salesOrder.listingSearchFilterBox',
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

module.exports = { SalesOrderPage };
