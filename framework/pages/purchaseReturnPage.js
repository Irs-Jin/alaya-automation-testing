const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Purchase > Purchase Return.
 *
 * SOURCE: no recording available — built by live-probing the real app
 * directly (2026-08-17). Similar shape to Close Purchase Order / Goods
 * Receive / Purchase Invoice, but with two CONFIRMED differences:
 *
 * 1. Copy From transfers from a POSTED PURCHASE INVOICE, not a Purchase
 *    Order — dialog title is "Transfer from PI", listing PI-XXXXX
 *    documents. This suite's test therefore chains PO -> Purchase Invoice
 *    (posted) -> Purchase Return, never touching Goods Receive at all for
 *    this screen's own test.
 * 2. Has NO "Save Draft" button in the actual UI — confirmed live: the
 *    title="Save Draft [Alt + S]" element exists in the raw DOM (likely
 *    shared/leftover markup from the same underlying toolbar component
 *    other Purchase screens use) but is never rendered in this screen's
 *    toolbar, and "More Options" opens a "Document Info" popup instead of
 *    revealing it. Don't trust the id's mere presence — see CLAUDE.md's
 *    own caution about this. Only Post / Post & New are offered here.
 *
 * ALSO CONFIRMED: this screen requires a Delivery Address (Logistics tab)
 * before Post will succeed — "Address1: Is required" / "City: Is
 * required" otherwise. Not required on any other Purchase screen built so
 * far; specific to Return, presumably because returning goods needs a
 * physical pickup/delivery address.
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable across navigations — always re-resolved via findFrame() by
 * content, never hardcoded.
 */
class PurchaseReturnPage {
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
    const purchaseReturnLink = p.getByRole('link', { name: 'Purchase Return', exact: true });
    const alreadyExpanded = await purchaseReturnLink.isVisible().catch(() => false);
    if (!alreadyExpanded) {
      await p.getByRole('link', { name: 'Purchase', exact: true }).click();
    }
    await purchaseReturnLink.click();
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
      await p.screenshot({ path: 'test-results/debug-purchase-return-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Purchase Return listing frame. ' +
        'Saved test-results/debug-purchase-return-list-page.png for inspection.'
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
      await p.screenshot({ path: 'test-results/debug-purchase-return-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Purchase Return create/edit form frame. ' +
        'Saved test-results/debug-purchase-return-form-not-found.png for inspection.'
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
      id: 'purchaseReturn.vendorTrigger',
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
      id: 'purchaseReturn.vendorPopupOkButton',
      label: 'OK',
      strategies: [
        { type: 'css', value: '[id$="cbVendor_gsc_cbVendor_pcGeneralSearchControl_cpnlGeneralSearchControl_formGeneralSearchControl_btnOk_CD" i]' },
      ],
      timeout: 5000,
    });
    await okButton.click();
  }

  /**
   * Clicks "Copy From" then "Purchase Invoice" — CONFIRMED live: this
   * screen copies from a posted Purchase Invoice, not a Purchase Order
   * (dialog title "Transfer from PI"). Same "dialog may open directly with
   * only one source available" shape already confirmed elsewhere.
   */
  async clickCopyFromPurchaseInvoice() {
    const f = this.formFrame;
    const { locator: copyFromButton } = await heal(f, {
      id: 'purchaseReturn.copyFromButton',
      label: 'Copy From',
      strategies: [
        { type: 'css', value: '[title="Copy From [Alt + M]"]' },
      ],
      timeout: 5000,
    });
    await copyFromButton.click();
    await this.page.waitForTimeout(800);

    const dialogAlreadyOpen = await f.getByText('Transfer from PI', { exact: false })
      .first().isVisible().catch(() => false);
    if (dialogAlreadyOpen) return;

    const menuItem = f.locator('span.dx-vam:visible:text-is("Purchase Invoice")');
    await menuItem.first().click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Checks the given PI's row in the "Transfer from PI" dialog and
   * confirms with the dialog's own OK. Same row-scoping fix already
   * applied throughout this module: getByRole('row', {name: piDocNo})
   * produces ambiguous matches, so this filters `tr.dxgvDataRow_iOS` by
   * text content and clicks that row's own checkbox cell directly.
   */
  async selectPurchaseInvoiceToTransfer(piDocNo) {
    const f = this.formFrame;
    await f.getByText('Transfer from PI', { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 });

    const targetRow = f.locator('tr.dxgvDataRow_iOS').filter({ hasText: piDocNo });
    await targetRow.first().waitFor({ state: 'visible', timeout: 10000 });
    await targetRow.first().locator('td.dxgvCommandColumn_iOS').first().click();
    await this.page.waitForTimeout(500);

    const { locator: okButton } = await heal(f, {
      id: 'purchaseReturn.transferOkButton',
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
   * Fills the required Delivery Address (Logistics tab > Address1 + City).
   * CONFIRMED live: Post fails with "Address1: Is required" / "City: Is
   * required" without this. City defaults to "PUCHONG" — matches this
   * company's own registered city (SHANTHI QA BIZ 69, Desa Kiambang,
   * Puchong, Selangor), a safe, always-present choice confirmed live via
   * the City picker's own search grid (440 cities, Country/State/City
   * columns).
   */
  async fillDeliveryAddress(address = 'TESTING ADDRESS 1', cityName = 'PUCHONG') {
    const f = this.formFrame;
    await f.getByText('Logistics', { exact: true }).first().click();
    await this.page.waitForTimeout(500);

    const addressField = f.locator('[id$="txtAddress1_I" i]');
    await addressField.first().click();
    await addressField.first().pressSequentially(address, { delay: 20 });

    const { locator: cityTrigger } = await heal(f, {
      id: 'purchaseReturn.cityTrigger',
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
      id: 'purchaseReturn.cityPopupOkButton',
      label: 'OK',
      strategies: [
        { type: 'css', value: '[id$="gsc_cbCity_pcGeneralSearchControl_cpnlGeneralSearchControl_formGeneralSearchControl_btnOk_CD" i]' },
      ],
      timeout: 5000,
    });
    await cityOkButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * CONFIRMED live: waits for the actual report-tab signal rather than a
   * fixed delay — same fix already needed for Purchase Invoice's own
   * clickPost() (a fixed 5s wait intermittently came back too early).
   */
  async clickPost() {
    const { locator } = await heal(this.formFrame, {
      id: 'purchaseReturn.postButton',
      label: 'Post',
      strategies: [
        { type: 'css', value: '[title="Post [Alt + P]"]' },
        { type: 'text', value: 'Post', options: { exact: true } },
      ],
      timeout: 5000,
    });
    await locator.click();
    await this.page.getByText('Purchase Return Detail GST (eInvoice)', { exact: false })
      .first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    await this.page.waitForTimeout(1000);
  }

  /**
   * Same "Post & New doesn't open a report tab" shape already confirmed
   * for Purchase Invoice — waits for the form to genuinely reset (Vendor
   * field empty again) instead.
   */
  async clickPostAndNew() {
    const { locator } = await heal(this.formFrame, {
      id: 'purchaseReturn.postAndNewButton',
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

  /** Full flow through transfer + delivery address — action (Post/Post & New) is the caller's own next step. */
  async prepareReturn({ vendorCode, piDocNo, address, cityName }) {
    await this.selectVendor(vendorCode);
    await this.clickCopyFromPurchaseInvoice();
    await this.selectPurchaseInvoiceToTransfer(piDocNo);
    await this.fillDeliveryAddress(address, cityName);
  }

  /**
   * Checks whether the document actually posted — Post auto-opens a
   * report tab. CONFIRMED live: titled "Purchase Return Detail GST
   * (eInvoice) Report".
   */
  async expectPostSuccess() {
    const reportTab = this.page.getByText('Purchase Return Detail GST (eInvoice)', { exact: false });
    return (await reportTab.count().catch(() => 0)) > 0;
  }

  /**
   * Reads the "[Next Possible No.PR-XXXXX]" number from the form header —
   * used as before/after proof for "Post & New", same reasoning as
   * PurchaseInvoicePage.getNextPossibleNo().
   */
  async getNextPossibleNo() {
    const header = this.formFrame.getByText('Next Possible No', { exact: false });
    const text = await header.first().innerText().catch(() => '');
    const match = text.match(/PR-\d+/);
    return match ? match[0] : null;
  }

  /** Checks the form reset to a blank state after "Post & New". */
  async expectFormReset() {
    const vendorField = this.formFrame.locator('[id$="cbVendor_cbVendor_I" i]');
    const value = await vendorField.first().inputValue().catch(() => 'unknown');
    return value.trim() === '';
  }
}

module.exports = { PurchaseReturnPage };
