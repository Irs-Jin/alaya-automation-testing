const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Account Receivable (transactional module) > A/R Payment.
 *
 * SOURCE: built directly from Jin's own Playwright codegen recording
 * (2026-08-15) plus a full live exploration/confirmation of the same SIT
 * environment (uat/admin) — no Katalon Object Repository entry exists for
 * this screen yet. Every selector below was exercised live end-to-end
 * (Save Draft, Post, and Post & New, each followed by Cancel + a fresh
 * grid check to confirm gone) against a real customer ("YEONG", code
 * 000001, already confirmed a safe reusable sandbox customer in
 * arInvoicePage.js's work), which was cleaned up before this page object
 * was written — zero residual test data left behind.
 *
 * SHAPE: this screen is the receivable-side mirror of A/P Payment — same
 * underlying `cbpARPayment`/`mARPaymentDetailsToolBar` control shape as
 * A/P Payment's `cbpAPJournalEntry`/`mAPPaymentDetailsToolBar` (see
 * apPaymentPage.js), just `ARPaymentDtl` instead of `APPaymentDtl` and
 * Customer instead of Vendor. Same DXI0/1/2/4/10 toolbar numbering, same
 * Payment Mode popup grid (Code/Description/Type columns, same master
 * list and order — AMEX(0) MASTER(1) VISA(2) POINT(3) CASH(4) TRANSFER(5)
 * CHEQUE(6) BOOST(7) SHOPEE(8)), same "Payment Not Being Fully Knock Off"
 * confirmation via `pcConfirmMessageBox_btnConfirmYes_CD` (CONFIRMED here
 * the correct answer is Yes, unlike A/R Invoice's differently-worded
 * "un-knock off" dialog where the correct answer is No — these are
 * DIFFERENT dialogs with different correct answers despite similar
 * wording; don't conflate the two), and the same
 * `pcConfirmCancel_btnYesCancel_CD` Cancel Confirmation control.
 *
 * CONFIRMED LIVE (2026-08-15): the Customer field has no accessible name
 * bound to it — same trap already documented in apPaymentPage.js's Vendor
 * field and arInvoicePage.js's Customer field. Selectors target the
 * confirmed CSS id directly.
 *
 * CONFIRMED LIVE (2026-08-15): the payment line's "Total Paid Amount"
 * summary field at the bottom of the form does NOT reliably update
 * immediately after filling Amount (still showed "0.00" after a
 * confirmed-committed fill) — verify commit via the payment line ROW's
 * own text instead (it shows the real value immediately), not that
 * summary field.
 *
 * CONFIRMED LIVE (2026-08-15): Post and Post & New both open a NEW in-app
 * workspace tab ("A/R Payment Document Report"), same pattern as A/P
 * Payment — requires switching back to the "A/R Payment" tab before the
 * form's own toolbar (Back, etc.) is interactable again.
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable — always re-resolved via findFrame() by content, never
 * hardcoded.
 */
class ArPaymentPage {
  constructor(page) {
    this.page = page;
    this.listFrame = null;
    this.formFrame = null;
  }

  async goto() {
    const p = this.page;
    await p.getByRole('link', { name: 'Account Receivable', exact: true }).click();
    await p.getByRole('link', { name: 'A/R Payment', exact: true }).click();
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
      await p.screenshot({ path: 'test-results/debug-ar-payment-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the frame containing the A/R Payment list "New" icon. ' +
        'Saved test-results/debug-ar-payment-list-page.png for inspection.'
      );
    }
  }

  /** CONFIRMED live (2026-08-15): the Customer field has no accessible name — check its confirmed CSS id directly. */
  async _resolveFormFrame() {
    const p = this.page;
    this.formFrame = await findFrame(p, async (frame) => {
      const field = frame.locator('#ctl00_MainContent_ARPaymentDtl_cbpARPayment_cbpARPaymentDetail_ASPxRoundPanel1_formARPaymentHeader_cbCustomer_cbSelectCust_I');
      return (await field.count().catch(() => 0)) > 0 && (await field.first().isVisible().catch(() => false));
    });
    if (!this.formFrame) {
      await p.screenshot({ path: 'test-results/debug-ar-payment-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the A/R Payment create/edit form frame (Customer field). ' +
        'Saved test-results/debug-ar-payment-form-not-found.png for inspection.'
      );
    }
  }

  /** CONFIRMED live (2026-08-15): the grid header's own "New"/Insert icon's confirmed CSS id, primary; role match as fallback. */
  async clickNew() {
    let addIcon;
    try {
      const { locator } = await heal(this.listFrame, {
        id: 'arPayment.newIcon',
        label: 'New',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_ARPaymentHdr_cpnlARPaymentHeader_formC_gvARPayment_header17_Add' },
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
    const pickerIcon = f.locator('#ctl00_MainContent_ARPaymentDtl_cbpARPayment_cbpARPaymentDetail_ASPxRoundPanel1_formARPaymentHeader_cbCustomer_cbSelectCust_B1Img');
    await pickerIcon.click();

    const popupFrame = (await findFrame(this.page, async (frame) => {
      const cell = frame.getByRole('cell', { name: customerCode, exact: true });
      return (await cell.count().catch(() => 0)) > 0;
    })) || f;
    await popupFrame.getByRole('cell', { name: customerCode, exact: true }).first().click();

    // Same "_CD is the real clickable element" pattern already confirmed
    // for A/P Payment's/A/R Invoice's OK button (a zero-visibility `_I`
    // sibling exists alongside it) — target `_CD` directly.
    await popupFrame.locator('[id$="_formGeneralSearchControl_btnOk_CD"]').first().click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Adds one payment line: click the payment grid's own Insert icon, pick
   * a Payment Mode, fill the Payment Amount.
   *
   * CONFIRMED live (2026-08-15): the Payment Mode picker is a popup grid
   * (Code/Description/Type columns) — click the trigger, then click the
   * matching option's Code cell directly. Same "CODE DESCRIPTION"
   * concatenated display (e.g. "CASH CASH") already confirmed NOT a bug
   * in apPaymentPage.js.
   */
  async addPaymentLine({ mode, amount }) {
    const f = this.formFrame;
    const addIcon = f.getByRole('img', { name: /Click Here Or Press \[Insert\]/i }).first();
    await addIcon.waitFor({ state: 'visible', timeout: 15000 });
    await addIcon.click();
    await this.page.waitForTimeout(800);

    const { locator: modeTrigger } = await heal(f, {
      id: 'arPayment.paymentModeTrigger',
      label: 'Payment Mode',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_ARPaymentDtl_cbpARPayment_cpnlARPaymentItem_formARPaymentItem_PC_0_ASPxFormLayout3_gvARItemNew_DXEditor3_B-1Img' },
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
      const amountInput = f.locator('#ctl00_MainContent_ARPaymentDtl_cbpARPayment_cpnlARPaymentItem_formARPaymentItem_PC_0_ASPxFormLayout3_gvARItemNew_DXEditor7_I');
      await amountInput.click();
      await amountInput.fill(String(amount));
      await amountInput.press('Tab');
      await this.page.waitForTimeout(500);

      // BUG FIXED (2026-08-15, live test run): verifying commit by
      // scanning a sibling cell's text (e.g. the "CASH CASH" Payment Mode
      // display) for the amount string was wrong — Amount lives in its
      // own separate cell, not nested under Payment Mode's text, so that
      // check could never pass. Read the Amount input's own value
      // directly instead — reliable and confirmed live: the row's amount
      // is genuinely committed once .fill()+Tab has run.
      const committedValue = await amountInput.inputValue().catch(() => '');
      if (Number(committedValue) !== Number(amount)) {
        await this.page.screenshot({ path: 'test-results/debug-ar-payment-amount-not-committed.png', fullPage: true }).catch(() => {});
        throw new Error(
          `A/R Payment line Amount shows "${committedValue}", expected ${amount} — ` +
          'saved test-results/debug-ar-payment-amount-not-committed.png for inspection.'
        );
      }
    }
  }

  /**
   * CONFIRMED live (2026-08-15): every save-type action on this screen
   * (Save Draft/Post/Post & New) triggers a "Payment Not Being Fully Knock
   * Off, Are You Sure You Want To Continue?" confirmation via the SAME
   * generic `pcConfirmMessageBox_btnConfirmYes_CD` control already
   * confirmed for A/P Payment (and reused, DIFFERENTLY worded and with a
   * different correct answer, by A/R Invoice — do not conflate). The
   * correct answer here is Yes, matching Jin's own recording.
   */
  async _confirmKnockOffMessageIfPresent() {
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
   * CONFIRMED live (2026-08-15), same pattern as apPaymentPage.js's
   * _switchBackToPaymentTab(): Post and Post & New both open a NEW in-app
   * workspace tab ("A/R Payment Document Report") that becomes the
   * active/frontmost one, leaving the "A/R Payment" tab's own toolbar no
   * longer interactable until switched back to. Best-effort — a no-op if
   * there's nothing to switch (e.g. after Save Draft, which never opens a
   * report tab).
   */
  async _switchBackToPaymentTab() {
    await this.page.getByRole('link', { name: 'A/R Payment', exact: true }).last()
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

  /** New -> Customer -> Reference No -> one payment line. Stops before any save action. */
  async createPayment({ customerCode, referenceNo, mode = 'CASH', amount }) {
    await this.clickNew();
    await this.selectCustomer(customerCode);
    await this.fillReferenceNo(referenceNo);
    await this.addPaymentLine({ mode, amount });
  }

  /**
   * CONFIRMED live (2026-08-15) as the exact success text shown after
   * Save Draft — falls back to a fresh page-wide frame scan in case the
   * cached `this.formFrame` reference goes stale across the postback
   * (same lesson already fixed in itemPage.js/apPaymentPage.js).
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
    const dataRowPattern = new RegExp(`^ARPaymentDetailPage\\s+Cancel\\b.*\\b${escaped}\\b`, 'i');
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
   * "Cancel Confirmation" dialog via the SAME `pcConfirmCancel_btnYesCancel_CD`
   * control already confirmed for A/P Payment and A/R Invoice. Scoped to
   * this.listFrame, never page-wide.
   */
  async cancelDocument(referenceNo) {
    await this._resolveListFrame();
    const matched = await this._waitForRowMatchingReference(referenceNo);
    if (!matched) {
      await this.page.screenshot({
        path: `test-results/debug-ar-payment-cancel-not-found-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `A/R Payment grid never showed a row matching Reference No. "${referenceNo}" — ` +
        'refusing to proceed with Cancel against a possibly-stale/unfiltered row.'
      );
    }
    const row = this.listFrame.getByRole('row', {
      name: new RegExp(`^ARPaymentDetailPage\\s+Cancel\\b.*\\b${referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
    }).first();
    await row.getByRole('link', { name: 'Cancel', exact: true }).click();

    const { locator: yesButton } = await heal(this.listFrame, {
      id: 'arPayment.cancelConfirmYesButton',
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

module.exports = { ArPaymentPage };
