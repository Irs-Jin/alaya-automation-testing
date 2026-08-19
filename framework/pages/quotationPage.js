const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Sales > Quotation.
 *
 * SOURCE: no recording available — built by live-probing the real app
 * directly (2026-08-19) using the playwright-cli interactive tool. First
 * new Sales-module screen built following the Purchase module's own
 * refined conventions (heal()/findFrame()/#navBar-scoped goto(), the
 * searchListing()/clickCancelIcon()/confirmCancelYes()/cancelDocument()/
 * isDocumentPresent() Cancel-action shape) rather than the older,
 * `fields()`-bag style CashSalesPage was originally built with — this is
 * the more mature pattern, proven across all 7 Purchase-module screens.
 *
 * SHAPE: this is the FIRST step of the Sales cycle (like Purchase Order is
 * for Purchase) — no "Copy From" transfer source, just New -> select
 * Customer -> select Sales Branch (Warehouse auto-fills from it) -> add
 * item(s) -> Save Draft / Post / Post & New. Internal control name
 * "SalesQuotationDetail"/"SalesQuotation", document prefix "SQ-".
 *
 * CONFIRMED live differences from the Purchase module:
 * - Customer search uses `cbSelectCust` (same as CashSalesPage), NOT the
 *   Purchase module's `cbVendor_cbVendor_B1Img` pattern.
 * - Sales Branch is a required field (`cbSalesBranch`, same doubled-name
 *   combo shape as CashSalesPage.selectComboByCode()) — confirmed live it
 *   does NOT auto-fill from Customer for this company (qa3/SHANTHI QA BIZ
 *   69), matching CashSalesPage's own documented finding. Selecting Sales
 *   Branch DOES auto-fill Warehouse, though (confirmed live) — no separate
 *   Warehouse selection needed here.
 * - Reference No. field is `txtRefNo_I` (same suffix as every Purchase
 *   screen's own reference field), not required (no asterisk) but always
 *   filled here for the Cancel test's search key.
 * - Report titled "Sales Quotation Summary GST Report", doc-number label
 *   "Sales Quotation No" (used by getPostedDocumentNumber()-style reads
 *   elsewhere in this module, if a chained screen needs this document's
 *   number later).
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable across navigations — always re-resolved via findFrame() by
 * content, never hardcoded.
 */
class QuotationPage {
  constructor(page) {
    this.page = page;
    this.listFrame = null;
    this.formFrame = null;
  }

  async goto() {
    const p = this.page;
    const navBar = p.locator('#navBar');
    const quotationLink = navBar.getByRole('link', { name: 'Quotation', exact: true });
    const alreadyExpanded = await quotationLink.isVisible().catch(() => false);
    if (!alreadyExpanded) {
      await navBar.getByRole('link', { name: 'Sales', exact: true }).click();
    }
    await quotationLink.click();
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
      await p.screenshot({ path: 'test-results/debug-quotation-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Quotation listing frame. ' +
        'Saved test-results/debug-quotation-list-page.png for inspection.'
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
      await p.screenshot({ path: 'test-results/debug-quotation-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Quotation create/edit form frame. ' +
        'Saved test-results/debug-quotation-form-not-found.png for inspection.'
      );
    }
  }

  async clickNew() {
    const addIcon = this.listFrame.getByRole('img', { name: /Click Here Or Press \[Insert\]/i }).first();
    await addIcon.waitFor({ state: 'visible', timeout: 5000 });
    await addIcon.click();
    await this._resolveFormFrame();
  }

  /**
   * Customer search-popup shape confirmed live: same `cbSelectCust` control
   * CashSalesPage already documents, NOT the Purchase module's `cbVendor`
   * pattern.
   */
  async selectCustomer(customerCode) {
    const f = this.formFrame;
    const { locator: trigger } = await heal(f, {
      id: 'quotation.customerTrigger',
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
      id: 'quotation.customerPopupOkButton',
      label: 'OK',
      strategies: [
        { type: 'css', value: '[id*="cbSelectCust" i][id*="GeneralSearchControl" i][id$="btnOk_CD" i]' },
      ],
      timeout: 5000,
    });
    await okButton.click();
  }

  /**
   * Selects a value from a labeled DevExpress combo lookup (dropdown arrow
   * -> listbox popup) by matching the CODE cell exactly. Same
   * "id doubles the field name" convention as CashSalesPage's own
   * selectComboByCode() — e.g. fieldId "cbSalesBranch" resolves to
   * `cbSalesBranch_cbSalesBranch_B-1Img`.
   */
  async selectComboByCode(fieldId, code) {
    const f = this.formFrame;
    const arrow = f.locator(`[id*="${fieldId}_${fieldId}_B-1Img" i]`);
    await arrow.first().click();
    const cell = f.getByRole('cell', { name: code, exact: true });
    await cell.first().waitFor({ state: 'visible', timeout: 10000 });
    await cell.first().click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Selects Sales Branch by code, but ONLY if the field is still genuinely
   * unselected — same defensive shape as CashSalesPage.ensureComboSelected(),
   * since auto-fill behavior may differ per company. CONFIRMED live for
   * qa3/SHANTHI QA BIZ 69: Sales Branch does NOT auto-fill from Customer
   * and must be selected explicitly; selecting it DOES auto-fill Warehouse.
   */
  async ensureComboSelected(fieldId, code) {
    const f = this.formFrame;
    const hiddenValue = f.locator(`[id$="${fieldId}_${fieldId}_VI" i]`);
    const current = await hiddenValue.first().inputValue().catch(() => '');
    if (current.trim() !== '') return;
    await this.selectComboByCode(fieldId, code);
  }

  /**
   * Fills the (not required, but always given a unique value here so a
   * specific document can be searched for later) "Reference No." field —
   * same `txtRefNo_I` id suffix as every reference field in the Purchase
   * module. Retry-and-verify pattern from the start, matching the
   * established fix for this field class after it was confirmed live
   * (Purchase Invoice/Goods Receive) to occasionally lose keystrokes under
   * load.
   */
  async fillReferenceNo(value = `TESTING-SQ-${Date.now()}`) {
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
   * pattern confirmed across the whole Purchase module, just under this
   * screen's own "SQDetail" id root.
   */
  async selectItem(itemDescription) {
    const f = this.formFrame;
    const { locator: trigger } = await heal(f, {
      id: 'quotation.itemTrigger',
      label: 'Item',
      strategies: [
        { type: 'css', value: '[id$="ItemAdvanceSearchControlSQDetail_txtItemSearchUpdate_B0Img" i]' },
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
      id: 'quotation.itemPopupOkButton',
      label: 'OK',
      strategies: [
        { type: 'css', value: '[id$="formItemSearchControl_btnItemSearchOk_CD" i]' },
      ],
      timeout: 5000,
    });
    await okButton.click();
    // The grid runs a DevExpress callback to actually insert the new row —
    // confirmed live elsewhere in this repo (CashSalesPage.selectItem()):
    // checking immediately can still see "No data to display" mid-callback.
    await this.page.waitForTimeout(1500);
  }

  /** Full flow: select customer + sales branch, add one item. */
  async prepareQuotation({ customerCode, salesBranchCode, itemDescription, referenceNo }) {
    if (customerCode) await this.selectCustomer(customerCode);
    if (salesBranchCode) await this.ensureComboSelected('cbSalesBranch', salesBranchCode);
    await this.fillReferenceNo(referenceNo);
    if (itemDescription) await this.selectItem(itemDescription);
  }

  async clickSaveDraft() {
    const { locator } = await heal(this.formFrame, {
      id: 'quotation.saveDraftButton',
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

  /** Waits for the actual report-tab signal rather than a fixed delay. CONFIRMED live: report titled "Sales Quotation Summary GST Report". */
  async clickPost() {
    const { locator } = await heal(this.formFrame, {
      id: 'quotation.postButton',
      label: 'Post',
      strategies: [
        { type: 'css', value: '[title="Post [Alt + P]"]' },
        { type: 'text', value: 'Post', options: { exact: true } },
      ],
      timeout: 5000,
    });
    await locator.click();
    await this.page.getByText('Sales Quotation Summary GST Report', { exact: false })
      .first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    await this.page.waitForTimeout(1000);
  }

  /** "Post & New" doesn't open a report tab (same shape confirmed throughout the Purchase module) — waits for the form to genuinely reset instead. */
  async clickPostAndNew() {
    const { locator } = await heal(this.formFrame, {
      id: 'quotation.postAndNewButton',
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

  /** CONFIRMED live: a "Saved Successfully" banner appears, same generic ASPx save-confirmation banner as the Purchase module. */
  async expectSaveDraftSuccess() {
    const banner = this.formFrame.getByText(/saved success/i);
    return (await banner.count().catch(() => 0)) > 0;
  }

  /** CONFIRMED live: Post auto-opens a "Sales Quotation Summary GST Report" tab. */
  async expectPostSuccess() {
    const reportTab = this.page.getByText('Sales Quotation Summary GST Report', { exact: false });
    return (await reportTab.count().catch(() => 0)) > 0;
  }

  /** Reads the "[Next Possible No.SQ-XXXXX]" number from the form header — used as before/after proof for "Post & New". */
  async getNextPossibleNo() {
    const header = this.formFrame.getByText('Next Possible No', { exact: false });
    const text = await header.first().innerText().catch(() => '');
    const match = text.match(/SQ-\d+/);
    return match ? match[0] : null;
  }

  /**
   * Reads the posted document's assigned number from the auto-opened GST
   * report — CONFIRMED live: label "Sales Quotation No". Only call this
   * after expectPostSuccess() is true.
   */
  async getPostedDocumentNumber() {
    const reportFrame = await findFrame(this.page, async (frame) => {
      const marker = frame.getByText('Sales Quotation No', { exact: false });
      if ((await marker.count().catch(() => 0)) === 0) return false;
      return await marker.first().isVisible().catch(() => false);
    }, { timeout: 10000 });
    if (!reportFrame) return null;
    const text = await reportFrame.locator('body').innerText().catch(() => '');
    const match = text.match(/SQ-\d+/);
    return match ? match[0] : null;
  }

  /** Checks the form reset to a blank state after "Post & New". */
  async expectFormReset() {
    const customerField = this.formFrame.locator('[id$="cbCustomer_cbSelectCust_I" i]');
    const value = await customerField.first().inputValue().catch(() => 'unknown');
    return value.trim() === '';
  }

  /**
   * Dismisses the "Confirm to validate e-Invoice?" dialog if it appears
   * after posting — same defensive, content-scoped check as
   * CashSalesPage.dismissEInvoiceValidationPromptIfPresent() (didn't
   * appear during this screen's own live probe, but the underlying dialog
   * is shared/reusable across Sales screens, so this stays defensive
   * rather than assuming it never will). Answers "No" (skip validation) —
   * the user's explicit safety choice, never assumed safe to click through
   * blindly since it can mean submitting to the real LHDN e-Invoice
   * framework.
   */
  async dismissEInvoiceValidationPromptIfPresent() {
    const f = this.formFrame;
    const dialog = f.locator('div, table', { hasText: 'Confirm to validate e-Invoice?' }).last();
    const present = await dialog.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    if (!present) return;

    const noButton = dialog.locator('span.dx-vam:visible:text-is("No")');
    await noButton.first().click();
    await dialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }

  /**
   * Fills the listing grid's own live-filter textbox and waits for a
   * genuine matching row before returning — same id suffix
   * (FilterTextBoxGridView_txtFilterGridView_I) and same
   * triple-click-then-pressSequentially convention confirmed throughout
   * the Purchase module. Required before clickCancelIcon() so the row we
   * act on is provably the one we searched for.
   */
  async searchListing(searchText) {
    await this._resolveListFrame();
    const { locator: filterBox } = await heal(this.listFrame, {
      id: 'quotation.listingSearchFilterBox',
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
        path: `test-results/debug-quotation-search-not-found-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `Quotation listing never showed a row matching "${searchText}" after searching — ` +
        'refusing to proceed with Cancel against a possibly-stale/unfiltered row.'
      );
    }
    await this.page.waitForTimeout(300);
  }

  /**
   * Polls until a genuine grid DATA ROW matching the search text is
   * visible AND carries its own "Cancel" row-action icon.
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

  /** Clicks the matching row's own "Cancel" icon. Scoped to the ONE row matching searchText, never a grid-wide selector. */
  async clickCancelIcon(searchText) {
    const row = this.listFrame.locator('tr.dxgvDataRow_iOS').filter({ hasText: searchText });
    const cancelIcon = row.first().getByRole('img', { name: 'Cancel', exact: true });
    await cancelIcon.waitFor({ state: 'visible', timeout: 15000 });
    await cancelIcon.click({ timeout: 30000 });
  }

  /**
   * Confirms the row-level Cancel action via its own "Cancel Confirmation"
   * dialog (`pcConfirmCancel` — same id root confirmed live across every
   * Purchase-module screen). Scoped to this.listFrame, never page-wide.
   */
  async confirmCancelYes() {
    const popup = this.listFrame.locator('#ctl00_pcConfirmCancel_PW-1');
    await popup.waitFor({ state: 'visible', timeout: 45000 });

    const { locator: yesButton } = await heal(this.listFrame, {
      id: 'quotation.cancelConfirmYesButton',
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

  /** Handles a "Cancel Reason" popup if one appears — CONFIRMED required on Purchase Return; presence check here, not an assumption it always appears. */
  async handleCancelReasonIfPresent() {
    const popup = this.listFrame.locator('[id*="pcCancelReason" i][id$="_PW-1" i]');
    const present = await popup.first().waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    if (!present) return;

    const { locator: reasonTrigger } = await heal(this.listFrame, {
      id: 'quotation.cancelReasonTrigger',
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
      id: 'quotation.cancelReasonOkButton',
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
   * Gives Save Draft's trailing async work time to settle before returning
   * to the listing, same reasoning as CashPurchasePage.cancelDocument().
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
   * verify a cancelled document is genuinely gone from the active list.
   */
  async isDocumentPresent(searchText) {
    await this._resolveListFrame();
    const { locator: filterBox } = await heal(this.listFrame, {
      id: 'quotation.listingSearchFilterBox',
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

module.exports = { QuotationPage };
