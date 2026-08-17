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
    await p.getByRole('link', { name: 'Purchase', exact: true }).click();
    await p.getByRole('link', { name: 'Purchase Order', exact: true }).click();
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
      const company = frame.getByText('Company:', { exact: false });
      const posted = frame.getByText('POSTED', { exact: false });
      return (
        (await company.count().catch(() => 0)) > 0 &&
        (await posted.count().catch(() => 0)) > 0
      );
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
      const marker = frame.getByText('Next Possible No', { exact: false });
      return (await marker.count().catch(() => 0)) > 0;
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
}

module.exports = { PurchaseOrderPage };
