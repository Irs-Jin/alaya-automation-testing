const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Purchase > Cash Purchase.
 *
 * SOURCE: no recording available — built by live-probing the real app
 * directly (2026-08-17). Structurally a hybrid of two patterns already
 * confirmed elsewhere in this repo:
 * - Header/Vendor/Warehouse/Item/required-reference-field/Save Draft/Post/
 *   Post & New shape, same as Purchase Invoice / Goods Receive (this
 *   screen's own required field is "Supplier Inv. No.", same `txtRefNo_I`
 *   id suffix).
 * - A MultiPayment dialog on Save Draft AND Post (not just Post) — same
 *   underlying component CashSalesPage already documents (`pcCPMultipayment`
 *   here vs. Cash Sales' `pcCSMultipayment` — identical shape, different
 *   2-letter module prefix), because a "Cash" purchase is paid immediately,
 *   unlike Purchase Invoice which is just an accounts-payable record.
 *
 * ONE CONFIRMED gotcha specific to this screen: the item search trigger
 * does nothing but re-surface a "Supplier Inv No is required" validation
 * banner if clicked before that field is filled — same "a required field
 * silently blocks the item picker from opening" shape Cash Sales' own
 * [Negative] test already documents for its Customer field, just gating
 * on a different field here.
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable across navigations — always re-resolved via findFrame() by
 * content, never hardcoded.
 */
class CashPurchasePage {
  constructor(page) {
    this.page = page;
    this.listFrame = null;
    this.formFrame = null;
  }

  async goto() {
    const p = this.page;
    // BUG FIXED (2026-08-18): scoped to #navBar (the actual left-nav
    // sidebar) — confirmed live that the unscoped page-wide locator
    // becomes ambiguous the SECOND time goto() runs for this same screen
    // in one test/script: the already-open browser tab's own label
    // ALSO matches getByRole('link', {name: 'Cash Purchase', exact:true}),
    // causing a strict-mode violation. Needed for the delete test, which
    // returns to this screen's listing after creating a document.
    //
    // Clicking "Purchase" TOGGLES its submenu open/closed (confirmed live
    // across every other page object in this module) — only click it if
    // the target link isn't already visible.
    const navBar = p.locator('#navBar');
    const cashPurchaseLink = navBar.getByRole('link', { name: 'Cash Purchase', exact: true });
    const alreadyExpanded = await cashPurchaseLink.isVisible().catch(() => false);
    if (!alreadyExpanded) {
      await navBar.getByRole('link', { name: 'Purchase', exact: true }).click();
    }
    await cashPurchaseLink.click();
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
      await p.screenshot({ path: 'test-results/debug-cash-purchase-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Cash Purchase listing frame. ' +
        'Saved test-results/debug-cash-purchase-list-page.png for inspection.'
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
      await p.screenshot({ path: 'test-results/debug-cash-purchase-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Cash Purchase create/edit form frame. ' +
        'Saved test-results/debug-cash-purchase-form-not-found.png for inspection.'
      );
    }
  }

  async clickNew() {
    const addIcon = this.listFrame.getByRole('img', { name: /Click Here Or Press \[Insert\]/i }).first();
    await addIcon.waitFor({ state: 'visible', timeout: 5000 });
    await addIcon.click();
    await this._resolveFormFrame();
  }

  /** Same Vendor search-popup shape confirmed across this whole module. */
  async selectVendor(vendorCode) {
    const f = this.formFrame;
    const { locator: trigger } = await heal(f, {
      id: 'cashPurchase.vendorTrigger',
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
      id: 'cashPurchase.vendorPopupOkButton',
      label: 'OK',
      strategies: [
        { type: 'css', value: '[id$="cbVendor_gsc_cbVendor_pcGeneralSearchControl_cpnlGeneralSearchControl_formGeneralSearchControl_btnOk_CD" i]' },
      ],
      timeout: 5000,
    });
    await okButton.click();
  }

  /** Same Warehouse combo shape confirmed across this whole module (arrow -> matching cell, no separate OK). */
  async selectWarehouse(warehouseCode) {
    const f = this.formFrame;
    const { locator: trigger } = await heal(f, {
      id: 'cashPurchase.warehouseTrigger',
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
   * Fills the required "Supplier Inv. No." field. CONFIRMED live: same
   * id suffix as Goods Receive/Purchase Invoice (`txtRefNo_I`), but here
   * it ALSO gates the item search trigger — clicking that trigger before
   * this field is filled just re-surfaces a "Supplier Inv No is required"
   * banner instead of opening the picker (confirmed live via a
   * screenshot). Must be called before selectItem().
   *
   * BUG FIXED (2026-08-18): confirmed live (under heavier server load
   * than usual) that pressSequentially() can lose most of its keystrokes
   * mid-type — a failure screenshot showed the field holding just "T"
   * from an intended "TESTING-DELETE-...", which then triggered this
   * screen's own "Supplier Inv. No. already exists" dialog since a bare
   * "T" collided with other test data. Now verifies the value actually
   * landed and retries (bounded) instead of trusting the keystrokes
   * silently succeeded.
   */
  async fillSupplierInvNo(value = `TESTING-INV-${Date.now()}`) {
    const f = this.formFrame;
    const field = f.locator('[id$="txtRefNo_I" i]');

    for (let attempt = 1; attempt <= 3; attempt++) {
      await field.first().click({ clickCount: 3 });
      await field.first().pressSequentially(value, { delay: 30 });
      const actual = await field.first().inputValue().catch(() => '');
      if (actual === value) break;
      if (attempt === 3) {
        throw new Error(`Supplier Inv. No. field shows "${actual}" after 3 attempts, expected "${value}".`);
      }
    }
  }

  /** Same Item search-popup shape confirmed across this whole module. */
  async selectItem(itemDescription) {
    const f = this.formFrame;
    const { locator: trigger } = await heal(f, {
      id: 'cashPurchase.itemTrigger',
      label: 'Item',
      strategies: [
        { type: 'css', value: '[id$="txtItemSearchUpdate_B0Img" i]' },
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
      id: 'cashPurchase.itemPopupOkButton',
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
   * Same shared "Information" dialog already documented for Purchase
   * Order — reusing an item already used on an earlier document can
   * trigger a confirm prompt here too. Presence check, not an assumption
   * it always appears (didn't trigger during this page object's own live
   * probe, but the underlying component is shared and confirmed to exist
   * elsewhere in this module).
   */
  async handleDuplicateItemPromptIfPresent() {
    const f = this.formFrame;
    const present = await f.getByText('detected exist in previous', { exact: false })
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (!present) return;

    const { locator: yesButton } = await heal(f, {
      id: 'cashPurchase.duplicateItemYesButton',
      label: 'Yes',
      strategies: [
        { type: 'css', value: '[id$="pcInfoMessageBox_btnInfoYes_CD" i]' },
      ],
      timeout: 5000,
    });
    await yesButton.click();
    await f.getByText('detected exist in previous', { exact: false }).first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }

  /** Full flow: select vendor + warehouse, fill Supplier Inv. No., add one item. */
  async prepareCashPurchase({ vendorCode, warehouseCode, supplierInvNo, itemDescription }) {
    if (vendorCode) await this.selectVendor(vendorCode);
    if (warehouseCode) await this.selectWarehouse(warehouseCode);
    await this.fillSupplierInvNo(supplierInvNo);
    if (itemDescription) await this.selectItem(itemDescription);
  }

  /**
   * Handles the MultiPayment dialog that Save Draft AND Post both open
   * here (CONFIRMED live — unlike Purchase Invoice/Goods Receive, where
   * only Post/Post & New matter, a Cash Purchase needs payment details
   * even to save as a draft). Same control shape as CashSalesPage's own
   * completeMultiPayment(), confirmed live: identical id suffixes under a
   * `pcCPMultipayment` root instead of Cash Sales' `pcCSMultipayment`.
   */
  async completeMultiPayment(paymentMode = 'CASH') {
    const p = this.page;

    const dialogFrame = (await findFrame(p, async (frame) => {
      const addIcon = frame.locator('img[id*="CPMultipayment" i][id*="header0_Add" i]');
      return (await addIcon.count()) > 0 && (await addIcon.first().isVisible().catch(() => false));
    })) || this.formFrame;

    const { locator: addRow } = await heal(dialogFrame, {
      id: 'cashPurchase.multiPaymentAddRow',
      label: 'Add payment row',
      strategies: [
        { type: 'css', value: 'img[id*="CPMultipayment" i][id*="header0_Add" i]' },
        { type: 'css', value: 'img[title="Add"]:visible' },
      ],
      timeout: 3000,
    });
    await addRow.click();
    await p.waitForTimeout(1000);

    const { locator: modeTrigger } = await heal(dialogFrame, {
      id: 'cashPurchase.multiPaymentModeTrigger',
      label: 'Payment Mode',
      strategies: [
        { type: 'css', value: '[id*="CPMultipayment" i][id*="DXEditor3" i][id*="B-1Img" i]:visible' },
      ],
      timeout: 3000,
    });
    await modeTrigger.click();
    await p.waitForTimeout(800);

    const { locator: modeOption } = await heal(dialogFrame, {
      id: 'cashPurchase.multiPaymentModeOption',
      label: paymentMode,
      strategies: [
        { type: 'css', value: `td[id*="CPMultipayment" i][id*="DDD_L_LBI" i]:visible:text-is("${paymentMode}")` },
      ],
      timeout: 3000,
    });
    await modeOption.click();
    await p.waitForTimeout(500);

    const { locator: confirmButton } = await heal(dialogFrame, {
      id: 'cashPurchase.multiPaymentOkButton',
      label: 'OK',
      strategies: [
        { type: 'css', value: '[id*="CPMultipayment" i][id$="btnMakePaymentClick_CD" i]' },
      ],
      timeout: 5000,
    });
    await confirmButton.click();
    await p.waitForTimeout(2000);
  }

  /** Save Draft also opens MultiPayment here — completes it with CASH by default. */
  async clickSaveDraft(paymentMode = 'CASH') {
    const { locator } = await heal(this.formFrame, {
      id: 'cashPurchase.saveDraftButton',
      label: 'Save Draft',
      strategies: [
        { type: 'css', value: '[title="Save Draft [Alt + S]"]' },
        { type: 'text', value: 'Save Draft', options: { exact: true } },
      ],
      timeout: 5000,
    });
    await locator.click();
    await this.page.waitForTimeout(1500);
    await this.completeMultiPayment(paymentMode);
  }

  /**
   * BUG-CLASS ALREADY FIXED ELSEWHERE (2026-08-17): waits for the actual
   * report-tab signal rather than a fixed delay — same fix already needed
   * for Purchase Invoice's own clickPost().
   */
  async clickPost(paymentMode = 'CASH') {
    const { locator } = await heal(this.formFrame, {
      id: 'cashPurchase.postButton',
      label: 'Post',
      strategies: [
        { type: 'css', value: '[title="Post [Alt + P]"]' },
        { type: 'text', value: 'Post', options: { exact: true } },
      ],
      timeout: 5000,
    });
    await locator.click();
    await this.page.waitForTimeout(1500);
    await this.completeMultiPayment(paymentMode);
    await this.page.getByText('CashPurchaseDetailGST Report', { exact: false })
      .first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    await this.page.waitForTimeout(1000);
  }

  /** Same "Post & New doesn't open a report tab" shape already confirmed for Purchase Invoice/Purchase Return. */
  async clickPostAndNew(paymentMode = 'CASH') {
    const { locator } = await heal(this.formFrame, {
      id: 'cashPurchase.postAndNewButton',
      label: 'Post & New',
      strategies: [
        { type: 'css', value: '[title="Post & New [Alt + Ctrl + P]"]' },
        { type: 'text', value: 'Post & New', options: { exact: true } },
      ],
      timeout: 5000,
    });
    await locator.click();
    await this.page.waitForTimeout(1500);
    await this.completeMultiPayment(paymentMode);
    const vendorField = this.formFrame.locator('[id$="cbVendor_cbVendor_I" i]');
    await vendorField.first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    await this.page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        return el && el.value.trim() === '';
      },
      '[id$="cbVendor_cbVendor_I"]',
      { timeout: 20000 }
    ).catch(() => {});
  }

  /** CONFIRMED live: a "Saved Successfully" banner appears, same as Purchase Invoice's own Save Draft. */
  async expectSaveDraftSuccess() {
    const banner = this.formFrame.getByText(/saved success/i);
    return (await banner.count().catch(() => 0)) > 0;
  }

  /** CONFIRMED live: Post auto-opens a "CashPurchaseDetailGST Report" tab. */
  async expectPostSuccess() {
    const reportTab = this.page.getByText('CashPurchaseDetailGST Report', { exact: false });
    return (await reportTab.count().catch(() => 0)) > 0;
  }

  /**
   * Reads the "[Next Possible No.CP-XXXXX]" number from the form header —
   * used as before/after proof for "Post & New", same reasoning as
   * PurchaseInvoicePage.getNextPossibleNo() / PurchaseReturnPage's own.
   */
  async getNextPossibleNo() {
    const header = this.formFrame.getByText('Next Possible No', { exact: false });
    const text = await header.first().innerText().catch(() => '');
    const match = text.match(/CP-\d+/);
    return match ? match[0] : null;
  }

  /** Checks the form reset to a blank state after "Post & New". */
  async expectFormReset() {
    const vendorField = this.formFrame.locator('[id$="cbVendor_cbVendor_I" i]');
    const value = await vendorField.first().inputValue().catch(() => 'unknown');
    return value.trim() === '';
  }

  /**
   * Fills the listing grid's own live-filter textbox and waits for a
   * genuine matching row before returning — same id suffix
   * (FilterTextBoxGridView_txtFilterGridView_I) and same
   * triple-click-then-pressSequentially convention already confirmed in
   * customerPage.js's searchCustomer(). Required before clickCancelIcon()
   * so the row we act on is provably the one we searched for, not
   * whatever the default (undated/paginated) grid view happens to show.
   */
  async searchListing(searchText) {
    await this._resolveListFrame();
    const { locator: filterBox } = await heal(this.listFrame, {
      id: 'cashPurchase.listingSearchFilterBox',
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
        path: `test-results/debug-cash-purchase-search-not-found-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `Cash Purchase listing never showed a row matching "${searchText}" after searching — ` +
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
   * _waitForGridRowMatching()).
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
   * Clicks the matching row's own "Cancel" icon (accessible name "Cancel"
   * even though the icon file is Delete.svg — CONFIRMED live via DOM
   * dump). Scoped to the ONE row matching searchText, never a grid-wide
   * selector, per this repo's safety rule for delete/cancel actions.
   *
   * CONFIRMED live (2026-08-18): right after Save Draft, a shared
   * app-wide loading overlay (`#ctl00_ASPxSplitter1_MainContent_
   * LoadingPanel1_LD` — distinct from the `#ctl00_LoadingPanel_LD` id
   * used elsewhere in this repo) can intercept this click for an extended
   * period — root-caused to Save Draft's own trailing async work (GST/
   * eInvoice registration) still finishing server-side, NOT a problem
   * with the click technique itself (force:true and a direct DOM
   * el.click() were both tried and neither helped — force:true still hit
   * whatever was frontmost at those coordinates, and a synthetic
   * el.click() never triggered the row handler at all, meaning it needs
   * a genuinely trusted mouse event). Fixed at the call site
   * (cancelDocument()) by giving Save Draft's trailing work time to
   * settle before returning to the listing, rather than fighting the
   * overlay after the fact here.
   */
  async clickCancelIcon(searchText) {
    const row = this.listFrame.locator('tr.dxgvDataRow_iOS').filter({ hasText: searchText });
    const cancelIcon = row.first().getByRole('img', { name: 'Cancel', exact: true });
    await cancelIcon.waitFor({ state: 'visible', timeout: 15000 });
    await cancelIcon.click({ timeout: 30000 });
  }

  /**
   * Confirms the row-level Cancel action via its own "Cancel Confirmation"
   * dialog (`pcConfirmCancel` — CONFIRMED live via DOM dump, distinct from
   * the generic `pcConfirmDel` "Delete Confirmation" popup used
   * elsewhere). `_CD` (+ `_I` zero-size sibling) is the real clickable
   * element, same lesson as every other DevExpress confirm dialog in this
   * repo. Scoped to this.listFrame, never page-wide — per this repo's
   * safety rule for delete/cancel confirmations.
   *
   * CONFIRMED live: the dialog can take well over 20s to actually render
   * after the Cancel-icon click (the grid runs its own callback first) —
   * generous timeout here is deliberate, not a placeholder.
   */
  async confirmCancelYes() {
    const popup = this.listFrame.locator('#ctl00_pcConfirmCancel_PW-1');
    await popup.waitFor({ state: 'visible', timeout: 45000 });

    const { locator: yesButton } = await heal(this.listFrame, {
      id: 'cashPurchase.cancelConfirmYesButton',
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
   * Full flow: search -> click row's Cancel icon -> confirm Yes.
   *
   * Gives Save Draft's trailing async work (GST/eInvoice registration —
   * see clickCancelIcon()'s comment) time to settle before returning to
   * the listing, since this method is meant to run right after a fresh
   * Save Draft in the same session.
   */
  async cancelDocument(searchText) {
    await this.page.waitForTimeout(8000);
    await this.goto();
    await this.searchListing(searchText);
    await this.clickCancelIcon(searchText);
    await this.confirmCancelYes();
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
      id: 'cashPurchase.listingSearchFilterBox',
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

module.exports = { CashPurchasePage };
