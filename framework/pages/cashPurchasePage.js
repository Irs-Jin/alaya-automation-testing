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
    // Clicking "Purchase" TOGGLES its submenu open/closed (confirmed live
    // across every other page object in this module) — only click it if
    // the target link isn't already visible.
    const cashPurchaseLink = p.getByRole('link', { name: 'Cash Purchase', exact: true });
    const alreadyExpanded = await cashPurchaseLink.isVisible().catch(() => false);
    if (!alreadyExpanded) {
      await p.getByRole('link', { name: 'Purchase', exact: true }).click();
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
   */
  async fillSupplierInvNo(value = `TESTING-INV-${Date.now()}`) {
    const f = this.formFrame;
    const field = f.locator('[id$="txtRefNo_I" i]');
    await field.first().click();
    await field.first().pressSequentially(value, { delay: 20 });
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
}

module.exports = { CashPurchasePage };
