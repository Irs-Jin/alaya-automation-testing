const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Account Payable (transactional module) > A/P Invoice.
 *
 * SOURCE: NO Katalon Object Repository entry or Playwright codegen
 * recording available for this screen — built by close analogy to
 * arInvoicePage.js (Account Receivable > A/R Invoice, the confirmed-
 * working mirror-shape screen: header entity picker + one Account No./
 * Amount line, not a Payment Mode/Amount line like apPaymentPage.js's own
 * A/P Payment). Every CSS id below is a GUESS formed by substituting
 * "AR" -> "AP" and "Customer" -> "Vendor" in arInvoicePage.js's own
 * confirmed ids, EXCEPT the Vendor field/picker ids, which instead reuse
 * apPaymentPage.js's own independently-CONFIRMED Vendor control naming
 * (`cbVendor_cbVendor_I`/`cbVendor_cbVendor_B1Img`) since that's a more
 * directly relevant same-module precedent than translating A/R Invoice's
 * own idiosyncratic "cbSelectCust" naming. UNCONFIRMED until this file's
 * first live headed run — verify and fix per CONTRIBUTING.md; do not
 * trust these ids blindly.
 *
 * SHAPE (assumed identical to A/R Invoice): nav (Account Payable > A/P
 * Invoice) > listing grid with its own header "New" icon > New opens a
 * create form in its own iframe > header Vendor field opens a popup search
 * grid (select a row by Vendor Code, click OK) > an "Items" line grid, its
 * own Insert icon > an Account No. column that opens a popup grid (Code/
 * Description columns) > an Amount column > toolbar actions Back(DXI0)/
 * Post & New(DXI1)/Post(DXI2)/Save Draft(DXI4)/New(DXI10), same numbering
 * confirmed across every AP/AR-Journal-Entry-based screen in this app.
 *
 * ASSUMED (mirroring A/R Invoice, unconfirmed): Post/Post & New may
 * trigger a "have un-knock off payment, knock off now?"-style confirmation
 * (this flow never touches any Knock-off grid) — the correct answer for a
 * plain happy-path test is assumed No, same reasoning as A/R Invoice
 * (Yes would additionally try to apply the invoice against an outstanding
 * payment, out of scope here). Verify live — if this screen's dialog
 * instead behaves like A/P Payment's own knock-off dialog (different
 * wording, correct answer Yes), this needs updating.
 *
 * ASSUMED (mirroring A/R Invoice, unconfirmed): the listing grid's own
 * "Cancel" icon/link is this screen's real cleanup mechanism (no
 * hard-delete), working for both DRAFT and POSTED documents via the same
 * app-wide `pcConfirmCancel`/`btnYesCancel_CD` dialog already confirmed
 * for A/P Payment.
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable — always re-resolved via findFrame() by content, never
 * hardcoded.
 */
class ApInvoicePage {
  constructor(page) {
    this.page = page;
    this.listFrame = null;
    this.formFrame = null;
  }

  async goto() {
    const p = this.page;
    await p.getByRole('link', { name: 'Account Payable', exact: true }).click();
    await p.getByRole('link', { name: 'A/P Invoice', exact: true }).click();
    await p.waitForLoadState('domcontentloaded');
    await this._resolveListFrame();
  }

  async _resolveListFrame() {
    const p = this.page;
    this.listFrame = await findFrame(p, async (frame) => {
      const addIcon = frame.getByRole('img', { name: /Click Here Or Press \[Insert\]/i });
      return (await addIcon.count().catch(() => 0)) > 0 && (await addIcon.first().isVisible().catch(() => false));
    });
    if (!this.listFrame) {
      await p.screenshot({ path: 'test-results/debug-ap-invoice-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the frame containing the A/P Invoice list "New" icon. ' +
        'Saved test-results/debug-ap-invoice-list-page.png for inspection.'
      );
    }
  }

  /** UNCONFIRMED CSS id (AR->AP substitution of arInvoicePage.js's own confirmed id, Vendor field pattern from apPaymentPage.js) — the Vendor field is expected to have no accessible name (same trap already confirmed on A/P Payment/A/R Invoice), so this checks the input's own id directly rather than a role match. */
  async _resolveFormFrame() {
    const p = this.page;
    this.formFrame = await findFrame(p, async (frame) => {
      const field = frame.locator('#ctl00_MainContent_APJournalEntryDtl_cbpAPJournalEntry_cbpAPJournalEntryDetail_ASPxRoundPanel1_formAPJEHeader_cbVendor_cbVendor_I');
      return (await field.count().catch(() => 0)) > 0 && (await field.first().isVisible().catch(() => false));
    });
    if (!this.formFrame) {
      await p.screenshot({ path: 'test-results/debug-ap-invoice-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the A/P Invoice create/edit form frame (Vendor field). ' +
        'Saved test-results/debug-ap-invoice-form-not-found.png for inspection.'
      );
    }
  }

  /** UNCONFIRMED CSS id (AR->AP substitution) — falls back to the generic "New"/Insert icon role match. */
  async clickNew() {
    let addIcon;
    try {
      const { locator } = await heal(this.listFrame, {
        id: 'apInvoice.newIcon',
        label: 'New',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_APJournalEntryHDR_cpnlAPJEHeader_formC_gvAPJournalEntry_header17_btnCheckAll' },
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

  /**
   * CONFIRMED live (2026-08-27): this screen's header has a real, direct
   * CSS id for Reference No (`txtRefNo_I`) — used directly rather than a
   * role/label match, since this app has a repeated "field has no
   * accessible name bound to it" trap (Vendor/Customer fields elsewhere).
   * Keep to 20 characters or fewer, same convention as every other module.
   */
  async fillReferenceNo(referenceNo) {
    const field = this.formFrame.locator('#ctl00_MainContent_APJournalEntryDtl_cbpAPJournalEntry_cbpAPJournalEntryDetail_ASPxRoundPanel1_formAPJEHeader_txtRefNo_I');
    await field.click();
    await field.fill(referenceNo);
  }

  /**
   * CONFIRMED live (2026-08-27): unlike A/R Invoice, this screen has a
   * SECOND mandatory header field — "Supplier Inv. No.:*" (red asterisk in
   * the UI) — with no A/R Invoice equivalent. Filled with the same value
   * as Reference No for simplicity; any non-empty value satisfies it.
   */
  async fillSupplierInvoiceNo(supplierInvoiceNo) {
    const field = this.formFrame.locator('#ctl00_MainContent_APJournalEntryDtl_cbpAPJournalEntry_cbpAPJournalEntryDetail_ASPxRoundPanel1_formAPJEHeader_txtSupplierInvoiceNo_I');
    await field.click();
    await field.fill(supplierInvoiceNo);
  }

  /** Opens the header's Vendor popup search grid and selects a row by its Vendor Code — trigger icon id reuses apPaymentPage.js's own CONFIRMED Vendor picker pattern. */
  async selectVendor(vendorCode) {
    const f = this.formFrame;
    const pickerIcon = f.locator('#ctl00_MainContent_APJournalEntryDtl_cbpAPJournalEntry_cbpAPJournalEntryDetail_ASPxRoundPanel1_formAPJEHeader_cbVendor_cbVendor_B1Img');
    await pickerIcon.click();

    const popupFrame = (await findFrame(this.page, async (frame) => {
      const cell = frame.getByRole('cell', { name: vendorCode, exact: true });
      return (await cell.count().catch(() => 0)) > 0;
    })) || f;
    await popupFrame.getByRole('cell', { name: vendorCode, exact: true }).first().click();

    // Same "_CD is the real clickable element" pattern already confirmed
    // for A/P Payment's/A/R Invoice's own OK button.
    await popupFrame.locator('[id$="_formGeneralSearchControl_btnOk_CD"]').first().click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Adds one invoice line: click the "Items" grid's own Add icon, pick an
   * Account No., fill the Amount.
   *
   * CONFIRMED live (2026-08-27): unlike A/R Invoice's Items grid, this
   * screen's Add button is a plain green "+" icon with NO "Click Here Or
   * Press [Insert]" accessible name — targets its own confirmed CSS id
   * directly. Also CONFIRMED this grid has many more columns than A/R
   * Invoice's (Account No./Description/2nd Description/Reference No/Cost
   * Centre/Amount/Tax Code/Tax Amount/Taxable Amount/Tax Adjustment...),
   * which shifts the DXEditor numbering — Amount is DXEditor12 here, NOT
   * DXEditor13 (see _fillAmountWithRetry()).
   */
  async addInvoiceLine({ accountCode, amount }) {
    const f = this.formFrame;
    const { locator: addIcon } = await heal(f, {
      id: 'apInvoice.addLineIcon',
      label: 'Add Line',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_APJournalEntryDtl_cbpAPJournalEntry_cpnlAPJEItem_formAPJEItem_PC_0_gvAPJEItem_header0_Add' },
      ],
      timeout: 15000,
    }).catch(async () => ({ locator: f.getByRole('img', { name: /Click Here Or Press \[Insert\]/i }).first() }));
    await addIcon.waitFor({ state: 'visible', timeout: 15000 });
    await addIcon.click();
    await this.page.waitForTimeout(800);

    const { locator: accountTrigger } = await heal(f, {
      id: 'apInvoice.accountNoTrigger',
      label: 'Account No.',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_APJournalEntryDtl_cbpAPJournalEntry_cpnlAPJEItem_formAPJEItem_PC_0_gvAPJEItem_DXEditor3_B-1' },
      ],
      timeout: 5000,
    });
    await accountTrigger.click();
    await this.page.waitForTimeout(500);

    const accountOption = f.getByRole('cell', { name: accountCode, exact: true }).first();
    await accountOption.waitFor({ state: 'visible', timeout: 5000 });
    await accountOption.click();
    await this.page.waitForTimeout(500);

    await this._fillAmountWithRetry(amount);
  }

  async _fillAmountWithRetry(amount) {
    const f = this.formFrame;
    const amountInput = f.locator('#ctl00_MainContent_APJournalEntryDtl_cbpAPJournalEntry_cpnlAPJEItem_formAPJEItem_PC_0_gvAPJEItem_DXEditor12_I');
    await amountInput.click();
    await amountInput.fill(String(amount));
    await amountInput.press('Tab');
    await this.page.waitForTimeout(500);

    if (await this._isAmountCommitted(amount)) return;

    // Same defensive re-entry pattern already confirmed necessary on A/R
    // Invoice: DevExpress can swap the cell to a read-only "Amount
    // Required" validation-icon state instead of keeping it editable.
    const requiredIcon = f.getByRole('img', { name: 'Amount Required' }).first();
    if (await requiredIcon.count().catch(() => 0) > 0) {
      await requiredIcon.click();
      await this.page.waitForTimeout(300);
    }
    const retryInput = f.locator('#ctl00_MainContent_APJournalEntryDtl_cbpAPJournalEntry_cpnlAPJEItem_formAPJEItem_PC_0_gvAPJEItem_DXEditor12_I');
    await retryInput.click();
    await retryInput.fill(String(amount));
    await retryInput.press('Tab');
    await this.page.waitForTimeout(500);

    if (!(await this._isAmountCommitted(amount))) {
      await this.page.screenshot({ path: 'test-results/debug-ap-invoice-amount-not-committed.png', fullPage: true }).catch(() => {});
      throw new Error(
        `A/P Invoice line Amount never committed to ${amount} after two attempts — ` +
        'saved test-results/debug-ap-invoice-amount-not-committed.png for inspection.'
      );
    }
  }

  async _isAmountCommitted(amount) {
    const total = this.formFrame.getByText(`Total ${Number(amount).toFixed(2)}`, { exact: false });
    return (await total.count().catch(() => 0)) > 0;
  }

  /** ASSUMED (mirroring A/R Invoice, unconfirmed) — see class doc for why No is assumed correct here. */
  async _declineKnockOffIfPresent() {
    const noButton = this.formFrame.locator('#ctl00_pcConfirmMessageBox_btnConfirmNo_CD, [id*="pcConfirmMessageBox" i][id*="btnConfirmNo" i]');
    const appeared = await noButton.first().waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
    if (!appeared) return;
    await noButton.first().click();
    await this.page.waitForTimeout(1000);
  }

  async clickSaveDraft() {
    const saveButton = this.formFrame.getByRole('listitem', { name: 'Save Draft [Alt + S]' });
    await saveButton.click();
    await this.page.waitForTimeout(1000);
  }

  async clickPost() {
    const postButton = this.formFrame.getByRole('listitem', { name: 'Post [Alt + P]' });
    await postButton.click();
    await this._declineKnockOffIfPresent();
  }

  async clickPostAndNew() {
    const postAndNewButton = this.formFrame.getByRole('listitem', { name: 'Post & New [Alt + Ctrl + P]' });
    await postAndNewButton.click();
    await this._declineKnockOffIfPresent();
  }

  /** Same defensive dismiss as A/R Invoice's dismissErrorIfPresent() — second line of defense if Amount didn't truly commit. */
  async dismissErrorIfPresent() {
    const okButton = this.formFrame.getByRole('listitem', { name: /^Error/i })
      .or(this.formFrame.getByText('Error Encountered'));
    const errorShown = await okButton.first().waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false);
    if (!errorShown) return false;
    const ok = this.formFrame.getByRole('button', { name: 'OK', exact: true }).first();
    await ok.click().catch(() => {});
    await this.page.waitForTimeout(500);
    return true;
  }

  /** Same report-tab-switch pattern already confirmed across every module in this app — best-effort, no-op if there's nothing to switch. */
  async _switchBackToInvoiceTab() {
    await this.page.getByRole('link', { name: 'A/P Invoice', exact: true }).last()
      .click({ timeout: 3000 }).catch(() => {});
    await this.page.waitForTimeout(500);
  }

  async clickBack() {
    await this._switchBackToInvoiceTab();
    await this._declineKnockOffIfPresent();
    const backButton = this.formFrame.getByRole('listitem', { name: 'Back [Alt + B]' });
    await backButton.click();
    await this.page.waitForTimeout(1000);
    await this._resolveListFrame();
  }

  /** New -> Vendor -> Supplier Inv. No. -> Reference No -> one Account No. line with Amount. Stops before any save action. */
  async createInvoice({ vendorCode, referenceNo, accountCode, amount }) {
    await this.clickNew();
    await this.selectVendor(vendorCode);
    await this.fillSupplierInvoiceNo(referenceNo);
    await this.fillReferenceNo(referenceNo);
    await this.addInvoiceLine({ accountCode, amount });
  }

  async getDocumentNo() {
    const field = this.formFrame.getByRole('textbox', { name: 'Document No.:', exact: true });
    return (await field.inputValue().catch(() => null)) || (await field.textContent().catch(() => null));
  }

  async getStatus() {
    const field = this.formFrame.getByRole('textbox', { name: 'Status:', exact: true });
    return (await field.inputValue().catch(() => null)) || (await field.textContent().catch(() => null));
  }

  /** Waits for a genuine GRID DATA ROW matching the given Reference No — same principle as apPaymentPage.js/arInvoicePage.js's equivalent. Row-name prefix "APJEDetailPage" is an AR->AP substitution guess of arInvoicePage.js's own confirmed "ARJEDetailPage" — verify live. */
  async _waitForRowMatchingReference(referenceNo, timeout = 15000) {
    const escaped = referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dataRowPattern = new RegExp(`^APJEDetailPage\\s+Cancel\\b.*\\b${escaped}\\b`, 'i');
    const row = this.listFrame.getByRole('row', { name: dataRowPattern });
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if ((await row.count().catch(() => 0)) > 0 && (await row.first().isVisible().catch(() => false))) {
        return true;
      }
      await this.page.waitForTimeout(300);
    }
    return false;
  }

  /** ASSUMED (mirroring A/R Invoice/A/P Payment, unconfirmed) as this screen's real cleanup mechanism — no hard-delete. Scoped to this.listFrame, never page-wide. */
  async cancelDocument(referenceNo) {
    await this._resolveListFrame();
    const matched = await this._waitForRowMatchingReference(referenceNo);
    if (!matched) {
      await this.page.screenshot({
        path: `test-results/debug-ap-invoice-cancel-not-found-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `A/P Invoice grid never showed a row matching Reference No. "${referenceNo}" — ` +
        'refusing to proceed with Cancel against a possibly-stale/unfiltered row.'
      );
    }
    const row = this.listFrame.getByRole('row', {
      name: new RegExp(`^APJEDetailPage\\s+Cancel\\b.*\\b${referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
    }).first();
    await row.getByRole('link', { name: 'Cancel', exact: true }).click();

    const { locator: yesButton } = await heal(this.listFrame, {
      id: 'apInvoice.cancelConfirmYesButton',
      label: 'Yes',
      strategies: [
        { type: 'css', value: '#ctl00_pcConfirmCancel_btnYesCancel_CD' },
        { type: 'css', value: '[id*="pcConfirmCancel" i][id*="btnYesCancel_CD" i]' },
      ],
      timeout: 5000,
    });
    await yesButton.click();
    await yesButton.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    await this.page.waitForTimeout(1000);
  }

  /** Same app-wide success text already confirmed across every module in this app. */
  async isCancelSuccessful() {
    if (this.listFrame) {
      const text = this.listFrame.getByText('Cancelled Successfully');
      if ((await text.count().catch(() => 0)) > 0 && (await text.first().isVisible().catch(() => false))) {
        return true;
      }
    }
    const frame = await findFrame(this.page, async (f) => {
      const text = f.getByText('Cancelled Successfully');
      return (await text.count().catch(() => 0)) > 0 && (await text.first().isVisible().catch(() => false));
    }, { timeout: 5000 });
    return !!frame;
  }
}

module.exports = { ApInvoicePage };
