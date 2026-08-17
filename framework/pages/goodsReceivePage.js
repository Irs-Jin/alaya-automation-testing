const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Purchase > Goods Receive.
 *
 * SOURCE: no recording available for this screen — built by live-probing
 * the real app directly (2026-08-17), per the user's own description
 * ("similar like Purchase Order, use Copy From to get the details").
 * Confirmed live to indeed share the same New -> select Vendor -> Copy
 * From > Purchase Order -> "Transfer from PO" dialog -> Post shape already
 * built for ClosePurchaseOrderPage — same underlying "Transfer from PO"
 * control (checkbox-select a row, OK), just under this screen's own root
 * control ("PurchaseGoodReceiveDetail1", document prefix "GR-").
 *
 * ONE confirmed difference from Purchase Order / Close Purchase Order:
 * Goods Receive has its own required field, "Supplier D/O No." — Post
 * fails outright without it ("Supplier D/O No. is required"), and reusing
 * an already-used value triggers its own "...already exists, do you want
 * to continue?" dialog. fillSupplierDoNo() defaults to a timestamped,
 * guaranteed-unique value specifically to avoid ever needing to answer
 * that dialog, rather than guessing at its (unconfirmed) button ids.
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable across navigations — always re-resolved via findFrame() by
 * content, never hardcoded.
 */
class GoodsReceivePage {
  constructor(page) {
    this.page = page;
    this.listFrame = null;
    this.formFrame = null;
  }

  async goto() {
    const p = this.page;
    // Clicking "Purchase" TOGGLES its submenu open/closed (confirmed live
    // via PurchaseOrderPage/ClosePurchaseOrderPage) — only click it if the
    // target link isn't already visible, so this stays correct even when
    // another Purchase-module page object already expanded it earlier in
    // the same test.
    const goodsReceiveLink = p.getByRole('link', { name: 'Goods Receive', exact: true });
    const alreadyExpanded = await goodsReceiveLink.isVisible().catch(() => false);
    if (!alreadyExpanded) {
      await p.getByRole('link', { name: 'Purchase', exact: true }).click();
    }
    await goodsReceiveLink.click();
    // 'domcontentloaded', not 'networkidle' — confirmed elsewhere in this
    // repo (ClosePurchaseOrderPage) to hang once other in-app tabs are
    // already open in the background.
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
      // live pattern, same fix already applied to Purchase Order / Close
      // Purchase Order).
      const company = frame.getByText('Company:', { exact: false });
      const posted = frame.getByText('POSTED', { exact: false });
      if ((await company.count().catch(() => 0)) === 0) return false;
      if ((await posted.count().catch(() => 0)) === 0) return false;
      return await company.first().isVisible().catch(() => false);
    });
    if (!this.listFrame) {
      await p.screenshot({ path: 'test-results/debug-goods-receive-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Goods Receive listing frame. ' +
        'Saved test-results/debug-goods-receive-list-page.png for inspection.'
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
      await p.screenshot({ path: 'test-results/debug-goods-receive-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Goods Receive create/edit form frame. ' +
        'Saved test-results/debug-goods-receive-form-not-found.png for inspection.'
      );
    }
  }

  async clickNew() {
    const addIcon = this.listFrame.getByRole('img', { name: /Click Here Or Press \[Insert\]/i }).first();
    await addIcon.waitFor({ state: 'visible', timeout: 5000 });
    await addIcon.click();
    await this._resolveFormFrame();
  }

  /** Same Vendor search-popup shape as Purchase Order / Close Purchase Order — confirmed live: identical id suffixes. */
  async selectVendor(vendorCode) {
    const f = this.formFrame;
    const { locator: trigger } = await heal(f, {
      id: 'goodsReceive.vendorTrigger',
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
      id: 'goodsReceive.vendorPopupOkButton',
      label: 'OK',
      strategies: [
        { type: 'css', value: '[id$="cbVendor_gsc_cbVendor_pcGeneralSearchControl_cpnlGeneralSearchControl_formGeneralSearchControl_btnOk_CD" i]' },
      ],
      timeout: 5000,
    });
    await okButton.click();
  }

  /**
   * Clicks "Copy From" then "Purchase Order" — same shape as
   * ClosePurchaseOrderPage.clickCopyFromPurchaseOrder(): with only one
   * source available, the dialog opens directly with no separate menu
   * item to click, confirmed live for this screen too.
   */
  async clickCopyFromPurchaseOrder() {
    const f = this.formFrame;
    const { locator: copyFromButton } = await heal(f, {
      id: 'goodsReceive.copyFromButton',
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
   * applied for Close Purchase Order: getByRole('row', {name: poDocNo})
   * produced ambiguous matches there, so this filters `tr.dxgvDataRow_iOS`
   * by text content and clicks that row's own checkbox cell directly.
   */
  async selectPurchaseOrderToTransfer(poDocNo) {
    const f = this.formFrame;
    await f.getByText('Transfer from PO', { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 });

    const targetRow = f.locator('tr.dxgvDataRow_iOS').filter({ hasText: poDocNo });
    await targetRow.first().waitFor({ state: 'visible', timeout: 10000 });
    await targetRow.first().locator('td.dxgvCommandColumn_iOS').first().click();
    await this.page.waitForTimeout(500);

    const { locator: okButton } = await heal(f, {
      id: 'goodsReceive.transferOkButton',
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
   * Fills the required "Supplier D/O No." field. CONFIRMED live: Post
   * fails with "Supplier D/O No. is required" if this is left blank.
   * Defaults to a timestamped value so it's always unique — reusing a
   * value already used elsewhere triggers its own "...already exists, do
   * you want to continue?" confirm dialog (confirmed present via this
   * screen's own JS, `CheckDuplicateSupplierInv()`), whose real button
   * ids weren't captured during the live probe (a unique value every run
   * avoids ever needing them, rather than guessing).
   */
  async fillSupplierDoNo(value = `TESTING-DO-${Date.now()}`) {
    const f = this.formFrame;
    const field = f.locator('[id$="txtRefNo_I" i]');
    await field.first().click();
    await field.first().pressSequentially(value, { delay: 20 });
  }

  async clickPost() {
    const { locator } = await heal(this.formFrame, {
      id: 'goodsReceive.postButton',
      label: 'Post',
      strategies: [
        { type: 'css', value: '[title="Post [Alt + P]"]' },
        { type: 'text', value: 'Post', options: { exact: true } },
      ],
      timeout: 5000,
    });
    await locator.click();
    // Same class of "posting isn't instant" timing already documented for
    // Purchase Order / Close Purchase Order / Cash Sales' own Post.
    await this.page.waitForTimeout(5000);
  }

  /** Full flow: select vendor, transfer from the given PO, fill Supplier D/O No., Post. */
  async receiveGoods({ vendorCode, poDocNo, supplierDoNo }) {
    await this.selectVendor(vendorCode);
    await this.clickCopyFromPurchaseOrder();
    await this.selectPurchaseOrderToTransfer(poDocNo);
    await this.fillSupplierDoNo(supplierDoNo);
    await this.clickPost();
  }

  /**
   * Checks whether the document actually posted — same "strongest
   * available proof" approach as PurchaseOrderPage/ClosePurchaseOrderPage:
   * Post auto-opens a report tab. CONFIRMED live: titled "Good Receive
   * Summary With Cost And Price Report" (note "Good Receive", not "Goods
   * Receive" — the app's own inconsistent naming, not a typo here).
   */
  async expectPostSuccess() {
    const reportTab = this.page.getByText('Good Receive Summary With Cost And Price Report', { exact: false });
    return (await reportTab.count().catch(() => 0)) > 0;
  }
}

module.exports = { GoodsReceivePage };
