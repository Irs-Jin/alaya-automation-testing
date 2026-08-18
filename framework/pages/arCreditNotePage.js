const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Account Receivable (transactional module) > A/R Credit
 * Note.
 *
 * SOURCE: built directly from Jin's own Playwright codegen recording
 * (2026-08-16) plus a full live exploration/confirmation of the same SIT
 * environment (uat/admin) — no Katalon Object Repository entry exists for
 * this screen yet. Every selector below was exercised live end-to-end
 * (Save Draft, Post, and Post & New, each followed by Cancel + a fresh
 * grid check to confirm gone) against a real customer ("YEONG", code
 * 000001, already confirmed a safe reusable sandbox customer in every
 * other A/R page object built this session).
 *
 * SHAPE: near-identical to A/R Debit Note/A/R Invoice — same underlying
 * control shape (`cbpARCreditNote`/`mARCreditNoteDetailsToolBar`), same
 * Items grid Account No. popup (Code/Description columns, "GST-3010"
 * confirmed the first option). TWO differences confirmed live:
 *
 * 1. This screen has a MANDATORY header "Reason:" textbox (in addition to
 *    the usual "Reference No:") — distinct from, and unrelated to, the
 *    "Reason:" dropdown that appears later in the POSTED-cancel dialog
 *    (same label, different field, different screen state). Any non-empty
 *    text satisfies it; it is not used as a lookup key.
 *
 * 2. The item grid's Amount field (confirmed id `..._DXEditor10_I`,
 *    matching Jin's own recording) has NO dropdown arrow and sits between
 *    the Cost Centre "v" cell and the Tax Code "v" cell — CONFIRMED LIVE
 *    this is easy to misidentify, because the Tax Adjustment field two
 *    columns to the right also defaults to displaying "0.00" and LOOKS
 *    like a second candidate. Filling Tax Adjustment instead of Amount
 *    silently succeeds (no error) but leaves Amount/Total Debit Amount at
 *    0.00 — caught only by rereading the full row, not by any validation
 *    error. `addCreditNoteLine()` targets the confirmed id directly to
 *    avoid this trap.
 *
 * CONFIRMED LIVE (2026-08-16): Save Draft, Post, AND Post & New all
 * trigger a "Unapplied Amount Not Zero, Are You Sure Want To Continue?"
 * confirmation via the SAME generic `pcConfirmMessageBox_btnConfirmYes_CD`
 * control already confirmed for A/P Payment/A/R Invoice/A/R Payment/A/R
 * Payment Refund — happens every time because this screen's test
 * documents are never knocked off against anything, so Unapplied Amount
 * always equals the full document amount. The correct answer is Yes.
 * (Jin's own recording double-clicked the toolbar button before this
 * dialog was answered — confirmed live as a harmless recorder artifact:
 * the dialog blocks the toolbar, so a second click on it while the modal
 * is open is a no-op. A single click is sufficient.)
 *
 * CONFIRMED LIVE (2026-08-16): Post opens a NEW in-app workspace tab
 * ("A/R Credit Note Document Report"), same pattern as every other
 * Post-capable screen in this app. Post & New, HOWEVER, does NOT open a
 * report tab on this screen — it posts and immediately shows a fresh
 * blank form in the SAME tab (confirmed by inspecting the tab bar right
 * after — no second tab ever appears). `_switchBackToCreditNoteTab()` is
 * still called as a best-effort no-op for symmetry with every other page
 * object, since it does nothing when there's no tab to switch to.
 *
 * CONFIRMED LIVE (2026-08-16): opening an ALREADY-SAVED document via its
 * Document No. link in the list (edit mode) shows NO "Back" toolbar
 * button at all — only Post & New/Post/Save Draft/New/More Options,
 * requiring the tab's own close icon instead. This does NOT affect this
 * page object, since every method here reaches the form exclusively via
 * clickNew() (which DOES show Back), never via re-opening a saved row.
 *
 * CONFIRMED LIVE (2026-08-16): Cancel behaves differently by status,
 * matching the app-wide pattern already confirmed in A/R Debit Note:
 *   - DRAFT: the plain "Cancel Confirmation" dialog only (same
 *     `pcConfirmCancel_btnYesCancel_CD` control as every other module).
 *   - POSTED: the same "Cancel Confirmation" dialog, but clicking its Yes
 *     reveals a SECOND dialog stacked underneath it — "Cancel Reason",
 *     with a mandatory Reason dropdown (this UAT environment's list is
 *     unconfigured placeholder data, just "1"/"2" — either is fine) and
 *     its own Ok button. CONFIRMED LIVE the dropdown trigger's id here
 *     (`..._cbReason_B-1Img`, WITH an "Img" suffix) differs from A/R
 *     Debit Note's equivalent (`..._cbReason_B-1`, no suffix) — verified
 *     directly via generated code, never assumed by analogy.
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable — always re-resolved via findFrame() by content, never
 * hardcoded.
 */
class ArCreditNotePage {
  constructor(page) {
    this.page = page;
    this.listFrame = null;
    this.formFrame = null;
  }

  async goto() {
    const p = this.page;
    await p.getByRole('link', { name: 'Account Receivable', exact: true }).click();
    await p.getByRole('link', { name: 'A/R Credit Note', exact: true }).click();
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
      await p.screenshot({ path: 'test-results/debug-ar-credit-note-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the frame containing the A/R Credit Note list "New" icon. ' +
        'Saved test-results/debug-ar-credit-note-list-page.png for inspection.'
      );
    }
  }

  /** CONFIRMED live (2026-08-16): the Customer field has no accessible name — check its confirmed CSS id directly, same trap as every other A/R page object. */
  async _resolveFormFrame() {
    const p = this.page;
    this.formFrame = await findFrame(p, async (frame) => {
      const field = frame.locator('#ctl00_MainContent_ARCreditNoteDtl_cbpARCreditNote_cbpARCreditNoteDetail_ASPxRoundPanel1_formARCNHeader_cbCustomer_cbSelectCust_I');
      return (await field.count().catch(() => 0)) > 0 && (await field.first().isVisible().catch(() => false));
    });
    if (!this.formFrame) {
      await p.screenshot({ path: 'test-results/debug-ar-credit-note-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the A/R Credit Note create/edit form frame (Customer field). ' +
        'Saved test-results/debug-ar-credit-note-form-not-found.png for inspection.'
      );
    }
  }

  /** CONFIRMED live (2026-08-16): the grid header's own "New"/Insert icon; role match as fallback. */
  async clickNew() {
    let addIcon;
    try {
      const { locator } = await heal(this.listFrame, {
        id: 'arCreditNote.newIcon',
        label: 'New',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_ARCreditNoteHdr_cpnlARCreditNoteHeader_formC_gvARCreditNote_header17_Add' },
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

  /** Fills the header's mandatory Reason field — any non-empty text satisfies it. NOT used as a search key (see fillReferenceNo() for that). */
  async fillReason(reason) {
    const field = this.formFrame.getByRole('textbox', { name: 'Reason:', exact: true });
    await field.click();
    await field.fill(reason);
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
    const pickerIcon = f.locator('#ctl00_MainContent_ARCreditNoteDtl_cbpARCreditNote_cbpARCreditNoteDetail_ASPxRoundPanel1_formARCNHeader_cbCustomer_cbSelectCust_B1Img');
    await pickerIcon.click();

    const popupFrame = (await findFrame(this.page, async (frame) => {
      const cell = frame.getByRole('cell', { name: customerCode, exact: true });
      return (await cell.count().catch(() => 0)) > 0;
    })) || f;
    await popupFrame.getByRole('cell', { name: customerCode, exact: true }).first().click();

    // Same "_CD is the real clickable element" pattern already confirmed
    // for every other A/R page object's OK button.
    await popupFrame.locator('[id$="_formGeneralSearchControl_btnOk_CD"]').first().click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Adds one credit note line: click the Items grid's own Insert icon,
   * pick an Account No., fill the Amount.
   *
   * CONFIRMED live (2026-08-16): the Account No. picker is a popup grid
   * (Code/Description columns) — click the trigger, then click the
   * matching option's Code cell directly, same shape as A/R Invoice/A/R
   * Debit Note's equivalent.
   */
  async addCreditNoteLine({ accountCode, amount }) {
    const f = this.formFrame;
    const addIcon = f.getByRole('img', { name: /Click Here Or Press \[Insert\]/i }).first();
    await addIcon.waitFor({ state: 'visible', timeout: 15000 });
    await addIcon.click();
    await this.page.waitForTimeout(800);

    const { locator: accountTrigger } = await heal(f, {
      id: 'arCreditNote.accountNoTrigger',
      label: 'Account No.',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_ARCreditNoteDtl_cbpARCreditNote_cpnlARPItem_formARCNItem_PC_0_ASPxFormLayout3_gvARCNItem_DXEditor3_I' },
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

  /**
   * CONFIRMED live (2026-08-16): Amount can silently fail to commit on
   * the first fill+Tab, same as A/R Invoice/A/R Debit Note — verify by
   * reading the input's own committed value directly, retry once if it
   * didn't stick. Targets the confirmed `_DXEditor10_I` id directly (see
   * class doc's Amount-vs-Tax-Adjustment trap) rather than any position/
   * column-based lookup.
   *
   * BUG FIXED (2026-08-16, live test run): the commit genuinely succeeds
   * almost immediately in every observed case (confirmed via failure
   * screenshots showing the correct 100.00 in Amount/Total Debit Amount)
   * — the original single-shot check 500ms after Tab was simply too
   * early and occasionally read the value mid-postback, misreporting a
   * real success as a failure. That false negative then triggered a
   * blind retry-click on the same input, which failed for real: once
   * DevExpress finishes committing a grid cell, it reverts from an
   * editable input back to a read-only display cell, so the retry's
   * click on the (now non-interactive) input timed out. Polling the
   * input's value for up to 3s replaces the single-shot check and
   * removes the need for that retry-click entirely in the common case.
   */
  async _fillAmountWithRetry(amount) {
    const f = this.formFrame;
    const amountInput = f.locator('#ctl00_MainContent_ARCreditNoteDtl_cbpARCreditNote_cpnlARPItem_formARCNItem_PC_0_ASPxFormLayout3_gvARCNItem_DXEditor10_I');
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
      await this.page.screenshot({ path: 'test-results/debug-ar-credit-note-amount-not-committed.png', fullPage: true }).catch(() => {});
      throw new Error(
        `A/R Credit Note line Amount never committed to ${amount} after two attempts — ` +
        'saved test-results/debug-ar-credit-note-amount-not-committed.png for inspection.'
      );
    }
  }

  /**
   * BUG FIXED (2026-08-16, live test run): originally scanned for a
   * concatenated `Total ${amount}` text node — same class of bug already
   * fixed once in arPaymentPage.js. On this screen the "Total" label and
   * its numeric value render in separate cells, so that text never
   * matches. Reads the input's own committed value directly instead,
   * polling briefly since the commit can take a moment to land.
   */
  async _pollAmountCommitted(amountInput, amount, timeout = 3000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const value = await amountInput.inputValue().catch(() => null);
      if (value != null && Number(value) === Number(amount)) return true;
      await this.page.waitForTimeout(200);
    }
    return false;
  }

  /**
   * CONFIRMED live (2026-08-16): every save-type action on this screen
   * (Save Draft/Post/Post & New) triggers a "Unapplied Amount Not Zero,
   * Are You Sure Want To Continue?" confirmation via the SAME generic
   * `pcConfirmMessageBox_btnConfirmYes_CD` control already confirmed for
   * A/P Payment/A/R Invoice/A/R Payment/A/R Payment Refund. The correct
   * answer here is Yes, matching Jin's own recording.
   */
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

  /** CONFIRMED live (2026-08-16): posts the current document AND leaves a fresh blank New form behind — UNLIKE every other A/R module, this does NOT open a separate report tab on this screen. */
  async clickPostAndNew() {
    const postAndNewButton = this.formFrame.getByRole('listitem', { name: 'Post & New [Alt + Ctrl + P]' });
    await postAndNewButton.click();
    await this._confirmUnappliedAmountIfPresent();
  }

  /**
   * CONFIRMED live (2026-08-16): Post opens a NEW in-app workspace tab
   * ("A/R Credit Note Document Report") that becomes the active/
   * frontmost one, leaving the "A/R Credit Note" tab's own toolbar no
   * longer interactable until switched back to. Best-effort — a no-op if
   * there's nothing to switch (Save Draft never opens one, and — unlike
   * every other A/R module — Post & New doesn't either on this screen).
   *
   * BUG FIXED (2026-08-16, live test run): a single click on the tab link
   * intermittently didn't "stick" under automation (not reproducible via
   * slower manual clicking) — the Report tab's own PDF-preview widget
   * does async work after load that can re-grab the active tab shortly
   * after our click lands. Retries the click, verifying via
   * `_resolveFormFrame()` that the switch genuinely took effect (not just
   * that the click didn't throw), instead of trusting one click plus a
   * fixed wait.
   */
  async _switchBackToCreditNoteTab() {
    const tabLink = this.page.getByRole('link', { name: 'A/R Credit Note', exact: true }).first();
    for (let attempt = 0; attempt < 3; attempt++) {
      await tabLink.click({ timeout: 3000 }).catch(() => {});
      await this.page.waitForTimeout(500);
      const switched = await this._resolveFormFrame().then(() => true).catch(() => false);
      if (switched) return;
    }
  }

  async clickBack() {
    await this._switchBackToCreditNoteTab();
    if (!this.formFrame) {
      await this.page.screenshot({
        path: `test-results/debug-ar-credit-note-back-tab-switch-failed-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        'Could not switch back to the A/R Credit Note tab after Post — ' +
        'saved a debug screenshot for inspection.'
      );
    }
    const backButton = this.formFrame.getByRole('listitem', { name: 'Back [Alt + B]' });
    await backButton.click();
    await this.page.waitForTimeout(1000);
    await this._resolveListFrame();
  }

  /** New -> Customer -> Reason -> Reference No -> one Account No. line with Amount. Stops before any save action. */
  async createCreditNote({ customerCode, reason = 'Testing', referenceNo, accountCode, amount }) {
    await this.clickNew();
    await this.selectCustomer(customerCode);
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

  /** Waits for a genuine GRID DATA ROW matching the given Reference No — same principle as every other A/R page object's equivalent. */
  async _waitForRowMatchingReference(referenceNo, timeout = 15000) {
    const escaped = referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dataRowPattern = new RegExp(`^ARCreditNoteDetailPage\\s+Cancel\\b.*\\b${escaped}\\b`, 'i');
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
   * POSTED documents — a no-op (returns immediately) for DRAFT ones,
   * same app-wide behavior as A/R Debit Note. The Reason dropdown in
   * this UAT environment holds unconfigured placeholder options
   * ("1"/"2") — either satisfies the mandatory field, so the first
   * option is picked. Targets the dropdown trigger's confirmed CSS id
   * directly — CONFIRMED this screen's id has an "Img" suffix
   * (`..._cbReason_B-1Img`), unlike A/R Debit Note's (`..._cbReason_B-1`,
   * no suffix) — verified live via generated code, not assumed.
   */
  async _selectCancelReasonIfPresent() {
    const dialogTitle = this.listFrame.getByText('Cancel Reason', { exact: true });
    const appeared = await dialogTitle.first().waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
    if (!appeared) return;

    const dropdownArrow = this.listFrame.locator('#ctl00_MainContent_ARCreditNoteHdr_cpnlARCreditNoteHeader_pcCancelReason_pcCancelReason_formCancelReason_cbReason_B-1Img');
    await dropdownArrow.waitFor({ state: 'visible', timeout: 5000 });
    await dropdownArrow.click();
    await this.page.waitForTimeout(500);

    const firstOption = this.listFrame.getByRole('cell', { name: '1', exact: true }).first();
    await firstOption.waitFor({ state: 'visible', timeout: 5000 });
    await firstOption.click();
    await this.page.waitForTimeout(500);

    // CONFIRMED live: this Ok button's accessible name computes as the
    // doubled "Ok Ok" (label text + nested generic), same as A/R Debit
    // Note's equivalent dialog.
    const okButton = this.listFrame.getByText('Ok Ok', { exact: true }).first();
    await okButton.click();
    await dialogTitle.first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    await this.page.waitForTimeout(1000);
  }

  /**
   * CONFIRMED live (2026-08-16) as this screen's real cleanup mechanism —
   * no hard-delete exists here (the row's trash-can-looking icon's
   * accessible name is "Cancel", not "Delete"). Click the row's own
   * Cancel link, confirm the "Cancel Confirmation" dialog via the SAME
   * `pcConfirmCancel_btnYesCancel_CD` control already confirmed for
   * every other A/R module, THEN — for POSTED documents only — handle
   * the additional "Cancel Reason" dialog. Scoped to this.listFrame,
   * never page-wide.
   */
  async cancelDocument(referenceNo) {
    await this._resolveListFrame();
    const matched = await this._waitForRowMatchingReference(referenceNo);
    if (!matched) {
      await this.page.screenshot({
        path: `test-results/debug-ar-credit-note-cancel-not-found-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `A/R Credit Note grid never showed a row matching Reference No. "${referenceNo}" — ` +
        'refusing to proceed with Cancel against a possibly-stale/unfiltered row.'
      );
    }
    const row = this.listFrame.getByRole('row', {
      name: new RegExp(`^ARCreditNoteDetailPage\\s+Cancel\\b.*\\b${referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
    }).first();
    await row.getByRole('link', { name: 'Cancel', exact: true }).click();

    const { locator: yesButton } = await heal(this.listFrame, {
      id: 'arCreditNote.cancelConfirmYesButton',
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
   * CONFIRMED live (2026-08-16): this screen does NOT reliably show a
   * "Cancelled Successfully" banner within any reasonable check window
   * (same finding as A/R Debit Note). Verify via the listing grid
   * instead: the row must disappear from the default DRAFT+POSTED view.
   */
  async isCancelSuccessful(referenceNo, timeout = 10000) {
    const escaped = referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dataRowPattern = new RegExp(`^ARCreditNoteDetailPage\\s+Cancel\\b.*\\b${escaped}\\b`, 'i');
    const row = this.listFrame.getByRole('row', { name: dataRowPattern });
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if ((await row.count().catch(() => 0)) === 0) return true;
      await this.page.waitForTimeout(300);
    }
    return false;
  }
}

module.exports = { ArCreditNotePage };
