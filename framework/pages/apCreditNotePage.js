const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Account Payable (transactional module) > A/P Credit Note.
 *
 * SOURCE: NO Katalon Object Repository entry or Playwright codegen
 * recording available for this screen — built from a live DOM inspection
 * (2026-08-27) done BEFORE writing this file. CONFIRMED live: unlike A/P
 * Debit Note/A/P Invoice (which share one grid shape/DXEditor numbering),
 * this screen's item grid (`gvAPPItemNew`) is a DIFFERENT, unrelated shape
 * — it's the SAME grid name/container pattern as apPaymentPage.js/
 * apPaymentRefundPage.js (`cpnlAPPItem`/`formAPCNItem_PC_0`/
 * `ASPxFormLayout3`/`gvAPPItemNew`), not the `gvAP*Item`-style grid used by
 * Invoice/Debit Note. Columns (confirmed live via screenshot): Account No.,
 * Reference No, Description, 2nd Description, Cost Centre, Amount, Tax
 * Code, Tax Amount, Taxable Amount, Tax Adjustment. DXEditor numbering
 * CONFIRMED live via a distinct-marker test (typed each candidate editor's
 * own number as its value, then read back which grid column displayed
 * which number): Account No. trigger = DXEditor3 (picker, `_B-1`), 2nd
 * Description = DXEditor5, Reference No (grid line) = DXEditor6,
 * **Amount = DXEditor9** — NOT DXEditor12 as a naive analogy to A/P Debit
 * Note/A/P Invoice would suggest.
 *
 * Header shape CONFIRMED live: `APCreditNoteDtl`/`cbpAPCreditNote`/
 * `formAPCNHeader` (direct AR->AP substitution of A/R Credit Note's own
 * confirmed `ARCreditNoteDtl`/`cbpARCreditNote`/`formARCNHeader` pattern —
 * this part DOES hold). Same as A/R Credit Note: a mandatory "Reason:"
 * textbox (role-addressable, no stable id needed) plus a "Reference No:"
 * field (`txtRefNo_I`) — NO separate "Supplier Credit Note No." field
 * (confirmed absent from the header field dump, unlike A/P Invoice/A/P
 * Debit Note's extra mandatory Supplier ref field).
 *
 * CONFIRMED live: this screen has "Total Credit Amount:"/"Unapplied
 * Amount:" fields plus a "Knock-off Invoices/Debit Notes" grid below the
 * item grid — same Total/Unapplied Amount shape as A/R Credit Note. This
 * page object never applies a knock-off, so ASSUMED (by direct analogy to
 * A/R Credit Note, not yet independently confirmed live for THIS screen):
 * Save Draft/Post/Post & New all trigger the same generic "Unapplied
 * Amount Not Zero" confirmation via `pcConfirmMessageBox_btnConfirmYes_CD`
 * — `_confirmUnappliedAmountIfPresent()` mirrors arCreditNotePage.js's
 * handling and answers Yes. Verify on first live run; if no dialog
 * appears, the no-op wait quietly falls through with no harm.
 *
 * CONFIRMED live (2026-08-27): unlike A/P Debit Note's shortened
 * `APDNDetailPage` row-name prefix, this screen's row accessible-name
 * prefix genuinely IS the direct AR->AP substitution: `APCreditNoteDetailPage`
 * (matching A/R Credit Note's own confirmed `ARCreditNoteDetailPage`
 * pattern verbatim) — verified via a live DOM dump of a real row's icon alt
 * text (`alt="APCreditNoteDetailPage" title="Edit"` / `alt="Cancel"
 * title="Cancel"`). The trash-can-LOOKING icon's real accessible name is
 * "Cancel", not "Delete" — do not be misled by its visual appearance.
 *
 * UNCONFIRMED (assumed by analogy to apDebitNotePage.js, verify live):
 * - UPDATE: Cancel Reason dialog CONFIRMED live (2026-08-27) via a direct
 *   DOM inspection of the real dialog: container is `cpnlAPCreditNoteHeader`
 *   (the full-name direct AR->AP substitution DOES hold here — unlike A/P
 *   Debit Note's shortened `cpnlAPDNHeader`), dropdown trigger id has NO
 *   "Img" suffix (`..._cbReason_B-1`, matching A/P Debit Note's shape, NOT
 *   A/R Credit Note's `_B-1Img` variant), confirm button id
 *   `btnCancelDocument_CD` (same as A/P Debit Note).
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable — always re-resolved via findFrame() by content, never
 * hardcoded.
 */
class ApCreditNotePage {
  constructor(page) {
    this.page = page;
    this.listFrame = null;
    this.formFrame = null;
  }

  async goto() {
    const p = this.page;
    await p.getByRole('link', { name: 'Account Payable', exact: true }).click();
    await p.getByRole('link', { name: 'A/P Credit Note', exact: true }).click();
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
      await p.screenshot({ path: 'test-results/debug-ap-credit-note-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the frame containing the A/P Credit Note list "New" icon. ' +
        'Saved test-results/debug-ap-credit-note-list-page.png for inspection.'
      );
    }
  }

  /** CONFIRMED live (2026-08-27) — the Vendor field's real CSS id. */
  async _resolveFormFrame() {
    const p = this.page;
    this.formFrame = await findFrame(p, async (frame) => {
      const field = frame.locator('#ctl00_MainContent_APCreditNoteDtl_cbpAPCreditNote_cbpAPCreditNoteDetail_ASPxRoundPanel1_formAPCNHeader_cbVendor_cbVendor_I');
      return (await field.count().catch(() => 0)) > 0 && (await field.first().isVisible().catch(() => false));
    });
    if (!this.formFrame) {
      await p.screenshot({ path: 'test-results/debug-ap-credit-note-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the A/P Credit Note create/edit form frame (Vendor field). ' +
        'Saved test-results/debug-ap-credit-note-form-not-found.png for inspection.'
      );
    }
  }

  /** UNCONFIRMED primary CSS id (New icon) — falls back to the generic "New"/Insert icon role match, matching apDebitNotePage.js's own confirmed live behavior (the role fallback is what actually resolves). */
  async clickNew() {
    let addIcon;
    try {
      const { locator } = await heal(this.listFrame, {
        id: 'apCreditNote.newIcon',
        label: 'New',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_APCreditNoteHdr_cpnlAPCreditNoteHeader_formC_gvAPCreditNote_header17_Add' },
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

  /** CONFIRMED live (2026-08-27): mandatory header Reason field — role-addressable, any non-empty text satisfies it, not used as a lookup key. */
  async fillReason(reason) {
    const field = this.formFrame.getByRole('textbox', { name: 'Reason:', exact: true });
    await field.click();
    await field.fill(reason);
  }

  /** CONFIRMED live (2026-08-27): real direct CSS id — used to find-and-cancel a specific document later. Keep to 20 characters or fewer, app-wide convention. */
  async fillReferenceNo(referenceNo) {
    const field = this.formFrame.locator('#ctl00_MainContent_APCreditNoteDtl_cbpAPCreditNote_cbpAPCreditNoteDetail_ASPxRoundPanel1_formAPCNHeader_txtRefNo_I');
    await field.click();
    await field.fill(referenceNo);
  }

  /** Opens the header's Vendor popup search grid and selects a row by its Vendor Code — CONFIRMED live (2026-08-27), same confirmed AP-side pattern as apPaymentPage.js/apInvoicePage.js/apPaymentRefundPage.js/apDebitNotePage.js. */
  async selectVendor(vendorCode) {
    const f = this.formFrame;
    const pickerIcon = f.locator('#ctl00_MainContent_APCreditNoteDtl_cbpAPCreditNote_cbpAPCreditNoteDetail_ASPxRoundPanel1_formAPCNHeader_cbVendor_cbVendor_B1Img');
    await pickerIcon.click();

    const popupFrame = (await findFrame(this.page, async (frame) => {
      const cell = frame.getByRole('cell', { name: vendorCode, exact: true });
      return (await cell.count().catch(() => 0)) > 0;
    })) || f;
    await popupFrame.getByRole('cell', { name: vendorCode, exact: true }).first().click();

    await popupFrame.locator('[id$="_formGeneralSearchControl_btnOk_CD"]').first().click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Adds one credit note line: click the Items grid's own Insert icon,
   * pick an Account No., fill the Amount.
   *
   * CONFIRMED live (2026-08-27): this grid's column set/DXEditor numbering
   * is UNRELATED to apDebitNotePage.js/apInvoicePage.js's grid — Account
   * No. trigger = DXEditor3 (picker), **Amount = DXEditor9** (confirmed via
   * a live distinct-marker test, not assumed by analogy).
   */
  async addCreditNoteLine({ accountCode, amount }) {
    const f = this.formFrame;
    const { locator: addIcon } = await heal(f, {
      id: 'apCreditNote.addLineIcon',
      label: 'Add Line',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_APCreditNoteDtl_cbpAPCreditNote_cpnlAPPItem_formAPCNItem_PC_0_ASPxFormLayout3_gvAPPItemNew_header0_Add' },
      ],
      timeout: 15000,
    }).catch(async () => ({ locator: f.getByRole('img', { name: /Click Here Or Press \[Insert\]/i }).first() }));
    await addIcon.waitFor({ state: 'visible', timeout: 15000 });
    await addIcon.click();
    await this.page.waitForTimeout(800);

    const { locator: accountTrigger } = await heal(f, {
      id: 'apCreditNote.accountNoTrigger',
      label: 'Account No.',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_APCreditNoteDtl_cbpAPCreditNote_cpnlAPPItem_formAPCNItem_PC_0_ASPxFormLayout3_gvAPPItemNew_DXEditor3_B-1' },
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

  /** CONFIRMED live (2026-08-27): Amount field id, verified via a distinct-marker test (see class doc). Polls the input's own committed value directly rather than trusting a fixed wait, same pattern as every other module's amount-commit handling. */
  async _fillAmountWithRetry(amount) {
    const f = this.formFrame;
    const amountInput = f.locator('#ctl00_MainContent_APCreditNoteDtl_cbpAPCreditNote_cpnlAPPItem_formAPCNItem_PC_0_ASPxFormLayout3_gvAPPItemNew_DXEditor9_I');
    await amountInput.click();
    await amountInput.fill(String(amount));
    await amountInput.press('Tab');

    if (await this._pollAmountCommitted(amountInput, amount)) return;

    const requiredIcon = f.getByRole('img', { name: 'Amount Required' }).first();
    if (await requiredIcon.count().catch(() => 0) > 0) {
      await requiredIcon.click();
      await this.page.waitForTimeout(300);
    }
    await amountInput.click({ timeout: 3000 }).catch(() => {});
    await amountInput.fill(String(amount));
    await amountInput.press('Tab');

    if (!(await this._pollAmountCommitted(amountInput, amount))) {
      await this.page.screenshot({ path: 'test-results/debug-ap-credit-note-amount-not-committed.png', fullPage: true }).catch(() => {});
      throw new Error(
        `A/P Credit Note line Amount never committed to ${amount} after two attempts — ` +
        'saved test-results/debug-ap-credit-note-amount-not-committed.png for inspection.'
      );
    }
  }

  async _pollAmountCommitted(amountInput, amount, timeout = 3000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const value = await amountInput.inputValue().catch(() => null);
      if (value != null && Number(value) === Number(amount)) return true;
      await this.page.waitForTimeout(200);
    }
    return false;
  }

  /** ASSUMED (mirroring arCreditNotePage.js, unconfirmed for this specific AP screen): every save-type action triggers a generic "Unapplied Amount Not Zero" confirmation since a fresh test document is never knocked off. No-op if it never appears. */
  async _confirmUnappliedAmountIfPresent() {
    const yesButton = this.formFrame.locator('#ctl00_pcConfirmMessageBox_btnConfirmYes_CD');
    const appeared = await yesButton.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
    if (!appeared) return;
    await yesButton.click();
    await yesButton.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    await this.page.waitForTimeout(1000);
  }

  async clickSaveDraft() {
    const saveButton = this.formFrame.getByRole('listitem', { name: 'Save Draft [Alt + S]' });
    await saveButton.click();
    await this._confirmUnappliedAmountIfPresent();
  }

  async clickPost() {
    const postButton = this.formFrame.getByRole('listitem', { name: 'Post [Alt + P]' });
    await postButton.click();
    await this._confirmUnappliedAmountIfPresent();
  }

  async clickPostAndNew() {
    const postAndNewButton = this.formFrame.getByRole('listitem', { name: 'Post & New [Alt + Ctrl + P]' });
    await postAndNewButton.click();
    await this._confirmUnappliedAmountIfPresent();
  }

  /** Same report-tab-switch pattern already confirmed across every module in this app — best-effort, no-op if there's nothing to switch. */
  async _switchBackToCreditNoteTab() {
    await this.page.getByRole('link', { name: 'A/P Credit Note', exact: true }).last()
      .click({ timeout: 3000 }).catch(() => {});
    await this.page.waitForTimeout(500);
  }

  async clickBack() {
    await this._switchBackToCreditNoteTab();
    const backButton = this.formFrame.getByRole('listitem', { name: 'Back [Alt + B]' });
    await backButton.click();
    await this.page.waitForTimeout(1000);
    await this._resolveListFrame();
  }

  /** New -> Vendor -> Reason -> Reference No -> one Account No. line with Amount. Stops before any save action. */
  async createCreditNote({ vendorCode, reason = 'Testing', referenceNo, accountCode, amount }) {
    await this.clickNew();
    await this.selectVendor(vendorCode);
    await this.fillReason(reason);
    await this.fillReferenceNo(referenceNo);
    await this.addCreditNoteLine({ accountCode, amount });
  }

  async getDocumentNo() {
    const field = this.formFrame.getByRole('textbox', { name: 'Document No.:', exact: true });
    return (await field.inputValue().catch(() => null)) || (await field.textContent().catch(() => null));
  }

  async getStatus() {
    const field = this.formFrame.getByRole('textbox', { name: 'Status:', exact: true });
    return (await field.inputValue().catch(() => null)) || (await field.textContent().catch(() => null));
  }

  /** Waits for a genuine GRID DATA ROW matching the given Reference No. Row-name prefix CONFIRMED live (2026-08-27): "APCreditNoteDetailPage" — see class doc. */
  async _waitForRowMatchingReference(referenceNo, timeout = 15000) {
    const escaped = referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dataRowPattern = new RegExp(`^APCreditNoteDetailPage\\s+Cancel\\b.*\\b${escaped}\\b`, 'i');
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

  /**
   * CONFIRMED live (2026-08-27) via direct DOM inspection of the real
   * dialog — container `cpnlAPCreditNoteHeader`, dropdown trigger with no
   * "Img" suffix, confirm button `btnCancelDocument_CD` (same shape as
   * apDebitNotePage.js, different container name).
   */
  async _selectCancelReasonIfPresent() {
    const dialogTitle = this.listFrame.getByText('Cancel Reason', { exact: true });
    const appeared = await dialogTitle.first().waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
    if (!appeared) return;

    const dropdownArrow = this.listFrame.locator('#ctl00_MainContent_APCreditNoteHdr_cpnlAPCreditNoteHeader_pcCancelReason_pcCancelReason_formCancelReason_cbReason_B-1');
    await dropdownArrow.waitFor({ state: 'visible', timeout: 5000 });
    await dropdownArrow.click();
    await this.page.waitForTimeout(500);

    const firstOption = this.listFrame.getByRole('cell', { name: '1', exact: true }).first();
    await firstOption.waitFor({ state: 'visible', timeout: 5000 });
    await firstOption.click();
    await this.page.waitForTimeout(500);

    const { locator: okButton } = await heal(this.listFrame, {
      id: 'apCreditNote.cancelReasonOkButton',
      label: 'Cancel Reason Ok',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_APCreditNoteHdr_cpnlAPCreditNoteHeader_pcCancelReason_pcCancelReason_formCancelReason_btnCancelDocument_CD' },
        { type: 'css', value: '[id*="formCancelReason" i][id*="btnCancelDocument_CD" i]' },
      ],
      timeout: 5000,
    });
    await okButton.click();
    await dialogTitle.first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    await this.page.waitForTimeout(1000);
  }

  /** ASSUMED as this screen's real cleanup mechanism, mirroring A/P Debit Note (plain Cancel Confirmation for DRAFT, plus a stacked Cancel Reason dialog for POSTED). Scoped to this.listFrame, never page-wide. */
  async cancelDocument(referenceNo) {
    await this._resolveListFrame();
    const matched = await this._waitForRowMatchingReference(referenceNo);
    if (!matched) {
      await this.page.screenshot({
        path: `test-results/debug-ap-credit-note-cancel-not-found-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `A/P Credit Note grid never showed a row matching Reference No. "${referenceNo}" — ` +
        'refusing to proceed with Cancel against a possibly-stale/unfiltered row.'
      );
    }
    const row = this.listFrame.getByRole('row', {
      name: new RegExp(`^APCreditNoteDetailPage\\s+Cancel\\b.*\\b${referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
    }).first();
    await row.getByRole('link', { name: 'Cancel', exact: true }).click();

    const { locator: yesButton } = await heal(this.listFrame, {
      id: 'apCreditNote.cancelConfirmYesButton',
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

    await this._selectCancelReasonIfPresent();
  }

  /** ASSUMED (mirroring A/P Debit Note): may not reliably show a "Cancelled Successfully" banner — verify via the listing grid instead. */
  async isCancelSuccessful(referenceNo, timeout = 10000) {
    const escaped = referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dataRowPattern = new RegExp(`^APCreditNoteDetailPage\\s+Cancel\\b.*\\b${escaped}\\b`, 'i');
    const row = this.listFrame.getByRole('row', { name: dataRowPattern });
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if ((await row.count().catch(() => 0)) === 0) return true;
      await this.page.waitForTimeout(300);
    }
    return false;
  }
}

module.exports = { ApCreditNotePage };
