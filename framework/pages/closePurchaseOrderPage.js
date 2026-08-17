const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Purchase > Close Purchase Order.
 *
 * SOURCE: built from a screen recording the user provided (Close Purchase
 * Order Flow 1, 2026-08-17) showing New -> select Vendor -> Copy From >
 * Purchase Order -> "Transfer from PO" dialog (Full Transfer tab, check
 * one existing open PO's row, OK) -> Warehouse + Items auto-fill from that
 * PO -> Post -> auto-opened ClosePurchaseOrderSummaryGST Report tab. Every
 * selector was then CONFIRMED live (2026-08-17) via a throwaway diagnostic
 * script, not guessed from the recording.
 *
 * SHAPE: this screen shares the exact same underlying header/vendor/items
 * control as PurchaseOrderPage (confirmed live: its Vendor field is
 * literally the same "PurchaseOrderDetail1...cbVendor" control, same ids),
 * plus its own "Transfer from PO" control (root id prefix
 * "CancelPurchaseOrderDetail1...TransferFrom" — the app's internal name
 * for this screen is "CancelPurchaseOrder", not "ClosePurchaseOrder").
 *
 * IMPORTANT — test independence: closing a PO consumes it (it stops
 * appearing as "open" in Transfer from PO afterward), so a repeatable test
 * cannot just pick an arbitrary existing PO from the shared environment —
 * it might already be closed, or get closed by someone else's test.
 * selectPurchaseOrderToTransfer() is designed to target a doc number the
 * CALLER supplies — the spec is expected to create+post a fresh
 * PurchaseOrderPage document first (via getPostedDocumentNumber()) and
 * transfer from THAT, guaranteeing a valid, not-yet-closed target every
 * run, rather than depending on shared/pre-existing data.
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable across navigations — always re-resolved via findFrame() by
 * content, never hardcoded.
 */
class ClosePurchaseOrderPage {
  constructor(page) {
    this.page = page;
    this.listFrame = null;
    this.formFrame = null;
  }

  async goto() {
    const p = this.page;
    // BUG FIXED (2026-08-17): clicking "Purchase" TOGGLES its submenu
    // open/closed rather than idempotently opening it — confirmed live
    // via a failure screenshot showing the Purchase submenu COLLAPSED
    // (not expanded) after this click, because a prior PurchaseOrderPage
    // navigation earlier in the same test had already expanded it. Only
    // click it if the target link isn't already visible.
    const closePoLink = p.getByRole('link', { name: 'Close Purchase Order', exact: true });
    const alreadyExpanded = await closePoLink.isVisible().catch(() => false);
    if (!alreadyExpanded) {
      await p.getByRole('link', { name: 'Purchase', exact: true }).click();
    }
    await closePoLink.click();
    // BUG FIXED (2026-08-17): 'networkidle' was confirmed live to hang
    // indefinitely once other in-app tabs (e.g. a Purchase Order tab and
    // its auto-opened GST report) are already open in the background —
    // their own residual activity seems to keep the page from ever
    // reaching network-idle. 'domcontentloaded' + a short settle wait,
    // same pattern already used elsewhere in this repo, avoids it.
    await p.waitForLoadState('domcontentloaded');
    await p.waitForTimeout(2000);
    await this._resolveListFrame();
  }

  async _resolveListFrame() {
    const p = this.page;
    this.listFrame = await findFrame(p, async (frame) => {
      // "Company:" + "POSTED" together (not "Company:" alone — that also
      // matches this app's left-nav menu frame) AND visible — Purchase
      // Order's own listing screen has the exact same two markers, so a
      // Purchase Order list tab left open in the background would
      // otherwise false-match here too (confirmed live during the probe
      // that built this page object).
      const company = frame.getByText('Company:', { exact: false });
      const posted = frame.getByText('POSTED', { exact: false });
      if ((await company.count().catch(() => 0)) === 0) return false;
      if ((await posted.count().catch(() => 0)) === 0) return false;
      return await company.first().isVisible().catch(() => false);
    });
    if (!this.listFrame) {
      await p.screenshot({ path: 'test-results/debug-close-purchase-order-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Close Purchase Order listing frame. ' +
        'Saved test-results/debug-close-purchase-order-list-page.png for inspection.'
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
      await p.screenshot({ path: 'test-results/debug-close-purchase-order-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Close Purchase Order create/edit form frame. ' +
        'Saved test-results/debug-close-purchase-order-form-not-found.png for inspection.'
      );
    }
  }

  async clickNew() {
    const addIcon = this.listFrame.getByRole('img', { name: /Click Here Or Press \[Insert\]/i }).first();
    await addIcon.waitFor({ state: 'visible', timeout: 5000 });
    await addIcon.click();
    await this._resolveFormFrame();
  }

  /** Same Vendor search-popup control as PurchaseOrderPage (confirmed live: identical ids). */
  async selectVendor(vendorCode) {
    const f = this.formFrame;
    const { locator: trigger } = await heal(f, {
      id: 'closePurchaseOrder.vendorTrigger',
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
      id: 'closePurchaseOrder.vendorPopupOkButton',
      label: 'OK',
      strategies: [
        { type: 'css', value: '[id$="cbVendor_gsc_cbVendor_pcGeneralSearchControl_cpnlGeneralSearchControl_formGeneralSearchControl_btnOk_CD" i]' },
      ],
      timeout: 5000,
    });
    await okButton.click();
  }

  /**
   * Clicks "Copy From" then "Purchase Order". CONFIRMED live: with only
   * one PO available to copy from, clicking "Copy From" opened the
   * "Transfer from PO" dialog directly, with no separate visible menu
   * item to click afterward — so this checks for the dialog first and
   * only falls back to clicking the "Purchase Order" menu item (the same
   * "multiple hidden dx-vam clones, only one genuinely visible" pattern
   * already documented for Cash Sales/Purchase Order's own OK/Yes
   * buttons) if the dialog didn't already open on its own.
   */
  async clickCopyFromPurchaseOrder() {
    const f = this.formFrame;
    const { locator: copyFromButton } = await heal(f, {
      id: 'closePurchaseOrder.copyFromButton',
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
   * Checks the given PO's row in the "Transfer from PO" dialog (Full
   * Transfer tab, selected by default) and confirms with the dialog's own
   * OK. Scoped to the row's own checkbox cell rather than the row itself —
   * confirmed live that matching by getByRole('row', {name: poDocNo})
   * produced 4 ambiguous matches for what should be a unique doc number
   * (likely counting nested/virtualized duplicates), and clicking the
   * wrong one left nothing actually selected (a real "Please select at
   * least 1 document" error was reproduced this way). Filtering
   * `tr.dxgvDataRow_iOS` by text content, then clicking that row's own
   * `td.dxgvCommandColumn_iOS` checkbox cell, resolved unambiguously.
   */
  async selectPurchaseOrderToTransfer(poDocNo) {
    const f = this.formFrame;
    await f.getByText('Transfer from PO', { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 });

    const targetRow = f.locator('tr.dxgvDataRow_iOS').filter({ hasText: poDocNo });
    await targetRow.first().waitFor({ state: 'visible', timeout: 10000 });
    await targetRow.first().locator('td.dxgvCommandColumn_iOS').first().click();
    await this.page.waitForTimeout(500);

    const { locator: okButton } = await heal(f, {
      id: 'closePurchaseOrder.transferOkButton',
      label: 'OK',
      strategies: [
        { type: 'css', value: '[id$="btnPurchaseTransferOk_CD" i]' },
      ],
      timeout: 5000,
    });
    await okButton.click();
    await this.page.waitForTimeout(1500);
  }

  async clickPost() {
    const { locator } = await heal(this.formFrame, {
      id: 'closePurchaseOrder.postButton',
      label: 'Post',
      strategies: [
        { type: 'css', value: '[title="Post [Alt + P]"]' },
        { type: 'text', value: 'Post', options: { exact: true } },
      ],
      timeout: 5000,
    });
    await locator.click();
    // Same class of "posting isn't instant" timing already documented for
    // Purchase Order / Cash Sales' own Post.
    await this.page.waitForTimeout(5000);
  }

  /** Full flow: select vendor, transfer from the given PO, Post. */
  async closePurchaseOrder({ vendorCode, poDocNo }) {
    await this.selectVendor(vendorCode);
    await this.clickCopyFromPurchaseOrder();
    await this.selectPurchaseOrderToTransfer(poDocNo);
    await this.clickPost();
  }

  /**
   * Checks whether the document actually posted — same "strongest
   * available proof" approach as PurchaseOrderPage.expectPostSuccess():
   * Post auto-opens a "ClosePurchaseOrderSummaryGST Report" tab.
   */
  async expectPostSuccess() {
    const reportTab = this.page.getByText('ClosePurchaseOrderSummaryGST Report', { exact: false });
    return (await reportTab.count().catch(() => 0)) > 0;
  }
}

module.exports = { ClosePurchaseOrderPage };
