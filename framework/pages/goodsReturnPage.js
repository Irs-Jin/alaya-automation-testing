const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Purchase > Goods Return.
 *
 * SOURCE: no recording available — built by live-probing the real app
 * directly (2026-08-18) using the playwright-cli interactive tool. Same
 * overall shape as Purchase Return: New -> select Vendor -> Copy From ->
 * "Transfer from GR" dialog (Full Transfer tab, checkbox-select one row,
 * OK) -> Warehouse + Items auto-fill from that Goods Receive -> fill
 * Delivery Address (Logistics tab) -> Post / Post & New.
 *
 * CONFIRMED live differences from Purchase Return:
 * 1. Transfers from a POSTED GOODS RECEIVE, not a Purchase Invoice —
 *    dialog title "Transfer from GR", listing GR-XXXXX documents.
 * 2. Has a free-text "Reference No." field (`txtRefNo_I`, same id suffix
 *    as every other reference field in this module) — NOT marked required
 *    (no asterisk), unlike Cash Purchase/Purchase Invoice/Goods Receive's
 *    own required reference fields. Filled anyway with a unique
 *    TESTING-prefixed value so a specific document can be searched for
 *    later (used as the Cancel test's search key).
 * 3. Delivery Address requires BOTH Address1 AND Address3 (Purchase
 *    Return's own version only requires Address1) — confirmed live via
 *    the exact validation errors: "Address1: Is required" / "Address3: Is
 *    required" / "City: Is required". City defaults to "PUCHONG", same
 *    reasoning as Purchase Return's own default (this company's own
 *    registered city).
 * 4. "Save Draft" IS visible in the toolbar on a blank new form, but
 *    CONFIRMED live it disappears from the toolbar once a Transfer From
 *    has completed (Warehouse/Items populated) — so in practice, like
 *    Purchase Return, only Post / Post & New are usable once there's
 *    actually a document to save. Not exercised here for that reason.
 * 5. Internal control name is "PurchaseGoodReturn" (root id prefix
 *    `PurchaseGoodReturnDetail1`), document prefix "GT-" (not "GR-",
 *    which is Goods Receive's own prefix) — confirmed live via the
 *    "[Next Possible No.GT-XXXXX]" form header and the auto-opened
 *    report's own "Goods Ret. No :GT-XXXXX" field.
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable across navigations — always re-resolved via findFrame() by
 * content, never hardcoded.
 */
class GoodsReturnPage {
  constructor(page) {
    this.page = page;
    this.listFrame = null;
    this.formFrame = null;
  }

  async goto() {
    const p = this.page;
    // Scoped to #navBar from the start (same fix every other Purchase
    // screen in this module needed) — cancelDocument() navigates back to
    // this listing after Post, and the unscoped locator would become
    // ambiguous the second time goto() runs in one test.
    const navBar = p.locator('#navBar');
    const goodsReturnLink = navBar.getByRole('link', { name: 'Goods Return', exact: true });
    const alreadyExpanded = await goodsReturnLink.isVisible().catch(() => false);
    if (!alreadyExpanded) {
      await navBar.getByRole('link', { name: 'Purchase', exact: true }).click();
    }
    await goodsReturnLink.click();
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
      await p.screenshot({ path: 'test-results/debug-goods-return-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Goods Return listing frame. ' +
        'Saved test-results/debug-goods-return-list-page.png for inspection.'
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
      await p.screenshot({ path: 'test-results/debug-goods-return-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Goods Return create/edit form frame. ' +
        'Saved test-results/debug-goods-return-form-not-found.png for inspection.'
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
      id: 'goodsReturn.vendorTrigger',
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
      id: 'goodsReturn.vendorPopupOkButton',
      label: 'OK',
      strategies: [
        { type: 'css', value: '[id$="cbVendor_gsc_cbVendor_pcGeneralSearchControl_cpnlGeneralSearchControl_formGeneralSearchControl_btnOk_CD" i]' },
      ],
      timeout: 5000,
    });
    await okButton.click();
  }

  /**
   * Clicks "Copy From" then "Goods Receive" — CONFIRMED live: this screen
   * copies from a posted Goods Receive, dialog title "Transfer from GR".
   * Same "dialog may open directly with only one source available" shape
   * already confirmed elsewhere in this module.
   */
  async clickCopyFromGoodsReceive() {
    const f = this.formFrame;
    const { locator: copyFromButton } = await heal(f, {
      id: 'goodsReturn.copyFromButton',
      label: 'Copy From',
      strategies: [
        { type: 'css', value: '[title="Copy From [Alt + M]"]' },
      ],
      timeout: 5000,
    });
    await copyFromButton.click();
    await this.page.waitForTimeout(800);

    const dialogAlreadyOpen = await f.getByText('Transfer from GR', { exact: false })
      .first().isVisible().catch(() => false);
    if (dialogAlreadyOpen) return;

    const menuItem = f.locator('span.dx-vam:visible:text-is("Goods Receive")');
    await menuItem.first().click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Checks the given GR's row in the "Transfer from GR" dialog (Full
   * Transfer tab, selected by default) and confirms with the dialog's own
   * OK. Same row-scoping fix already applied throughout this module:
   * getByRole('row', {name: grDocNo}) produces ambiguous matches, so this
   * filters `tr.dxgvDataRow_iOS` by text content and clicks that row's own
   * checkbox cell directly.
   */
  async selectGoodsReceiveToTransfer(grDocNo) {
    const f = this.formFrame;
    await f.getByText('Transfer from GR', { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 });

    const targetRow = f.locator('tr.dxgvDataRow_iOS').filter({ hasText: grDocNo });
    await targetRow.first().waitFor({ state: 'visible', timeout: 10000 });
    await targetRow.first().locator('td.dxgvCommandColumn_iOS').first().click();
    await this.page.waitForTimeout(500);

    const { locator: okButton } = await heal(f, {
      id: 'goodsReturn.transferOkButton',
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
   * Fills the (not required, but always given a unique value here so a
   * specific document can be searched for later) "Reference No." field —
   * same `txtRefNo_I` id suffix as every other reference field in this
   * module. Uses the retry-and-verify pattern already established for
   * this field class (CashPurchasePage/PurchaseInvoicePage/
   * GoodsReceivePage's own fillSupplierInvNo()/fillSupplierDoNo()) from
   * the start, since pressSequentially() has been confirmed live, more
   * than once, to lose keystrokes under load.
   */
  async fillReferenceNo(value = `TESTING-GR-${Date.now()}`) {
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
   * Fills the required Delivery Address (Logistics tab > Address1 +
   * Address3 + City). CONFIRMED live: Post fails with "Address1: Is
   * required" / "Address3: Is required" / "City: Is required" without
   * this — this screen requires BOTH Address1 and Address3, unlike
   * Purchase Return's own version of this same control (Address1 only).
   * City defaults to "PUCHONG", same reasoning as Purchase Return's own
   * default (this company's own registered city).
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
      id: 'goodsReturn.cityTrigger',
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
      id: 'goodsReturn.cityPopupOkButton',
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
   * Waits for the actual report-tab signal rather than a fixed delay —
   * same fix already needed for Purchase Invoice's/Purchase Return's own
   * clickPost(). CONFIRMED live: report titled "GoodsReturnSummaryGST
   * Report".
   */
  async clickPost() {
    const { locator } = await heal(this.formFrame, {
      id: 'goodsReturn.postButton',
      label: 'Post',
      strategies: [
        { type: 'css', value: '[title="Post [Alt + P]"]' },
        { type: 'text', value: 'Post', options: { exact: true } },
      ],
      timeout: 5000,
    });
    await locator.click();
    await this.page.getByText('GoodsReturnSummaryGST Report', { exact: false })
      .first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    await this.page.waitForTimeout(1000);
  }

  /**
   * Same "Post & New doesn't open a report tab" shape already confirmed
   * for Purchase Invoice/Purchase Return — waits for the form to
   * genuinely reset (Vendor field empty again) instead.
   */
  async clickPostAndNew() {
    const { locator } = await heal(this.formFrame, {
      id: 'goodsReturn.postAndNewButton',
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

  /** Full flow through transfer + reference no. + delivery address — action (Post/Post & New) is the caller's own next step. */
  async prepareReturn({ vendorCode, grDocNo, referenceNo, address1, address3, cityName }) {
    await this.selectVendor(vendorCode);
    await this.clickCopyFromGoodsReceive();
    await this.selectGoodsReceiveToTransfer(grDocNo);
    await this.fillReferenceNo(referenceNo);
    await this.fillDeliveryAddress(address1, address3, cityName);
  }

  /**
   * Checks whether the document actually posted — Post auto-opens a
   * report tab. CONFIRMED live: titled "GoodsReturnSummaryGST Report".
   */
  async expectPostSuccess() {
    const reportTab = this.page.getByText('GoodsReturnSummaryGST Report', { exact: false });
    return (await reportTab.count().catch(() => 0)) > 0;
  }

  /**
   * Reads the "[Next Possible No.GT-XXXXX]" number from the form header —
   * used as before/after proof for "Post & New", same reasoning as
   * PurchaseReturnPage.getNextPossibleNo(). CONFIRMED live: this screen's
   * document prefix is "GT-", not "GR-" (Goods Receive's own prefix).
   */
  async getNextPossibleNo() {
    const header = this.formFrame.getByText('Next Possible No', { exact: false });
    const text = await header.first().innerText().catch(() => '');
    const match = text.match(/GT-\d+/);
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
   * triple-click-then-pressSequentially convention confirmed across this
   * whole module. Required before clickCancelIcon() so the row we act on
   * is provably the one we searched for.
   */
  async searchListing(searchText) {
    await this._resolveListFrame();
    const { locator: filterBox } = await heal(this.listFrame, {
      id: 'goodsReturn.listingSearchFilterBox',
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
        path: `test-results/debug-goods-return-search-not-found-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `Goods Return listing never showed a row matching "${searchText}" after searching — ` +
        'refusing to proceed with Cancel against a possibly-stale/unfiltered row.'
      );
    }
    await this.page.waitForTimeout(300);
  }

  /**
   * Polls until a genuine grid DATA ROW matching the search text is
   * visible AND carries its own "Cancel" row-action icon — proof this is
   * a real filtered data row, not the filter textbox's own wrapping cell.
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
   * Clicks the matching row's own "Cancel" icon. Scoped to the ONE row
   * matching searchText, never a grid-wide selector, per this repo's
   * safety rule for delete/cancel actions.
   */
  async clickCancelIcon(searchText) {
    const row = this.listFrame.locator('tr.dxgvDataRow_iOS').filter({ hasText: searchText });
    const cancelIcon = row.first().getByRole('img', { name: 'Cancel', exact: true });
    await cancelIcon.waitFor({ state: 'visible', timeout: 15000 });
    await cancelIcon.click({ timeout: 30000 });
  }

  /**
   * Confirms the row-level Cancel action via its own "Cancel Confirmation"
   * dialog (`pcConfirmCancel` — same id root confirmed live across Cash
   * Purchase/Purchase Invoice/Goods Receive/Purchase Return/Purchase
   * Order/Close Purchase Order). Scoped to this.listFrame, never
   * page-wide.
   */
  async confirmCancelYes() {
    const popup = this.listFrame.locator('#ctl00_pcConfirmCancel_PW-1');
    await popup.waitFor({ state: 'visible', timeout: 45000 });

    const { locator: yesButton } = await heal(this.listFrame, {
      id: 'goodsReturn.cancelConfirmYesButton',
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
   * Handles a "Cancel Reason" popup if one appears — CONFIRMED required on
   * Purchase Return (see PurchaseReturnPage's own
   * handleCancelReasonIfPresent()); presence check here, not an assumption
   * it always appears.
   */
  async handleCancelReasonIfPresent() {
    const popup = this.listFrame.locator('[id*="pcCancelReason" i][id$="_PW-1" i]');
    const present = await popup.first().waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    if (!present) return;

    const { locator: reasonTrigger } = await heal(this.listFrame, {
      id: 'goodsReturn.cancelReasonTrigger',
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
      id: 'goodsReturn.cancelReasonOkButton',
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
   * Gives Post's trailing async work (GST/eInvoice registration) time to
   * settle before returning to the listing, same reasoning as
   * CashPurchasePage.cancelDocument().
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
   * verify a cancelled document is genuinely gone from the active list —
   * per this repo's "confirm it deletes it again" convention.
   */
  async isDocumentPresent(searchText) {
    await this._resolveListFrame();
    const { locator: filterBox } = await heal(this.listFrame, {
      id: 'goodsReturn.listingSearchFilterBox',
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

module.exports = { GoodsReturnPage };
