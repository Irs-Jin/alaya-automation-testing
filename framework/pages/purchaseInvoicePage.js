const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Purchase > Purchase Invoice.
 *
 * SOURCE: no recording available — built by live-probing the real app
 * directly (2026-08-17), same shape already confirmed for
 * ClosePurchaseOrderPage / GoodsReceivePage: New -> select Vendor -> Copy
 * From > Purchase Order -> "Transfer from PO" dialog -> fill the screen's
 * own required reference field -> Save Draft / Post / Post & New.
 *
 * CONFIRMED live (2026-08-17): a fully-received PO (one that's been
 * transferred into a Goods Receive already) drops out of every "Transfer
 * from PO" picker project-wide — this screen's test must transfer from a
 * still-open PO, NOT one that's already been received.
 *
 * Same required-reference-field pattern as GoodsReceivePage's "Supplier
 * D/O No.": here it's "Supplier Inv. No." (still id suffix `txtRefNo_I`).
 * Defaults to a timestamped, always-unique value for the same reason —
 * avoids ever needing to answer the "...already exists" duplicate-check
 * dialog this screen's own JS implies exists (unconfirmed button ids).
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable across navigations — always re-resolved via findFrame() by
 * content, never hardcoded.
 */
class PurchaseInvoicePage {
  constructor(page) {
    this.page = page;
    this.listFrame = null;
    this.formFrame = null;
  }

  async goto() {
    const p = this.page;
    // Clicking "Purchase" TOGGLES its submenu open/closed (confirmed live
    // via PurchaseOrderPage/ClosePurchaseOrderPage/GoodsReceivePage) —
    // only click it if the target link isn't already visible.
    const purchaseInvoiceLink = p.getByRole('link', { name: 'Purchase Invoice', exact: true });
    const alreadyExpanded = await purchaseInvoiceLink.isVisible().catch(() => false);
    if (!alreadyExpanded) {
      await p.getByRole('link', { name: 'Purchase', exact: true }).click();
    }
    await purchaseInvoiceLink.click();
    // 'domcontentloaded', not 'networkidle' — confirmed elsewhere in this
    // repo to hang once other in-app tabs are already open in the
    // background.
    await p.waitForLoadState('domcontentloaded');
    await p.waitForTimeout(2000);
    await this._resolveListFrame();
  }

  async _resolveListFrame() {
    const p = this.page;
    this.listFrame = await findFrame(p, async (frame) => {
      // "Company:" + "POSTED" together, AND visible — both markers alone
      // also match this app's left-nav menu frame and/or another Purchase
      // module's own listing tab left open in the background (confirmed
      // live pattern, same fix already applied elsewhere in this module).
      const company = frame.getByText('Company:', { exact: false });
      const posted = frame.getByText('POSTED', { exact: false });
      if ((await company.count().catch(() => 0)) === 0) return false;
      if ((await posted.count().catch(() => 0)) === 0) return false;
      return await company.first().isVisible().catch(() => false);
    });
    if (!this.listFrame) {
      await p.screenshot({ path: 'test-results/debug-purchase-invoice-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Purchase Invoice listing frame. ' +
        'Saved test-results/debug-purchase-invoice-list-page.png for inspection.'
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
      await p.screenshot({ path: 'test-results/debug-purchase-invoice-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Purchase Invoice create/edit form frame. ' +
        'Saved test-results/debug-purchase-invoice-form-not-found.png for inspection.'
      );
    }
  }

  async clickNew() {
    const addIcon = this.listFrame.getByRole('img', { name: /Click Here Or Press \[Insert\]/i }).first();
    await addIcon.waitFor({ state: 'visible', timeout: 5000 });
    await addIcon.click();
    await this._resolveFormFrame();
  }

  /** Same Vendor search-popup shape confirmed for Purchase Order / Close Purchase Order / Goods Receive. */
  async selectVendor(vendorCode) {
    const f = this.formFrame;
    const { locator: trigger } = await heal(f, {
      id: 'purchaseInvoice.vendorTrigger',
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
      id: 'purchaseInvoice.vendorPopupOkButton',
      label: 'OK',
      strategies: [
        { type: 'css', value: '[id$="cbVendor_gsc_cbVendor_pcGeneralSearchControl_cpnlGeneralSearchControl_formGeneralSearchControl_btnOk_CD" i]' },
      ],
      timeout: 5000,
    });
    await okButton.click();
  }

  /**
   * Clicks "Copy From" then "Purchase Order" — same shape confirmed for
   * Close Purchase Order / Goods Receive: with only one source available,
   * the dialog opens directly with no separate menu item to click.
   */
  async clickCopyFromPurchaseOrder() {
    const f = this.formFrame;
    const { locator: copyFromButton } = await heal(f, {
      id: 'purchaseInvoice.copyFromButton',
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
   * Checks the given PO's row in the "Transfer from PO" dialog and
   * confirms with the dialog's own OK. Same row-scoping fix already
   * applied for Close Purchase Order / Goods Receive:
   * getByRole('row', {name: poDocNo}) produced ambiguous matches, so this
   * filters `tr.dxgvDataRow_iOS` by text content and clicks that row's
   * own checkbox cell directly.
   */
  async selectPurchaseOrderToTransfer(poDocNo) {
    const f = this.formFrame;
    await f.getByText('Transfer from PO', { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 });

    const targetRow = f.locator('tr.dxgvDataRow_iOS').filter({ hasText: poDocNo });
    await targetRow.first().waitFor({ state: 'visible', timeout: 10000 });
    await targetRow.first().locator('td.dxgvCommandColumn_iOS').first().click();
    await this.page.waitForTimeout(500);

    const { locator: okButton } = await heal(f, {
      id: 'purchaseInvoice.transferOkButton',
      label: 'OK',
      strategies: [
        { type: 'css', value: '[id$="btnPurchaseTransferOk_CD" i]' },
      ],
      timeout: 5000,
    });
    await okButton.click();
    await this.page.waitForTimeout(1500);
  }

  /**
   * Fills the required "Supplier Inv. No." field. CONFIRMED live: same
   * id suffix as Goods Receive's "Supplier D/O No." (`txtRefNo_I`).
   * Defaults to a timestamped value so it's always unique.
   */
  async fillSupplierInvNo(value = `TESTING-INV-${Date.now()}`) {
    const f = this.formFrame;
    const field = f.locator('[id$="txtRefNo_I" i]');
    await field.first().click();
    await field.first().pressSequentially(value, { delay: 20 });
  }

  async clickSaveDraft() {
    const { locator } = await heal(this.formFrame, {
      id: 'purchaseInvoice.saveDraftButton',
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

  async clickPost() {
    const { locator } = await heal(this.formFrame, {
      id: 'purchaseInvoice.postButton',
      label: 'Post',
      strategies: [
        { type: 'css', value: '[title="Post [Alt + P]"]' },
        { type: 'text', value: 'Post', options: { exact: true } },
      ],
      timeout: 5000,
    });
    await locator.click();
    await this.page.waitForTimeout(5000);
  }

  /**
   * CONFIRMED live: title matches the same "Post & New" pattern already
   * used for Purchase Order/Cash Sales.
   *
   * BUG FIXED (2026-08-17): unlike plain Post, "Post & New" does NOT
   * auto-open a report tab — confirmed live via a failure screenshot that
   * initially looked like a timing problem (form still showing [DEFAULT]/
   * loading), but a closer look showed the form HAD already reset
   * correctly (empty Vendor, empty Items, "Next Possible No" advanced) —
   * it just never opens the report, since the whole point of this button
   * is to move straight to the next entry. Waits for the form to
   * genuinely reset instead (Vendor field empty again), which is this
   * action's own real completion signal — see expectFormReset().
   */
  async clickPostAndNew() {
    const { locator } = await heal(this.formFrame, {
      id: 'purchaseInvoice.postAndNewButton',
      label: 'Post & New',
      strategies: [
        { type: 'css', value: '[title="Post & New [Alt + Ctrl + P]"]' },
        { type: 'text', value: 'Post & New', options: { exact: true } },
      ],
      timeout: 5000,
    });
    await locator.click();
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

  /** Full flow through transfer + reference no. — action (Save Draft/Post/Post & New) is the caller's own next step. */
  async prepareInvoice({ vendorCode, poDocNo, supplierInvNo }) {
    await this.selectVendor(vendorCode);
    await this.clickCopyFromPurchaseOrder();
    await this.selectPurchaseOrderToTransfer(poDocNo);
    await this.fillSupplierInvNo(supplierInvNo);
  }

  /**
   * Checks whether Save Draft actually succeeded. CONFIRMED live: a
   * "Saved Successfully" banner appears within the form frame (same
   * generic ASPx save-confirmation banner already seen elsewhere in this
   * repo, e.g. Cash Sales' Post flow) — more direct proof than reading any
   * particular field's value.
   */
  async expectSaveDraftSuccess() {
    const banner = this.formFrame.getByText(/saved success/i);
    return (await banner.count().catch(() => 0)) > 0;
  }

  /**
   * Checks whether the document actually posted — same "strongest
   * available proof" approach as PurchaseOrderPage/GoodsReceivePage: Post
   * auto-opens a report tab. CONFIRMED live: titled "Purchase Invoice
   * Detail (eInvoice) With Cost And Price Report".
   */
  async expectPostSuccess() {
    const reportTab = this.page.getByText('Purchase Invoice Detail (eInvoice)', { exact: false });
    return (await reportTab.count().catch(() => 0)) > 0;
  }

  /**
   * Reads the "[Next Possible No.PI-XXXXX]" number from the form header.
   * Used by the "Post & New" test as before/after proof that a real
   * document was actually posted and consumed — since Post & New doesn't
   * open a report tab (see clickPostAndNew()), a genuinely reset form
   * alone doesn't distinguish "posted, then reset" from "just reset
   * without posting"; the possible-next-number advancing does.
   */
  async getNextPossibleNo() {
    const header = this.formFrame.getByText('Next Possible No', { exact: false });
    const text = await header.first().innerText().catch(() => '');
    const match = text.match(/PI-\d+/);
    return match ? match[0] : null;
  }

  /**
   * Checks the form reset to a blank state after "Post & New" — the
   * Vendor field goes back to its empty placeholder (same "New clears the
   * form" behavior already documented for Cash Sales).
   */
  async expectFormReset() {
    const vendorField = this.formFrame.locator('[id$="cbVendor_cbVendor_I" i]');
    const value = await vendorField.first().inputValue().catch(() => 'unknown');
    return value.trim() === '';
  }
}

module.exports = { PurchaseInvoicePage };
