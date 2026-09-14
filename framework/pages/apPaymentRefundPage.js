const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Account Payable (transactional module) > A/P Payment
 * Refund.
 *
 * SOURCE: NO Katalon Object Repository entry or Playwright codegen
 * recording available for this screen — built by close analogy to TWO
 * confirmed-working precedents: apPaymentPage.js (same AP-side Vendor
 * field pattern, same Payment Mode/Amount line shape including the
 * `ASPxFormLayout3` grid-wrapper segment) and arPaymentRefundPage.js
 * (confirms Refund screens use a `*RefundDtl`/`*RefundHdr`/`cbp*Refund`
 * container naming, distinct from Payment's own `*PaymentDtl`/
 * `cbp*Payment` naming, and confirms the Refund-specific "Not Being Fully
 * Knock Off" dialog wording/answer). Every CSS id below is a GUESS —
 * UNCONFIRMED until this file's first live headed run. Expect this to
 * need fixing exactly like apInvoicePage.js did (that screen's real form
 * diverged from its own closest analogy in several ways) — verify against
 * a real screenshot/DOM inspection before trusting anything here blindly,
 * per CONTRIBUTING.md.
 *
 * SHAPE (assumed, mirroring A/P Payment structurally + A/R Payment
 * Refund's naming convention): nav (Account Payable > A/P Payment Refund)
 * > listing grid with its own header "New" icon > New opens a create form
 * > header Vendor field opens a popup search grid (select a row by Vendor
 * Code, click OK) > a Payment/Refund Info line grid, its own Insert icon >
 * a Payment Mode column that opens a popup grid (Code/Description/Type
 * columns, same master list as A/P Payment: CASH/TRANSFER/CHEQUE/etc.) >
 * a Payment Amount column > toolbar actions Back(DXI0)/Post & New(DXI1)/
 * Post(DXI2)/Save Draft(DXI4)/New(DXI10), same numbering confirmed across
 * every AP/AR-Journal-Entry-based screen in this app.
 *
 * ASSUMED (mirroring A/R Payment Refund's own CONFIRMED behavior,
 * moderately high confidence since Refund's dialog wording was
 * independently confirmed to differ from Invoice's): Save Draft/Post/
 * Post & New trigger a "Refund Not Being Fully Knock Off, Are You Sure
 * You Want To Continue?"-style confirmation via the SAME
 * `pcConfirmMessageBox_btnConfirmYes_CD` control already confirmed for
 * A/P Payment/A/R Payment/A/R Payment Refund — answer Yes.
 *
 * ASSUMED: the listing grid's own "Cancel" icon/link is this screen's real
 * cleanup mechanism (no hard-delete), working for both DRAFT and POSTED
 * documents via the same app-wide `pcConfirmCancel`/`btnYesCancel_CD`
 * dialog already confirmed for A/P Payment/A/P Invoice.
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable — always re-resolved via findFrame() by content, never
 * hardcoded.
 */
class ApPaymentRefundPage {
  constructor(page) {
    this.page = page;
    this.listFrame = null;
    this.formFrame = null;
  }

  async goto() {
    const p = this.page;
    await p.getByRole('link', { name: 'Account Payable', exact: true }).click();
    await p.getByRole('link', { name: 'A/P Payment Refund', exact: true }).click();
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
      await p.screenshot({ path: 'test-results/debug-ap-payment-refund-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the frame containing the A/P Payment Refund list "New" icon. ' +
        'Saved test-results/debug-ap-payment-refund-list-page.png for inspection.'
      );
    }
  }

  /** UNCONFIRMED CSS id — Vendor field pattern reused verbatim from apPaymentPage.js/apInvoicePage.js's own twice-confirmed naming, under a guessed "APRefundDtl" container (AR->AP substitution of arPaymentRefundPage.js's own confirmed "ARRefundDtl"). */
  async _resolveFormFrame() {
    const p = this.page;
    this.formFrame = await findFrame(p, async (frame) => {
      const field = frame.locator('#ctl00_MainContent_APRefundDtl_cbpAPRefund_cbpAPRefundDetail_ASPxRoundPanel1_formAPJEHeader_cbVendor_cbVendor_I');
      return (await field.count().catch(() => 0)) > 0 && (await field.first().isVisible().catch(() => false));
    });
    if (!this.formFrame) {
      await p.screenshot({ path: 'test-results/debug-ap-payment-refund-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the A/P Payment Refund create/edit form frame (Vendor field). ' +
        'Saved test-results/debug-ap-payment-refund-form-not-found.png for inspection.'
      );
    }
  }

  /** UNCONFIRMED CSS id — falls back to the generic "New"/Insert icon role match. */
  async clickNew() {
    let addIcon;
    try {
      const { locator } = await heal(this.listFrame, {
        id: 'apPaymentRefund.newIcon',
        label: 'New',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_APRefundHdr_cpnlAPRefundHeader_formC_gvAPRefund_header17_Add' },
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

  /** Fills the header's Reference No field. Keep to 20 characters or fewer (confirmed display truncation app-wide). */
  async fillReferenceNo(referenceNo) {
    const field = this.formFrame.getByRole('textbox', { name: 'Reference No:', exact: true });
    await field.click();
    await field.fill(referenceNo);
  }

  /** Opens the header's Vendor popup search grid and selects a row by its Vendor Code — trigger icon id reuses apPaymentPage.js's/apInvoicePage.js's own CONFIRMED Vendor picker pattern. */
  async selectVendor(vendorCode) {
    const f = this.formFrame;
    const pickerIcon = f.locator('#ctl00_MainContent_APRefundDtl_cbpAPRefund_cbpAPRefundDetail_ASPxRoundPanel1_formAPJEHeader_cbVendor_cbVendor_B1Img');
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
   * Adds one refund line: click the line grid's own Insert icon, pick a
   * Payment Mode, fill the Payment Amount — UNCONFIRMED CSS ids, reusing
   * apPaymentPage.js's own confirmed field-numbering (DXEditor3/DXEditor7)
   * and grid-wrapper shape (`ASPxFormLayout3`).
   */
  async addRefundLine({ mode, amount }) {
    const f = this.formFrame;
    const addIcon = f.getByRole('img', { name: /Click Here Or Press \[Insert\]/i }).first();
    await addIcon.waitFor({ state: 'visible', timeout: 15000 });
    await addIcon.click();
    await this.page.waitForTimeout(800);

    // CONFIRMED live (2026-08-27): the line-item grid's real id is
    // `gvAPRItemNew` ("APR" = A/P Refund), NOT `gvAPPItemNew` as
    // apPaymentPage.js's own A/P Payment pattern would suggest by direct
    // analogy — and there is NO `ASPxFormLayout3` wrapper segment either
    // (that's specific to A/P Payment's own DOM shape). This grid also has
    // many more columns than A/P Payment's simple 2-field line (Payment
    // Mode/Cheque No./Payment Amount/Bank Charge/Bank Charge Tax Code/
    // Bank Charge Tax Amount/Remarks/Status/Currency/Currency Rate,
    // confirmed via a live screenshot) — but DXEditor numbering does NOT
    // follow visual column order 1:1 here (confirmed by typing distinct
    // values into each candidate and screenshotting which landed where);
    // Payment Amount is genuinely DXEditor7, matching the original
    // AR-Refund-analogy guess, not the DXEditor5 a naive column-position
    // count would suggest.
    const { locator: modeTrigger } = await heal(f, {
      id: 'apPaymentRefund.paymentModeTrigger',
      label: 'Payment Mode',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_APRefundDtl_cbpAPRefund_cpnlAPPItem_formAPJEItem_PC_0_gvAPRItemNew_DXEditor3_I' },
        { type: 'css', value: '[id*="gvAPRItemNew" i][id*="DXEditor3" i][id$="_I"]' },
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
        id: 'apPaymentRefund.paymentAmountInput',
        label: 'Payment Amount',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_APRefundDtl_cbpAPRefund_cpnlAPPItem_formAPJEItem_PC_0_gvAPRItemNew_DXEditor7_I' },
          { type: 'css', value: '[id*="gvAPRItemNew" i][id*="DXEditor7" i]' },
        ],
        timeout: 5000,
      });
      await amountInput.click();
      await amountInput.fill(String(amount));
      await amountInput.press('Tab');
      await this.page.waitForTimeout(500);

      const committedValue = await amountInput.inputValue().catch(() => '');
      if (Number(committedValue) !== Number(amount)) {
        await this.page.screenshot({ path: 'test-results/debug-ap-payment-refund-amount-not-committed.png', fullPage: true }).catch(() => {});
        throw new Error(
          `A/P Payment Refund line Amount shows "${committedValue}", expected ${amount} — ` +
          'saved test-results/debug-ap-payment-refund-amount-not-committed.png for inspection.'
        );
      }
    }
  }

  /** ASSUMED (mirroring A/R Payment Refund's own confirmed dialog) — answer Yes. */
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

  async clickPostAndNew() {
    const postAndNewButton = this.formFrame.getByRole('listitem', { name: 'Post & New [Alt + Ctrl + P]' });
    await postAndNewButton.click();
    await this._confirmKnockOffMessageIfPresent();
  }

  /** Same report-tab-switch pattern already confirmed across every module in this app — best-effort, no-op if there's nothing to switch. */
  async _switchBackToRefundTab() {
    await this.page.getByRole('link', { name: 'A/P Payment Refund', exact: true }).last()
      .click({ timeout: 3000 }).catch(() => {});
    await this.page.waitForTimeout(500);
  }

  async clickBack() {
    await this._switchBackToRefundTab();
    const backButton = this.formFrame.getByRole('listitem', { name: 'Back [Alt + B]' });
    await backButton.click();
    await this.page.waitForTimeout(1000);
    await this._resolveListFrame();
  }

  /** New -> Vendor -> Reference No -> one refund line. Stops before any save action. */
  async createRefund({ vendorCode, referenceNo, mode = 'CASH', amount }) {
    await this.clickNew();
    await this.selectVendor(vendorCode);
    await this.fillReferenceNo(referenceNo);
    await this.addRefundLine({ mode, amount });
  }

  /**
   * ASSUMED (mirroring A/P Payment): the exact success text shown after
   * Save Draft — falls back to a fresh page-wide frame scan in case the
   * cached `this.formFrame` reference goes stale across the postback.
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

  /** Waits for a genuine GRID DATA ROW matching the given Reference No. Row-name prefix "APRefundDetailPage" is a guess (AR->AP substitution of arPaymentRefundPage.js's own confirmed "ARRefundDetailPage") — verify live. */
  async _waitForRowMatchingReference(referenceNo, timeout = 15000) {
    const escaped = referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dataRowPattern = new RegExp(`^APRefundDetailPage\\s+Cancel\\b.*\\b${escaped}\\b`, 'i');
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

  /** ASSUMED as this screen's real cleanup mechanism — no hard-delete. Scoped to this.listFrame, never page-wide. */
  async cancelDocument(referenceNo) {
    await this._resolveListFrame();
    const matched = await this._waitForRowMatchingReference(referenceNo);
    if (!matched) {
      await this.page.screenshot({
        path: `test-results/debug-ap-payment-refund-cancel-not-found-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `A/P Payment Refund grid never showed a row matching Reference No. "${referenceNo}" — ` +
        'refusing to proceed with Cancel against a possibly-stale/unfiltered row.'
      );
    }
    const row = this.listFrame.getByRole('row', {
      name: new RegExp(`^APRefundDetailPage\\s+Cancel\\b.*\\b${referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
    }).first();
    await row.getByRole('link', { name: 'Cancel', exact: true }).click();

    const { locator: yesButton } = await heal(this.listFrame, {
      id: 'apPaymentRefund.cancelConfirmYesButton',
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

module.exports = { ApPaymentRefundPage };
