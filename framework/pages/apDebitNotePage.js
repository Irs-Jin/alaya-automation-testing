const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Account Payable (transactional module) > A/P Debit Note.
 *
 * SOURCE: NO Katalon Object Repository entry or Playwright codegen
 * recording available for this screen — built from a live DOM inspection
 * (2026-08-27) done BEFORE writing this file (learned from apInvoicePage.js/
 * apPaymentRefundPage.js needing several rounds of live fixes otherwise).
 * CONFIRMED live: this screen's line-item grid (`gvAPDNItem`) has the
 * EXACT SAME column set as apInvoicePage.js's own confirmed grid —
 * Account No./Description/2nd Description/Reference No/Cost Centre/
 * Amount/Tax Code/Tax Amount/Taxable Amount/Tax Adjustment, same
 * DXEditor numbering (3/5/6/7/9/12/13/14/15/16/17) — confirmed via a live
 * screenshot showing identical column headers/order. CONFIRMED live: the
 * header has a mandatory "Supplier Debit Note No.:*" field
 * (`txtSupplierDebitNoteNo_I`), the AP-side sibling of A/P Invoice's own
 * "Supplier Inv. No.:*". Container naming (`APDebitNoteDtl`/
 * `cbpAPDebitNote`/`formAPDNHeader`) is a CONFIRMED direct AR->AP
 * substitution of arDebitNotePage.js's own confirmed
 * `ARDebitNoteDtl`/`cbpARDebitNote`/`formARDNHeader` pattern.
 *
 * UNCONFIRMED (assumed by analogy to arDebitNotePage.js, verify live):
 * - Save Draft/Post trigger NO knock-off confirmation dialog (A/R Debit
 *   Note confirmed none; A/P Invoice's own dialog, if any, uses the
 *   generic `pcConfirmMessageBox` control answered No — not wired up here
 *   since A/R Debit Note needed neither).
 * - Cancel behaves differently by status: DRAFT is a plain "Cancel
 *   Confirmation" only; POSTED reveals a second stacked "Cancel Reason"
 *   dialog with a mandatory Reason dropdown — same as A/R Debit Note.
 *   `cancelDocument()` below mirrors that handling verbatim.
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable — always re-resolved via findFrame() by content, never
 * hardcoded.
 */
class ApDebitNotePage {
  constructor(page) {
    this.page = page;
    this.listFrame = null;
    this.formFrame = null;
  }

  async goto() {
    const p = this.page;
    await p.getByRole('link', { name: 'Account Payable', exact: true }).click();
    await p.getByRole('link', { name: 'A/P Debit Note', exact: true }).click();
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
      await p.screenshot({ path: 'test-results/debug-ap-debit-note-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the frame containing the A/P Debit Note list "New" icon. ' +
        'Saved test-results/debug-ap-debit-note-list-page.png for inspection.'
      );
    }
  }

  /** CONFIRMED live (2026-08-27) — the Vendor field's real CSS id. */
  async _resolveFormFrame() {
    const p = this.page;
    this.formFrame = await findFrame(p, async (frame) => {
      const field = frame.locator('#ctl00_MainContent_APDebitNoteDtl_cbpAPDebitNote_cbpAPDebitNoteDetail_ASPxRoundPanel1_formAPDNHeader_cbVendor_cbVendor_I');
      return (await field.count().catch(() => 0)) > 0 && (await field.first().isVisible().catch(() => false));
    });
    if (!this.formFrame) {
      await p.screenshot({ path: 'test-results/debug-ap-debit-note-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the A/P Debit Note create/edit form frame (Vendor field). ' +
        'Saved test-results/debug-ap-debit-note-form-not-found.png for inspection.'
      );
    }
  }

  /** UNCONFIRMED primary CSS id (New icon) — falls back to the generic "New"/Insert icon role match, which is what actually resolved this live. */
  async clickNew() {
    let addIcon;
    try {
      const { locator } = await heal(this.listFrame, {
        id: 'apDebitNote.newIcon',
        label: 'New',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_APDebitNoteHdr_cpnlAPDebitNoteHeader_formC_gvAPDebitNote_header17_Add' },
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

  /** CONFIRMED live (2026-08-27): real direct CSS id — used directly rather than a role/label match (this app's repeated "no accessible name bound" trap). Keep to 20 characters or fewer, app-wide convention. */
  async fillReferenceNo(referenceNo) {
    const field = this.formFrame.locator('#ctl00_MainContent_APDebitNoteDtl_cbpAPDebitNote_cbpAPDebitNoteDetail_ASPxRoundPanel1_formAPDNHeader_txtRefNo_I');
    await field.click();
    await field.fill(referenceNo);
  }

  /** CONFIRMED live (2026-08-27): a SECOND mandatory header field on this screen, the AP-side sibling of A/P Invoice's "Supplier Inv. No.:*" — filled with the same value as Reference No for simplicity. */
  async fillSupplierDebitNoteNo(supplierDebitNoteNo) {
    const field = this.formFrame.locator('#ctl00_MainContent_APDebitNoteDtl_cbpAPDebitNote_cbpAPDebitNoteDetail_ASPxRoundPanel1_formAPDNHeader_txtSupplierDebitNoteNo_I');
    await field.click();
    await field.fill(supplierDebitNoteNo);
  }

  /** Opens the header's Vendor popup search grid and selects a row by its Vendor Code — same confirmed AP-side pattern as apPaymentPage.js/apInvoicePage.js/apPaymentRefundPage.js. */
  async selectVendor(vendorCode) {
    const f = this.formFrame;
    const pickerIcon = f.locator('#ctl00_MainContent_APDebitNoteDtl_cbpAPDebitNote_cbpAPDebitNoteDetail_ASPxRoundPanel1_formAPDNHeader_cbVendor_cbVendor_B1Img');
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
   * Adds one debit note line: click the "Debit Info" grid's own Add icon,
   * pick an Account No., fill the Amount.
   *
   * CONFIRMED live (2026-08-27): this grid's column set/DXEditor numbering
   * is IDENTICAL to apInvoicePage.js's own confirmed grid (same
   * Account No./Description/2nd Description/Reference No/Cost Centre/
   * Amount/Tax Code/... shape) — reusing that confirmed mapping directly:
   * Account No. trigger = DXEditor3 (picker), Amount = DXEditor12 (plain).
   */
  async addDebitNoteLine({ accountCode, amount }) {
    const f = this.formFrame;
    const { locator: addIcon } = await heal(f, {
      id: 'apDebitNote.addLineIcon',
      label: 'Add Line',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_APDebitNoteDtl_cbpAPDebitNote_cpnlAPDNItem_formAPDNItem_PC_0_gvAPDNItem_header0_Add' },
      ],
      timeout: 15000,
    }).catch(async () => ({ locator: f.getByRole('img', { name: /Click Here Or Press \[Insert\]/i }).first() }));
    await addIcon.waitFor({ state: 'visible', timeout: 15000 });
    await addIcon.click();
    await this.page.waitForTimeout(800);

    const { locator: accountTrigger } = await heal(f, {
      id: 'apDebitNote.accountNoTrigger',
      label: 'Account No.',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_APDebitNoteDtl_cbpAPDebitNote_cpnlAPDNItem_formAPDNItem_PC_0_gvAPDNItem_DXEditor3_B-1' },
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
    const amountInput = f.locator('#ctl00_MainContent_APDebitNoteDtl_cbpAPDebitNote_cpnlAPDNItem_formAPDNItem_PC_0_gvAPDNItem_DXEditor12_I');
    await amountInput.click();
    await amountInput.fill(String(amount));
    await amountInput.press('Tab');
    await this.page.waitForTimeout(500);

    if (await this._isAmountCommitted(amount)) return;

    const requiredIcon = f.getByRole('img', { name: 'Amount Required' }).first();
    if (await requiredIcon.count().catch(() => 0) > 0) {
      await requiredIcon.click();
      await this.page.waitForTimeout(300);
    }
    const retryInput = f.locator('#ctl00_MainContent_APDebitNoteDtl_cbpAPDebitNote_cpnlAPDNItem_formAPDNItem_PC_0_gvAPDNItem_DXEditor12_I');
    await retryInput.click();
    await retryInput.fill(String(amount));
    await retryInput.press('Tab');
    await this.page.waitForTimeout(500);

    if (!(await this._isAmountCommitted(amount))) {
      await this.page.screenshot({ path: 'test-results/debug-ap-debit-note-amount-not-committed.png', fullPage: true }).catch(() => {});
      throw new Error(
        `A/P Debit Note line Amount never committed to ${amount} after two attempts — ` +
        'saved test-results/debug-ap-debit-note-amount-not-committed.png for inspection.'
      );
    }
  }

  async _isAmountCommitted(amount) {
    const total = this.formFrame.getByText(`Total ${Number(amount).toFixed(2)}`, { exact: false });
    return (await total.count().catch(() => 0)) > 0;
  }

  /** ASSUMED (mirroring A/R Debit Note, unconfirmed): no knock-off confirmation dialog on this screen. If one appears live, add handling here matching apInvoicePage.js's _declineKnockOffIfPresent(). */
  async clickSaveDraft() {
    const saveButton = this.formFrame.getByRole('listitem', { name: 'Save Draft [Alt + S]' });
    await saveButton.click();
    await this.page.waitForTimeout(1000);
  }

  async clickPost() {
    const postButton = this.formFrame.getByRole('listitem', { name: 'Post [Alt + P]' });
    await postButton.click();
    await this.page.waitForTimeout(1000);
  }

  async clickPostAndNew() {
    const postAndNewButton = this.formFrame.getByRole('listitem', { name: 'Post & New [Alt + Ctrl + P]' });
    await postAndNewButton.click();
    await this.page.waitForTimeout(1000);
  }

  /** Same report-tab-switch pattern already confirmed across every module in this app — best-effort, no-op if there's nothing to switch. */
  async _switchBackToDebitNoteTab() {
    await this.page.getByRole('link', { name: 'A/P Debit Note', exact: true }).last()
      .click({ timeout: 3000 }).catch(() => {});
    await this.page.waitForTimeout(500);
  }

  async clickBack() {
    await this._switchBackToDebitNoteTab();
    const backButton = this.formFrame.getByRole('listitem', { name: 'Back [Alt + B]' });
    await backButton.click();
    await this.page.waitForTimeout(1000);
    await this._resolveListFrame();
  }

  /** New -> Vendor -> Supplier Debit Note No. -> Reference No -> one Account No. line with Amount. Stops before any save action. */
  async createDebitNote({ vendorCode, referenceNo, accountCode, amount }) {
    await this.clickNew();
    await this.selectVendor(vendorCode);
    await this.fillSupplierDebitNoteNo(referenceNo);
    await this.fillReferenceNo(referenceNo);
    await this.addDebitNoteLine({ accountCode, amount });
  }

  async getDocumentNo() {
    const field = this.formFrame.getByRole('textbox', { name: 'Document No.:', exact: true });
    return (await field.inputValue().catch(() => null)) || (await field.textContent().catch(() => null));
  }

  async getStatus() {
    const field = this.formFrame.getByRole('textbox', { name: 'Status:', exact: true });
    return (await field.inputValue().catch(() => null)) || (await field.textContent().catch(() => null));
  }

  /** Waits for a genuine GRID DATA ROW matching the given Reference No. Row-name prefix "APDNDetailPage" is CONFIRMED live (2026-08-27) — NOT "APDebitNoteDetailPage" as a direct AR->AP substitution of arDebitNotePage.js's own "ARDebitNoteDetailPage" would suggest. */
  async _waitForRowMatchingReference(referenceNo, timeout = 15000) {
    const escaped = referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dataRowPattern = new RegExp(`^APDNDetailPage\\s+Cancel\\b.*\\b${escaped}\\b`, 'i');
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
   * CONFIRMED live (2026-08-27) as this screen's real 2-dialog Cancel
   * Reason behavior for POSTED documents — a no-op for DRAFT. Two things
   * genuinely differ from arDebitNotePage.js's own confirmed equivalent:
   * the container is `cpnlAPDNHeader`, NOT `cpnlAPDebitNoteHeader` (a
   * direct AR->AP substitution would have guessed wrong), and the confirm
   * button is labelled "Ok" (its own internal control name
   * `btnCancelDocument_CD`), NOT the "Ok Ok" doubled accessible name A/R
   * Debit Note's dialog happens to produce — targeted by CSS id directly
   * to sidestep any accessible-name ambiguity.
   */
  async _selectCancelReasonIfPresent() {
    const dialogTitle = this.listFrame.getByText('Cancel Reason', { exact: true });
    const appeared = await dialogTitle.first().waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
    if (!appeared) return;

    const dropdownArrow = this.listFrame.locator('#ctl00_MainContent_APDebitNoteHdr_cpnlAPDNHeader_pcCancelReason_pcCancelReason_formCancelReason_cbReason_B-1');
    await dropdownArrow.waitFor({ state: 'visible', timeout: 5000 });
    await dropdownArrow.click();
    await this.page.waitForTimeout(500);

    const firstOption = this.listFrame.getByRole('cell', { name: '1', exact: true }).first();
    await firstOption.waitFor({ state: 'visible', timeout: 5000 });
    await firstOption.click();
    await this.page.waitForTimeout(500);

    const { locator: okButton } = await heal(this.listFrame, {
      id: 'apDebitNote.cancelReasonOkButton',
      label: 'Cancel Reason Ok',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_APDebitNoteHdr_cpnlAPDNHeader_pcCancelReason_pcCancelReason_formCancelReason_btnCancelDocument_CD' },
        { type: 'css', value: '[id*="formCancelReason" i][id*="btnCancelDocument_CD" i]' },
      ],
      timeout: 5000,
    });
    await okButton.click();
    await dialogTitle.first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    await this.page.waitForTimeout(1000);
  }

  /** ASSUMED as this screen's real cleanup mechanism, mirroring A/R Debit Note (plain Cancel Confirmation for DRAFT, plus a stacked Cancel Reason dialog for POSTED). Scoped to this.listFrame, never page-wide. */
  async cancelDocument(referenceNo) {
    await this._resolveListFrame();
    const matched = await this._waitForRowMatchingReference(referenceNo);
    if (!matched) {
      await this.page.screenshot({
        path: `test-results/debug-ap-debit-note-cancel-not-found-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `A/P Debit Note grid never showed a row matching Reference No. "${referenceNo}" — ` +
        'refusing to proceed with Cancel against a possibly-stale/unfiltered row.'
      );
    }
    const row = this.listFrame.getByRole('row', {
      name: new RegExp(`^APDNDetailPage\\s+Cancel\\b.*\\b${referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
    }).first();
    await row.getByRole('link', { name: 'Cancel', exact: true }).click();

    const { locator: yesButton } = await heal(this.listFrame, {
      id: 'apDebitNote.cancelConfirmYesButton',
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

  /** ASSUMED (mirroring A/R Debit Note): may not reliably show a "Cancelled Successfully" banner — verify via the listing grid instead. */
  async isCancelSuccessful(referenceNo, timeout = 10000) {
    const escaped = referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dataRowPattern = new RegExp(`^APDNDetailPage\\s+Cancel\\b.*\\b${escaped}\\b`, 'i');
    const row = this.listFrame.getByRole('row', { name: dataRowPattern });
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if ((await row.count().catch(() => 0)) === 0) return true;
      await this.page.waitForTimeout(300);
    }
    return false;
  }
}

module.exports = { ApDebitNotePage };
