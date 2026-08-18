const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Account Receivable (transactional module) > A/R Debit
 * Note.
 *
 * SOURCE: built directly from Jin's own Playwright codegen recording
 * (2026-08-16) plus a full live exploration/confirmation of the same SIT
 * environment (uat/admin) — no Katalon Object Repository entry exists for
 * this screen yet. Every selector below was exercised live end-to-end
 * (Save Draft, Post, and Post & New, each followed by Cancel + a fresh grid
 * check to confirm gone) against a real customer ("YEONG", code 000001,
 * already confirmed a safe reusable sandbox customer in arInvoicePage.js's/
 * arPaymentPage.js's/arPaymentRefundPage.js's work).
 *
 * SHAPE: near-identical to A/R Invoice — same underlying control shape
 * (`cbpARDebitNote`/`mARDNDetailsToolBar` instead of `cbpARJournalEntry`/
 * `mARJEDetailsToolBar` — see arInvoicePage.js), same Items grid Account
 * No. popup (Code/Description columns, "GST-3010" confirmed the first
 * option, same as A/R Invoice — confirmed directly from Jin's recording,
 * not assumed by analogy).
 *
 * CONFIRMED LIVE (2026-08-16): unlike A/R Invoice/A/P Payment/A/R Payment/
 * A/R Payment Refund, Save Draft and Post on this screen trigger NO
 * knock-off/confirmation message box at all — no
 * `pcConfirmMessageBox_btnConfirmYes_CD`/`btnConfirmNo_CD` dialog appears
 * for either action.
 *
 * CONFIRMED LIVE (2026-08-16): Cancel behaves DIFFERENTLY depending on
 * status — this is the one genuinely new wrinkle vs every other A/R
 * screen so far:
 *   - DRAFT: the plain "Cancel Confirmation" dialog only (same
 *     `pcConfirmCancel_btnYesCancel_CD` control as every other module).
 *   - POSTED: the same "Cancel Confirmation" dialog, but clicking its Yes
 *     reveals a SECOND dialog stacked underneath it — "Cancel Reason",
 *     with a mandatory Reason dropdown (this UAT environment's list is
 *     unconfigured placeholder data, just "1"/"2" — either is fine) and
 *     its own Ok button. This stacking was invisible in an accessibility
 *     snapshot taken right after the Yes click; only a full-page
 *     screenshot revealed it. `cancelDocument()` handles both shapes;
 *     DRAFT-status cancels are a no-op past the first dialog.
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable — always re-resolved via findFrame() by content, never
 * hardcoded.
 */
class ArDebitNotePage {
  constructor(page) {
    this.page = page;
    this.listFrame = null;
    this.formFrame = null;
  }

  async goto() {
    const p = this.page;
    await p.getByRole('link', { name: 'Account Receivable', exact: true }).click();
    await p.getByRole('link', { name: 'A/R Debit Note', exact: true }).click();
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
      await p.screenshot({ path: 'test-results/debug-ar-debit-note-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the frame containing the A/R Debit Note list "New" icon. ' +
        'Saved test-results/debug-ar-debit-note-list-page.png for inspection.'
      );
    }
  }

  /** CONFIRMED live (2026-08-16): the Customer field has no accessible name — check its confirmed CSS id directly, same trap as arInvoicePage.js/apPaymentPage.js. */
  async _resolveFormFrame() {
    const p = this.page;
    this.formFrame = await findFrame(p, async (frame) => {
      const field = frame.locator('#ctl00_MainContent_ARDebitNoteDtl_cbpARDebitNote_cbpARDebitNoteDetail_ASPxRoundPanel1_formARDNHeader_cbCustomer_cbSelectCust_I');
      return (await field.count().catch(() => 0)) > 0 && (await field.first().isVisible().catch(() => false));
    });
    if (!this.formFrame) {
      await p.screenshot({ path: 'test-results/debug-ar-debit-note-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the A/R Debit Note create/edit form frame (Customer field). ' +
        'Saved test-results/debug-ar-debit-note-form-not-found.png for inspection.'
      );
    }
  }

  /** CONFIRMED live (2026-08-16): the grid header's own "New"/Insert icon; role match as fallback. */
  async clickNew() {
    let addIcon;
    try {
      const { locator } = await heal(this.listFrame, {
        id: 'arDebitNote.newIcon',
        label: 'New',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_ARDebitNoteHdr_cpnlARDebitNoteHeader_formC_gvARDebitNote_header17_Add' },
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

  /** Fills the header's Reference No field — see fillReferenceNo() in apPaymentPage.js for why this (not Document No.) is used to find-and-cancel a specific document later. Keep to 20 characters or fewer (confirmed display truncation on this app-wide pattern). */
  async fillReferenceNo(referenceNo) {
    const field = this.formFrame.getByRole('textbox', { name: 'Reference No:', exact: true });
    await field.click();
    await field.fill(referenceNo);
  }

  /** Opens the header's Customer popup search grid and selects a row by its Customer Code, then confirms with the popup's own OK button. */
  async selectCustomer(customerCode) {
    const f = this.formFrame;
    const pickerIcon = f.locator('#ctl00_MainContent_ARDebitNoteDtl_cbpARDebitNote_cbpARDebitNoteDetail_ASPxRoundPanel1_formARDNHeader_cbCustomer_cbSelectCust_B1Img');
    await pickerIcon.click();

    const popupFrame = (await findFrame(this.page, async (frame) => {
      const cell = frame.getByRole('cell', { name: customerCode, exact: true });
      return (await cell.count().catch(() => 0)) > 0;
    })) || f;
    await popupFrame.getByRole('cell', { name: customerCode, exact: true }).first().click();

    // Same "_CD is the real clickable element" pattern already confirmed
    // for A/P Payment's/A/R Invoice's/A/R Payment's/A/R Payment Refund's OK button.
    await popupFrame.locator('[id$="_formGeneralSearchControl_btnOk_CD"]').first().click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Adds one debit note line: click the Items grid's own Insert icon, pick
   * an Account No., fill the Amount.
   *
   * CONFIRMED live (2026-08-16): the Account No. picker is a popup grid
   * (Code/Description columns) — click the trigger, then click the
   * matching option's Code cell directly, same shape as A/R Invoice's
   * equivalent (confirmed directly from Jin's own recording: "GST-3010").
   */
  async addDebitNoteLine({ accountCode, amount }) {
    const f = this.formFrame;
    const addIcon = f.getByRole('img', { name: /Click Here Or Press \[Insert\]/i }).first();
    await addIcon.waitFor({ state: 'visible', timeout: 15000 });
    await addIcon.click();
    await this.page.waitForTimeout(800);

    const { locator: accountTrigger } = await heal(f, {
      id: 'arDebitNote.accountNoTrigger',
      label: 'Account No.',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_ARDebitNoteDtl_cbpARDebitNote_cpnlARDNItem_formARDNItem_PC_0_gvARDNItem_DXEditor3_B-1Img' },
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

  /** CONFIRMED live (2026-08-16): Amount can silently fail to commit on the first fill+Tab, same as A/R Invoice — verify via the row's Total, retry once if it didn't stick. */
  async _fillAmountWithRetry(amount) {
    const f = this.formFrame;
    const amountInput = f.locator('#ctl00_MainContent_ARDebitNoteDtl_cbpARDebitNote_cpnlARDNItem_formARDNItem_PC_0_gvARDNItem_DXEditor13_I');
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
    const retryInput = f.locator('#ctl00_MainContent_ARDebitNoteDtl_cbpARDebitNote_cpnlARDNItem_formARDNItem_PC_0_gvARDNItem_DXEditor13_I');
    await retryInput.click();
    await retryInput.fill(String(amount));
    await retryInput.press('Tab');
    await this.page.waitForTimeout(500);

    if (!(await this._isAmountCommitted(amount))) {
      await this.page.screenshot({ path: 'test-results/debug-ar-debit-note-amount-not-committed.png', fullPage: true }).catch(() => {});
      throw new Error(
        `A/R Debit Note line Amount never committed to ${amount} after two attempts — ` +
        'saved test-results/debug-ar-debit-note-amount-not-committed.png for inspection.'
      );
    }
  }

  async _isAmountCommitted(amount) {
    const total = this.formFrame.getByText(`Total ${Number(amount).toFixed(2)}`, { exact: false });
    return (await total.count().catch(() => 0)) > 0;
  }

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

  /** CONFIRMED live (2026-08-16): posts the current document AND leaves a fresh blank New form behind. */
  async clickPostAndNew() {
    const postAndNewButton = this.formFrame.getByRole('listitem', { name: 'Post & New [Alt + Ctrl + P]' });
    await postAndNewButton.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * CONFIRMED live (2026-08-16), same pattern as arInvoicePage.js's
   * _switchBackToInvoiceTab(): Post and Post & New both open a NEW in-app
   * workspace tab ("A/R Debit Note Document Report") that becomes the
   * active/frontmost one, leaving the "A/R Debit Note" tab's own toolbar no
   * longer interactable until switched back to. Best-effort — a no-op if
   * there's nothing to switch (e.g. after Save Draft, which never opens a
   * report tab).
   */
  async _switchBackToDebitNoteTab() {
    await this.page.getByRole('link', { name: 'A/R Debit Note', exact: true }).last()
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

  /** New -> Customer -> Reference No -> one Account No. line with Amount. Stops before any save action. */
  async createDebitNote({ customerCode, referenceNo, accountCode, amount }) {
    await this.clickNew();
    await this.selectCustomer(customerCode);
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

  /** Waits for a genuine GRID DATA ROW matching the given Reference No — same principle as apPaymentPage.js/arInvoicePage.js's equivalent. */
  async _waitForRowMatchingReference(referenceNo, timeout = 15000) {
    const escaped = referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dataRowPattern = new RegExp(`^ARDebitNoteDetailPage\\s+Cancel\\b.*\\b${escaped}\\b`, 'i');
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
   * CONFIRMED live (2026-08-16): a second, mandatory "Cancel Reason"
   * dialog appears stacked underneath "Cancel Confirmation" ONLY for
   * POSTED documents — a no-op (returns immediately) for DRAFT ones. The
   * Reason dropdown in this UAT environment holds unconfigured placeholder
   * options ("1"/"2") — either satisfies the mandatory field, so the first
   * option is picked.
   *
   * BUG FIXED (2026-08-16, live test run): this dialog's markup actually
   * renders BEFORE the underlying list page in DOM order (confirmed from
   * the exploration snapshot — the opposite of the usual "popups append
   * last" assumption), so a `.last()`-qualified generic `cell {name: 'v'}`
   * match grabbed one of the list page's OWN "v" dropdown arrows (Company/
   * Date Type/From Date/To Date all expose the identical accessible
   * name), leaving the Reason field empty and every live test failing on
   * "Reason Required" validation. Fixed by targeting the dropdown
   * trigger's own confirmed CSS id directly (obtained live via the
   * generated-code output of clicking it), unambiguous regardless of DOM
   * order or accessible-name collisions.
   */
  async _selectCancelReasonIfPresent() {
    const dialogTitle = this.listFrame.getByText('Cancel Reason', { exact: true });
    const appeared = await dialogTitle.first().waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
    if (!appeared) return;

    const dropdownArrow = this.listFrame.locator('#ctl00_MainContent_ARDebitNoteHdr_cpnlARDebitNoteHeader_pcCancelReason_pcCancelReason_formCancelReason_cbReason_B-1');
    await dropdownArrow.waitFor({ state: 'visible', timeout: 5000 });
    await dropdownArrow.click();
    await this.page.waitForTimeout(500);

    const firstOption = this.listFrame.getByRole('cell', { name: '1', exact: true }).first();
    await firstOption.waitFor({ state: 'visible', timeout: 5000 });
    await firstOption.click();
    await this.page.waitForTimeout(500);

    // CONFIRMED live: this Ok button's accessible name computes as the
    // doubled "Ok Ok" (label text + nested generic), exactly as captured
    // in Jin's own recording — matching that directly rather than a bare
    // "Ok" avoids relying on which inner node getByText happens to hit.
    const okButton = this.listFrame.getByText('Ok Ok', { exact: true }).first();
    await okButton.click();
    await dialogTitle.first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    await this.page.waitForTimeout(1000);
  }

  /**
   * CONFIRMED live (2026-08-16) as this screen's real cleanup mechanism —
   * no hard-delete exists here. Click the row's own "Cancel" icon/link,
   * confirm the "Cancel Confirmation" dialog via the SAME
   * `pcConfirmCancel_btnYesCancel_CD` control already confirmed for A/P
   * Payment/A/R Invoice/A/R Payment/A/R Payment Refund, THEN — for POSTED
   * documents only — handle the additional "Cancel Reason" dialog. Scoped
   * to this.listFrame, never page-wide.
   */
  async cancelDocument(referenceNo) {
    await this._resolveListFrame();
    const matched = await this._waitForRowMatchingReference(referenceNo);
    if (!matched) {
      await this.page.screenshot({
        path: `test-results/debug-ar-debit-note-cancel-not-found-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `A/R Debit Note grid never showed a row matching Reference No. "${referenceNo}" — ` +
        'refusing to proceed with Cancel against a possibly-stale/unfiltered row.'
      );
    }
    const row = this.listFrame.getByRole('row', {
      name: new RegExp(`^ARDebitNoteDetailPage\\s+Cancel\\b.*\\b${referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
    }).first();
    await row.getByRole('link', { name: 'Cancel', exact: true }).click();

    const { locator: yesButton } = await heal(this.listFrame, {
      id: 'arDebitNote.cancelConfirmYesButton',
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

  /**
   * CONFIRMED live (2026-08-16): unlike every other A/R screen so far,
   * this one does NOT reliably show a "Cancelled Successfully" banner
   * within any reasonable check window (confirmed via three separate live
   * test runs — Save Draft/Post/Post & New — where the underlying Cancel
   * genuinely succeeded, per the listing grid, but no banner text was ever
   * caught). Verify via the listing grid instead, same "no banner, check
   * the grid" precedent already used for Save Draft on A/R Invoice/A/R
   * Payment Refund: the row must disappear from the default DRAFT+POSTED
   * view.
   */
  async isCancelSuccessful(referenceNo, timeout = 10000) {
    const escaped = referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dataRowPattern = new RegExp(`^ARDebitNoteDetailPage\\s+Cancel\\b.*\\b${escaped}\\b`, 'i');
    const row = this.listFrame.getByRole('row', { name: dataRowPattern });
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if ((await row.count().catch(() => 0)) === 0) return true;
      await this.page.waitForTimeout(300);
    }
    return false;
  }
}

module.exports = { ArDebitNotePage };
