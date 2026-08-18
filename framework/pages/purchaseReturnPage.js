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
 * ROW-LEVEL CANCEL (added 2026-08-18, same pattern as CashPurchasePage):
 * goto() is scoped to #navBar for the same reason CashPurchasePage's is —
 * CONFIRMED live that the unscoped link locator becomes ambiguous the
 * second time goto() runs in one test (needed here since cancelDocument()
 * navigates back to the listing after Post). Since this screen has no
 * working Save Draft, the Cancel test posts the document (only option
 * available) before cancelling it. The confirm dialog here uses the SAME
 * `pcConfirmCancel` "Cancel Confirmation" popup as Cash Purchase/Purchase
 * Invoice/Goods Receive (an earlier DOM-dump finding claimed this screen
 * used the generic `pcConfirmDel` popup instead — that was wrong, caught
 * via a live failure screenshot; see confirmCancelYes()'s own comment).
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
    // BUG FIXED (2026-08-18): scoped to #navBar (the actual left-nav
    // sidebar), same fix already applied in cashPurchasePage.js's goto() —
    // CONFIRMED live here too: the unscoped page-wide locator becomes
    // ambiguous the SECOND time goto() runs for this same screen in one
    // test/script (the already-open browser tab's own label ALSO matches
    // getByRole('link', {name: 'Purchase Return', exact:true}), causing
    // _resolveListFrame() to fail outright). Needed for the cancel test,
    // which returns to this screen's listing after posting a document.
    //
    // Clicking "Purchase" TOGGLES its submenu open/closed (confirmed live
    // across every other page object in this module) — only click it if
    // the target link isn't already visible.
    const navBar = p.locator('#navBar');
    const purchaseReturnLink = navBar.getByRole('link', { name: 'Purchase Return', exact: true });
    const alreadyExpanded = await purchaseReturnLink.isVisible().catch(() => false);
    if (!alreadyExpanded) {
      await navBar.getByRole('link', { name: 'Purchase', exact: true }).click();
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

  /**
   * Fills the listing grid's own live-filter textbox and waits for a
   * genuine matching row before returning — same id suffix
   * (FilterTextBoxGridView_txtFilterGridView_I) and same
   * triple-click-then-pressSequentially convention already confirmed in
   * customerPage.js's searchCustomer() and CashPurchasePage's
   * searchListing(). CONFIRMED live here too. Required before
   * clickCancelIcon() so the row we act on is provably the one we searched
   * for, not whatever the default (unfiltered/paginated) grid view happens
   * to show.
   */
  async searchListing(searchText) {
    await this._resolveListFrame();
    const { locator: filterBox } = await heal(this.listFrame, {
      id: 'purchaseReturn.listingSearchFilterBox',
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
        path: `test-results/debug-purchase-return-search-not-found-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `Purchase Return listing never showed a row matching "${searchText}" after searching — ` +
        'refusing to proceed with Cancel against a possibly-stale/unfiltered row.'
      );
    }
    await this.page.waitForTimeout(300);
  }

  /**
   * Polls until a genuine grid DATA ROW matching the search text is
   * visible AND carries its own "Cancel" row-action icon — proof this is a
   * real filtered data row, not the filter textbox's own wrapping cell
   * (same false-positive class already root-caused in customerPage.js's
   * _waitForGridRowMatching() / reused verbatim from CashPurchasePage's own
   * _waitForListingRowMatching()).
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
   * Clicks the matching row's own "Cancel" icon. CONFIRMED live via DOM
   * dump (2026-08-18): same as Cash Purchase, the accessible name is
   * "Cancel" (alt/title both "Cancel") even though the icon file is
   * Delete.svg. Scoped to the ONE row matching searchText, never a
   * grid-wide selector, per this repo's safety rule for delete/cancel
   * actions.
   *
   * Same app-wide loading-overlay risk documented in CashPurchasePage's
   * clickCancelIcon() applies here too (Post's own trailing GST/eInvoice
   * async work can intercept this click for a while right after posting) —
   * handled at the call site (cancelDocument()) with a settle wait before
   * returning to the listing, same as that page object.
   */
  async clickCancelIcon(searchText) {
    const row = this.listFrame.locator('tr.dxgvDataRow_iOS').filter({ hasText: searchText });
    const cancelIcon = row.first().getByRole('img', { name: 'Cancel', exact: true });
    await cancelIcon.waitFor({ state: 'visible', timeout: 15000 });
    await cancelIcon.click({ timeout: 30000 });
  }

  /**
   * Confirms the row-level Cancel action via its own "Cancel Confirmation"
   * dialog (`pcConfirmCancel` — same id root as Cash Purchase/Purchase
   * Invoice/Goods Receive).
   *
   * BUG FIXED (2026-08-18): an earlier version of this method waited on
   * `#ctl00_pcConfirmDel_PW-1` (the generic, shared "Delete Confirmation"
   * popup), based on a live DOM dump that turned out to have inspected the
   * wrong (hidden, unrelated) popup instance coexisting in the same frame.
   * A live failure screenshot proved the dialog that actually renders here
   * is titled "Cancel Confirmation" / "Are you sure you want to cancel
   * this document?" — word-for-word identical to Cash Purchase's — under
   * root id `ctl00_pcConfirmCancel_PW-1`, not `pcConfirmDel`. Fixed to
   * match what's actually on screen rather than the earlier (wrong)
   * DOM-dump finding.
   *
   * Scoped to this.listFrame, never page-wide — per this repo's safety
   * rule for delete/cancel confirmations (the real incident this rule
   * exists because of involved exactly this kind of dialog).
   *
   * CONFIRMED live: the dialog can take well over 20s to actually render
   * after the Cancel-icon click (the grid runs its own callback first) —
   * generous timeout here is deliberate, not a placeholder.
   */
  async confirmCancelYes() {
    const popup = this.listFrame.locator('#ctl00_pcConfirmCancel_PW-1');
    await popup.waitFor({ state: 'visible', timeout: 45000 });

    const { locator: yesButton } = await heal(this.listFrame, {
      id: 'purchaseReturn.cancelConfirmYesButton',
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
   * Handles the "Cancel Reason" popup — CONFIRMED live via DOM dump
   * (2026-08-18): a SECOND, required step unique to this screen (not seen
   * on Cash Purchase/Purchase Invoice/Goods Receive), which appears right
   * after confirming "Yes" on the Cancel Confirmation dialog. Without
   * handling it, the cancel never actually commits — the document stays
   * fully active (isDocumentPresent() still returns true), which is
   * exactly what a first live run of this test caught: the assertion
   * failed with no error thrown, because the flow had silently stalled on
   * this unhandled required dialog instead.
   *
   * Root id `pcCancelReason_pcCancelReason_PW-1`. The Reason field is a
   * combo (`cbReason`, `_B-1Img` dropdown-arrow trigger — the SAME
   * repo-wide combo pattern as Vendor/Warehouse/City, not the `_B0Img`
   * "+" quick-add button that opens a separate settings page for creating
   * NEW reasons, confirmed live not to be what's needed here). Since any
   * valid reason is acceptable for test purposes (this is just required
   * metadata, not something the test asserts on), this picks whichever
   * reason is FIRST in the list rather than hunting for a specific one.
   * The dialog's own confirm button is real named `btnCancelDocument`
   * (not a generic "OK") — confirmed live via DOM dump, `_CD` + zero-size
   * `_I` sibling, same pattern as every other DevExpress dialog here.
   */
  async handleCancelReasonIfPresent() {
    const popup = this.listFrame.locator('#ctl00_MainContent_PurchaseReturns1_cpnlPurchaseReturns_pcCancelReason_pcCancelReason_PW-1');
    const present = await popup.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    if (!present) return;

    const { locator: reasonTrigger } = await heal(this.listFrame, {
      id: 'purchaseReturn.cancelReasonTrigger',
      label: 'Reason',
      strategies: [
        { type: 'css', value: '[id*="pcCancelReason" i][id*="cbReason_B-1Img" i]' },
      ],
      timeout: 5000,
    });
    await reasonTrigger.click();
    await this.page.waitForTimeout(800);

    // The first DOM match (LBI-1) is a hidden placeholder/null row — CONFIRMED
    // live it stays hidden even once the dropdown is open. Filtering to
    // :visible (same convention as multiPaymentModeOption's own selector)
    // picks a genuine, currently-rendered option instead.
    const firstOption = this.listFrame.locator('[id*="pcCancelReason" i][id*="cbReason_DDD_L_LBI" i]:visible').first();
    await firstOption.waitFor({ state: 'visible', timeout: 10000 });
    await firstOption.click();
    await this.page.waitForTimeout(500);

    const { locator: okButton } = await heal(this.listFrame, {
      id: 'purchaseReturn.cancelReasonOkButton',
      label: 'OK',
      strategies: [
        { type: 'css', value: '[id*="pcCancelReason" i][id*="btnCancelDocument_CD" i]' },
      ],
      timeout: 5000,
    });
    await okButton.click();
    await popup.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await this.page.waitForTimeout(1000);
  }

  /**
   * Full flow: search -> click row's Cancel icon -> confirm Yes -> handle
   * the Cancel Reason popup if it appears.
   *
   * Gives Post's trailing async work (GST/eInvoice registration — see
   * clickCancelIcon()'s comment) time to settle before returning to the
   * listing, since this method is meant to run right after a fresh Post in
   * the same session — same reasoning as CashPurchasePage.cancelDocument(),
   * just against a Post instead of a Save Draft since this screen has no
   * working Save Draft (see this class's own doc comment).
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
   * default (no Cancel status filter) listing view? Used to verify a
   * cancelled document is genuinely gone from the active list — per this
   * repo's "confirm it deletes it again" convention — not just that
   * confirmCancelYes() completed without error. Deliberately does NOT
   * reuse searchListing(), which throws when nothing matches — here
   * "nothing matches" is the expected, successful outcome.
   */
  async isDocumentPresent(searchText) {
    await this._resolveListFrame();
    const { locator: filterBox } = await heal(this.listFrame, {
      id: 'purchaseReturn.listingSearchFilterBox',
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

module.exports = { PurchaseReturnPage };
