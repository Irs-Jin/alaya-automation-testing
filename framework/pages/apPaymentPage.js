const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Account Payable (transactional module) > A/P Payment.
 *
 * SOURCE: built directly from Jin's own Playwright codegen recording
 * (2026-08-15) plus a full live exploration/confirmation of the same SIT
 * environment (uat/admin) — no Katalon Object Repository entry exists for
 * this screen yet. Every selector below was exercised live end-to-end
 * (Save Draft, Post, and Post & New, each followed by Cancel + a fresh
 * grid check to confirm gone) against a real vendor ("HAZEL CORP",
 * confirmed a safe reusable sandbox vendor), which was cleaned up before
 * this page object was written — zero residual test data left behind.
 *
 * SHAPE: nav (Account Payable > A/P Payment) > listing grid with its own
 * header "New" icon and DRAFT/POSTED/Cancel status filter checkboxes >
 * New opens a create form in its own iframe (same underlying
 * `cbpAPJournalEntry` control as General Ledger > Cash Book Payment — see
 * cashBookPaymentPage.js — just under an `APPaymentDtl` container prefix
 * instead of `CashBookPaymentDTL`) > header Vendor field opens a popup
 * search grid (select a row by Vendor Code, click OK) > a "Payment Info"
 * line grid, its own Insert icon > a Payment Mode column that opens a
 * popup grid (Code/Description/Type columns — NOT the plain DDD dropdown
 * list Cash Book Payment uses for the same control, though it is
 * confirmed to be the SAME underlying master list and order: AMEX(0)
 * MASTER(1) VISS(2) POINT(3) CASH(4) TRANSFER(5) CHEQUE(6) BOOST(7)
 * SHOPEE(8)) > a Payment Amount column (DXEditor7, same field-numbering
 * convention as Cash Book Payment's addPaymentLine()) > toolbar actions
 * Back(DXI0)/Post & New(DXI1)/Post(DXI2)/Save Draft(DXI4)/New(DXI10),
 * same numbering already confirmed across every other AP-Journal-Entry-
 * based screen in this app.
 *
 * CONFIRMED LIVE (2026-08-15): the Payment Mode field's value legitimately
 * DISPLAYS as "{Code} {Description}" concatenated — e.g. "CASH CASH" —
 * because every option's Code and Description happen to be identical
 * strings in this master list. This looked exactly like the known
 * duplicate-value commit bug documented in cashBookPaymentPage.js, but a
 * live Save + Document No/Status check proved it saves and posts
 * correctly; it is NOT a bug and needs no extra handling.
 *
 * CONFIRMED LIVE (2026-08-15): clicking Save Draft, Post, or Post & New
 * with the payment not applied against any outstanding invoice/debit note
 * (this flow never touches the "Knock-off Invoices/Debit Notes" grid)
 * triggers a confirmation dialog — "Payment Not Being Fully Knock Off, Are
 * You Sure You Want To Continue?" — via the SAME generic
 * `pcConfirmMessageBox_btnConfirmYes_CD` control already documented in
 * promotionPage.js. This is expected for every save-type action on this
 * screen, not a validation error; always confirm Yes.
 *
 * CONFIRMED LIVE (2026-08-15): Post & New both posts the current document
 * (opens its own "A/P Payment Document A5 Report" tab, same as Post) AND
 * leaves a fresh blank New form behind — matching its name exactly.
 *
 * CONFIRMED LIVE (2026-08-15): Document No. stays "[DEFAULT]" for a
 * DRAFT-status document — a real number (e.g. "PV-00002672") is only
 * assigned once the document is actually Posted. This is correct
 * behavior, not a stuck/failed save.
 *
 * CONFIRMED LIVE (2026-08-15): the listing grid's own "Cancel" icon/link
 * works identically for DRAFT and POSTED documents (triggers a "Cancel
 * Confirmation" dialog — "Are you sure you want to cancel this
 * document?" — confirm Yes) and is this screen's real, reliable cleanup
 * mechanism (no hard-delete option exists here) — unlike Item, the row
 * disappears from the grid immediately after confirming, no stale-render
 * gotcha observed.
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable (both the listing grid and the create/edit form resolved to
 * name "undefined" live) — always re-resolved via findFrame() by content,
 * never hardcoded.
 */
class ApPaymentPage {
  constructor(page) {
    this.page = page;
    this.listFrame = null;
    this.formFrame = null;
  }

  async goto() {
    const p = this.page;
    await p.getByRole('link', { name: 'Account Payable', exact: true }).click();
    await p.getByRole('link', { name: 'A/P Payment', exact: true }).click();
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
      await p.screenshot({ path: 'test-results/debug-ap-payment-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the frame containing the A/P Payment list "New" icon. ' +
        'Saved test-results/debug-ap-payment-list-page.png for inspection.'
      );
    }
  }

  /**
   * BUG FIXED (2026-08-15, found on the first live test run): the Vendor
   * field renders with NO accessible name bound to it (DevExpress puts
   * "Vendor:" in a separate, unassociated label cell) — a live screenshot
   * of the actual failure proved the field was present and focused the
   * whole time; `getByRole('textbox', { name: 'Vendor:' })` was simply
   * never going to match it. Fixed to check for the Vendor input's own
   * confirmed CSS id instead.
   */
  async _resolveFormFrame() {
    const p = this.page;
    this.formFrame = await findFrame(p, async (frame) => {
      const field = frame.locator('#ctl00_MainContent_APPaymentDtl_cbpAPJournalEntry_cbpAPJournalEntryDetail_ASPxRoundPanel1_formAPJEHeader_cbVendor_cbVendor_I');
      return (await field.count().catch(() => 0)) > 0 && (await field.first().isVisible().catch(() => false));
    });
    if (!this.formFrame) {
      await p.screenshot({ path: 'test-results/debug-ap-payment-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the A/P Payment create/edit form frame (Vendor field). ' +
        'Saved test-results/debug-ap-payment-form-not-found.png for inspection.'
      );
    }
  }

  /**
   * CONFIRMED live (2026-08-15): the grid header's own "New"/Insert icon
   * has a fixed CSS id (`..._gvAPPayment_header16_Add`), stable regardless
   * of which rows are currently rendered/filtered — used as the primary
   * strategy, with the accessible-name role match as a fallback, same
   * pattern as itemPage.js/customerPage.js's clickNew().
   */
  async clickNew() {
    let addIcon;
    try {
      const { locator } = await heal(this.listFrame, {
        id: 'apPayment.newIcon',
        label: 'New',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_APPaymentHdr_cpnlAPPaymentHeader_formC_gvAPPayment_header16_Add' },
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
   * Fills the header's Reference No field — the ONLY field on this screen
   * that is both fillable at creation time AND shown as its own column in
   * the listing grid regardless of Draft/Posted status (Document No. stays
   * "[DEFAULT]" for a draft, so it can't be used to find-and-cancel a
   * specific draft afterward — see cancelDocument()'s header comment).
   * Use an obviously-fake, greppable TESTING-prefixed value here, per this
   * repo's test data hygiene convention.
   *
   * CONFIRMED live (2026-08-15): the listing grid's Reference column
   * visually truncates to ~20 characters (e.g. "TESTING_AP_PAYMENT_001"
   * showed as "TESTING_AP_PAYMENT_0") — keep whatever value is passed here
   * to 20 characters or fewer, or a later search/cancel by this same value
   * won't find an exact match.
   */
  async fillReferenceNo(referenceNo) {
    const field = this.formFrame.getByRole('textbox', { name: 'Reference No:', exact: true });
    await field.click();
    await field.fill(referenceNo);
  }

  /**
   * Opens the header's Vendor popup search grid and selects a row by its
   * Vendor Code, then confirms with the popup's own OK button.
   *
   * BUG FIXED (2026-08-15, same root cause as _resolveFormFrame()): the
   * Vendor field has no accessible name, so locating its picker icon via
   * an xpath relative to a `getByRole('textbox', {name: 'Vendor:'})` match
   * could never work — that locator matches nothing. Fixed to the picker
   * icon's own confirmed CSS id directly.
   */
  async selectVendor(vendorCode) {
    const f = this.formFrame;
    const pickerIcon = f.locator('#ctl00_MainContent_APPaymentDtl_cbpAPJournalEntry_cbpAPJournalEntryDetail_ASPxRoundPanel1_formAPJEHeader_cbVendor_cbVendor_B1Img');
    await pickerIcon.click();

    const popupFrame = (await findFrame(this.page, async (frame) => {
      const cell = frame.getByRole('cell', { name: vendorCode, exact: true });
      return (await cell.count().catch(() => 0)) > 0;
    })) || f;
    await popupFrame.getByRole('cell', { name: vendorCode, exact: true }).first().click();

    // BUG FIXED (2026-08-15, live test run): `getByRole('button', {name:
    // 'OK'})` resolves to a zero-visibility `<input type="submit" ..._I">`
    // — the SAME "_CD is the real clickable element, _I is a zero-size
    // sibling" trap already documented in customerPage.js's delete-confirm
    // button. Confirmed live: the actual clickable wrapper is the "_CD"
    // sibling.
    await popupFrame.locator('[id$="_formGeneralSearchControl_btnOk_CD"]').first().click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Adds one payment line: click the "Payment Info" grid's own Insert
   * icon, pick a Payment Mode, fill the Payment Amount.
   *
   * CONFIRMED live (2026-08-15): the Payment Mode picker is a popup grid
   * (Code/Description/Type columns), not the plain DDD dropdown list Cash
   * Book Payment uses for the same underlying master list — click the
   * trigger, then click the matching option's Code cell directly.
   */
  async addPaymentLine({ mode, amount }) {
    const f = this.formFrame;
    // BUG FIXED (2026-08-15, live test run): this was originally routed
    // through heal() with a RegExp as the strategy's `options.name` — per
    // CLAUDE.md, heal()'s knowledge base is plain JSON, and
    // `JSON.stringify(/regex/)` serializes to `{}`, silently corrupting
    // the persisted strategy the first time it saved (confirmed: KB entry
    // ended up with `options: {name: {}}`, successCount 1/failureCount 5).
    // Fixed to call getByRole() directly with the regex, bypassing heal()
    // for this one lookup, exactly as CLAUDE.md prescribes. Widened
    // timeout too: a fast automated run can still be mid-postback from
    // fillReferenceNo() when this checks — manual exploration always had
    // incidental delay between steps that masked this race.
    const addIcon = f.getByRole('img', { name: /Click Here Or Press \[Insert\]/i }).first();
    await addIcon.waitFor({ state: 'visible', timeout: 15000 });
    await addIcon.click();
    await this.page.waitForTimeout(800);

    const { locator: modeTrigger } = await heal(f, {
      id: 'apPayment.paymentModeTrigger',
      label: 'Payment Mode',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_APPaymentDtl_cbpAPJournalEntry_cpnlAPPItem_formAPJEItem_PC_0_ASPxFormLayout3_gvAPPItemNew_DXEditor3_I' },
        { type: 'css', value: '[id*="gvAPPItemNew" i][id*="DXEditor3" i]' },
      ],
      timeout: 5000,
    });
    await modeTrigger.click();
    await this.page.waitForTimeout(500);

    const modeOption = f.getByRole('cell', { name: mode, exact: true }).first();
    await modeOption.waitFor({ state: 'visible', timeout: 5000 });
    await modeOption.click();
    await this.page.waitForTimeout(500);

    if (amount != null) {
      const { locator: amountInput } = await heal(f, {
        id: 'apPayment.paymentAmountInput',
        label: 'Payment Amount',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_APPaymentDtl_cbpAPJournalEntry_cpnlAPPItem_formAPJEItem_PC_0_ASPxFormLayout3_gvAPPItemNew_DXEditor7_I' },
          { type: 'css', value: '[id*="gvAPPItemNew" i][id*="DXEditor7" i]' },
        ],
        timeout: 5000,
      });
      await amountInput.click();
      await amountInput.fill(String(amount));
      await amountInput.press('Tab');
    }
  }

  /**
   * CONFIRMED live (2026-08-15): every save-type action on this screen
   * (Save Draft/Post/Post & New) triggers a "Payment Not Being Fully Knock
   * Off, Are You Sure You Want To Continue?" confirmation via the SAME
   * generic `pcConfirmMessageBox_btnConfirmYes_CD` control already
   * documented in promotionPage.js — expected here since this flow never
   * applies the payment to an outstanding invoice. Treated as OPTIONAL
   * (bounded wait, click Yes if it shows) rather than mandatory, matching
   * promotionPage.js's confirmSaveMessage() precedent.
   */
  async _confirmKnockOffMessageIfPresent() {
    const yesButton = this.formFrame.locator('#ctl00_pcConfirmMessageBox_btnConfirmYes_CD span').filter({ hasText: 'Yes' });
    const appeared = await yesButton.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
    if (!appeared) return;
    await yesButton.click();
    await yesButton.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    await this.page.waitForTimeout(1000);
  }

  async clickSaveDraft() {
    const saveButton = this.formFrame.getByRole('listitem', { name: 'Save Draft [Alt + S]' });
    await saveButton.click();
    await this._confirmKnockOffMessageIfPresent();
  }

  async clickPost() {
    const postButton = this.formFrame.getByRole('listitem', { name: 'Post [Alt + P]' });
    await postButton.click();
    await this._confirmKnockOffMessageIfPresent();
  }

  /** CONFIRMED live (2026-08-15): posts the current document AND leaves a fresh blank New form behind. */
  async clickPostAndNew() {
    const postAndNewButton = this.formFrame.getByRole('listitem', { name: 'Post & New [Alt + Ctrl + P]' });
    await postAndNewButton.click();
    await this._confirmKnockOffMessageIfPresent();
  }

  /**
   * CONFIRMED live (2026-08-15): Post and Post & New both open a NEW
   * in-app workspace tab ("A/P Payment Document A5 Report") that becomes
   * the active/frontmost one, leaving the "A/P Payment" tab's own toolbar
   * no longer interactable until switched back to. Best-effort — a no-op
   * if there's nothing to switch (e.g. after Save Draft, which never opens
   * a report tab).
   */
  async _switchBackToPaymentTab() {
    await this.page.getByRole('link', { name: 'A/P Payment', exact: true }).last()
      .click({ timeout: 3000 }).catch(() => {});
    await this.page.waitForTimeout(500);
  }

  async clickBack() {
    await this._switchBackToPaymentTab();
    const backButton = this.formFrame.getByRole('listitem', { name: 'Back [Alt + B]' });
    await backButton.click();
    await this.page.waitForTimeout(1000);
    await this._resolveListFrame();
  }

  /** New -> Vendor -> Reference No -> one CASH payment line. Stops before any save action. */
  async createPayment({ vendorCode, referenceNo, mode = 'CASH', amount }) {
    await this.clickNew();
    await this.selectVendor(vendorCode);
    await this.fillReferenceNo(referenceNo);
    await this.addPaymentLine({ mode, amount });
  }

  /**
   * CONFIRMED live (2026-08-15) as the exact success text shown after
   * Save Draft — falls back to a fresh page-wide frame scan in case the
   * cached `this.formFrame` reference goes stale across the postback
   * (same lesson already fixed in itemPage.js's isSaveSuccessful()).
   */
  async isSaveSuccessful() {
    if (this.formFrame) {
      const text = this.formFrame.getByText('Saved Successfully');
      if ((await text.count().catch(() => 0)) > 0 && (await text.first().isVisible().catch(() => false))) {
        return true;
      }
    }
    const frame = await findFrame(this.page, async (f) => {
      const text = f.getByText('Saved Successfully');
      return (await text.count().catch(() => 0)) > 0 && (await text.first().isVisible().catch(() => false));
    }, { timeout: 5000 });
    return !!frame;
  }

  /**
   * CONFIRMED live (2026-08-15): Document No. stays "[DEFAULT]" for a
   * DRAFT document — a real number is only assigned once Posted. Reads
   * the field directly rather than checking for a banner, since Post/
   * Post & New's own confirmation banner text was not independently
   * re-verified the way Save Draft's was.
   */
  async getDocumentNo() {
    const field = this.formFrame.getByRole('textbox', { name: 'Document No.:', exact: true });
    return (await field.inputValue().catch(() => null)) || (await field.textContent().catch(() => null));
  }

  async getStatus() {
    const field = this.formFrame.getByRole('textbox', { name: 'Status:', exact: true });
    return (await field.inputValue().catch(() => null)) || (await field.textContent().catch(() => null));
  }

  /**
   * Waits for a genuine GRID DATA ROW matching the given Reference No —
   * requires the row to also carry its own "APPaymentDetailPage"/"Cancel"
   * action links, ruling out any non-data-row false positive, same
   * principle as itemPage.js/customerPage.js. Reference No is used here
   * (not Document No.) because it's the one identifier that's both
   * fillable at creation and reliably unique regardless of Draft/Posted
   * status — see cancelDocument()'s header comment.
   */
  async _waitForRowMatchingReference(referenceNo, timeout = 15000) {
    const escaped = referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dataRowPattern = new RegExp(`^APPaymentDetailPage\\s+Cancel\\b.*\\b${escaped}\\b`, 'i');
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
   * CONFIRMED live (2026-08-15) as this screen's real cleanup mechanism —
   * no hard-delete exists here. Works identically for DRAFT and POSTED
   * documents: click the row's own "Cancel" icon/link, confirm the
   * "Cancel Confirmation" dialog ("Are you sure you want to cancel this
   * document?"). Scoped to this.listFrame, never page-wide, per this
   * repo's real incident history around delete/cancel confirm dialogs.
   *
   * Searches by Reference No, NOT Document No. — a DRAFT document's
   * Document No. stays "[DEFAULT]" (only a POSTED document gets a real,
   * unique number), so Document No. can't disambiguate one draft from
   * another the way it can for a posted document. Reference No (filled at
   * creation via fillReferenceNo()) is reliably unique in both cases.
   */
  async cancelDocument(referenceNo) {
    await this._resolveListFrame();
    const matched = await this._waitForRowMatchingReference(referenceNo);
    if (!matched) {
      await this.page.screenshot({
        path: `test-results/debug-ap-payment-cancel-not-found-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `A/P Payment grid never showed a row matching Reference No. "${referenceNo}" — ` +
        'refusing to proceed with Cancel against a possibly-stale/unfiltered row.'
      );
    }
    const row = this.listFrame.getByRole('row', {
      name: new RegExp(`^APPaymentDetailPage\\s+Cancel\\b.*\\b${referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
    }).first();
    await row.getByRole('link', { name: 'Cancel', exact: true }).click();

    // BUG FIXED (2026-08-15, live test run, three times): assumed this
    // dialog reused the app-wide `pcConfirmDel` control (Customer/Item/
    // Promotion's delete-confirm) purely by ID-naming-pattern analogy —
    // WRONG. Confirmed live via direct DOM inspection (`el.id`) that this
    // "Cancel Confirmation" dialog is a DIFFERENT, dedicated control:
    // `pcConfirmCancel`, with button id `btnYesCancel_CD` (not
    // `btnYes_CD`). Every previous attempt targeting `pcConfirmDel` was
    // therefore searching for an element that doesn't exist for this
    // dialog at all. This `_CD` element IS directly clickable here (a
    // `<div class="dxb dxbf">`, no nested span needed).
    const { locator: yesButton } = await heal(this.listFrame, {
      id: 'apPayment.cancelConfirmYesButton',
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

  /** CONFIRMED live (2026-08-15): the exact success text shown after confirming Cancel. */
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

module.exports = { ApPaymentPage };
