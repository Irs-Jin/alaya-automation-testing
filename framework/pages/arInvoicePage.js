const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Account Receivable (transactional module) > A/R Invoice.
 *
 * SOURCE: built directly from Jin's own Playwright codegen recording
 * (2026-08-15) plus a full live exploration/confirmation of the same SIT
 * environment (uat/admin) — no Katalon Object Repository entry exists for
 * this screen yet. Every selector below was exercised live end-to-end
 * (Save Draft, Post, and Post & New, each followed by Cancel + a fresh
 * grid check to confirm gone) against a real customer ("YEONG", code
 * 000001), which was cleaned up before this page object was written —
 * zero residual test data left behind.
 *
 * SHAPE: nav (Account Receivable > A/R Invoice) > listing grid with its
 * own header "New" icon > New opens a create form in its own iframe (same
 * underlying `cbpARJournalEntry`/`mARJEDetailsToolBar` control shape as
 * A/P Payment's `cbpAPJournalEntry` — see apPaymentPage.js — same DXI0/1/
 * 2/4/10 toolbar numbering) > header Customer field opens a popup search
 * grid (select a row by Customer Code, click OK) > an "Items" line grid,
 * its own Insert icon > an Account No. column that opens a popup grid
 * (Code/Description columns, e.g. "GST-3010"/"INPUT TAX ACCOUNT" as the
 * first option — CONFIRMED live this is genuinely the Account No. list,
 * not a Tax Code list, despite the GST-prefixed codes) > an Amount column
 * > toolbar actions Back(DXI0)/Post & New(DXI1)/Post(DXI2)/Save
 * Draft(DXI4)/New(DXI10).
 *
 * CONFIRMED LIVE (2026-08-15): the Customer field has no accessible name
 * bound to it (DevExpress puts "Customer:" in a separate, unassociated
 * label cell) — same trap already documented in apPaymentPage.js for its
 * Vendor field. Selectors below target the confirmed CSS ids directly,
 * never `getByRole('textbox', {name: 'Customer:'})`.
 *
 * CONFIRMED LIVE (2026-08-15): Save Draft succeeds with ONLY Customer +
 * one Account No. line + Amount filled — no confirmation dialog, no
 * banner even (unlike A/P Payment's Save Draft, which does show one).
 * Success must be verified via the listing grid, not an in-form message.
 *
 * CONFIRMED LIVE (2026-08-15): Post and Post & New additionally require
 * the Amount to be genuinely committed — attempting to Post with an only
 * apparently-filled-but-uncommitted Amount produces a real, actionable
 * error dialog ("Error Encountered" / "Please fill in grid's mandatory
 * field before save."), NOT a silent failure. If this happens, click OK
 * to dismiss, click the flagged cell to re-enter edit mode, and refill —
 * confirmed live this recovers cleanly and the retry succeeds.
 *
 * CONFIRMED LIVE (2026-08-15): Post and Post & New both trigger a
 * confirmation — "You have un-knock off payment, knock off now?" — via
 * the SAME generic `pcConfirmMessageBox_btnConfirmYes_CD`-family control
 * already documented in promotionPage.js/apPaymentPage.js. UNLIKE A/P
 * Payment's equivalent dialog (where the correct answer is Yes, to
 * proceed with the save), this one's correct answer for a plain
 * happy-path test is **No** — clicking Yes would additionally try to
 * apply/knock-off the invoice against an outstanding payment, which is
 * out of scope here. This dialog can render with a delay after the
 * click — poll for it rather than assuming its absence means it won't
 * appear (confirmed live: it showed up only on a later snapshot once).
 *
 * CONFIRMED LIVE (2026-08-15): Post & New posts the current document
 * (opens its own "A/R Invoice Document Report" tab, same pattern as A/P
 * Payment) AND leaves a fresh blank New form behind — matching its name.
 * A stale-page check right after answering the knock-off dialog can look
 * like nothing happened (still showing the OLD document's data); a fresh
 * re-snapshot confirms the new blank form. Don't trust the immediately-
 * following read.
 *
 * CONFIRMED LIVE (2026-08-15): the listing grid's own "Cancel" icon/link
 * — the SAME app-wide `pcConfirmCancel`/`btnYesCancel_CD` dialog already
 * confirmed for A/P Payment — works identically for DRAFT and POSTED
 * A/R Invoices and is this screen's real cleanup mechanism.
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable — always re-resolved via findFrame() by content, never
 * hardcoded.
 */
class ArInvoicePage {
  constructor(page) {
    this.page = page;
    this.listFrame = null;
    this.formFrame = null;
  }

  async goto() {
    const p = this.page;
    await p.getByRole('link', { name: 'Account Receivable', exact: true }).click();
    await p.getByRole('link', { name: 'A/R Invoice', exact: true }).click();
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
      await p.screenshot({ path: 'test-results/debug-ar-invoice-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the frame containing the A/R Invoice list "New" icon. ' +
        'Saved test-results/debug-ar-invoice-list-page.png for inspection.'
      );
    }
  }

  /**
   * BUG-PATTERN AVOIDED (2026-08-15, learned from apPaymentPage.js's
   * first-run failure): the Customer field has no accessible name, so
   * `_resolveFormFrame()` checks for its confirmed CSS id directly rather
   * than a `getByRole('textbox', {name: 'Customer:'})` match that would
   * never succeed.
   */
  async _resolveFormFrame() {
    const p = this.page;
    this.formFrame = await findFrame(p, async (frame) => {
      const field = frame.locator('#ctl00_MainContent_ARJournalEntryDTL_cbpARJournalEntry_cbpARJournalEntryDetail_ASPxRoundPanel1_formARJEHeader_cbCustomer_cbSelectCust_I');
      return (await field.count().catch(() => 0)) > 0 && (await field.first().isVisible().catch(() => false));
    });
    if (!this.formFrame) {
      await p.screenshot({ path: 'test-results/debug-ar-invoice-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the A/R Invoice create/edit form frame (Customer field). ' +
        'Saved test-results/debug-ar-invoice-form-not-found.png for inspection.'
      );
    }
  }

  /**
   * CONFIRMED live (2026-08-15): the grid header's own "New"/Insert icon —
   * its own id is misleadingly named `btnCheckAll` (a shared internal
   * control template id that doesn't reflect its actual function here),
   * kept as primary since it's still stable regardless of the name; role
   * match as fallback.
   */
  async clickNew() {
    let addIcon;
    try {
      const { locator } = await heal(this.listFrame, {
        id: 'arInvoice.newIcon',
        label: 'New',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_ARJournalEntryHDR_cpnlARJEHeader_formC_gvARJournalEntry_header17_btnCheckAll' },
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

  /** Fills the header's Reference No field — see fillReferenceNo() in apPaymentPage.js for why this (not Document No.) is used to find-and-cancel a specific document later. */
  async fillReferenceNo(referenceNo) {
    const field = this.formFrame.getByRole('textbox', { name: 'Reference No:', exact: true });
    await field.click();
    await field.fill(referenceNo);
  }

  /** Opens the header's Customer popup search grid and selects a row by its Customer Code, then confirms with the popup's own OK button. */
  async selectCustomer(customerCode) {
    const f = this.formFrame;
    const pickerIcon = f.locator('#ctl00_MainContent_ARJournalEntryDTL_cbpARJournalEntry_cbpARJournalEntryDetail_ASPxRoundPanel1_formARJEHeader_cbCustomer_cbSelectCust_B1Img');
    await pickerIcon.click();

    const popupFrame = (await findFrame(this.page, async (frame) => {
      const cell = frame.getByRole('cell', { name: customerCode, exact: true });
      return (await cell.count().catch(() => 0)) > 0;
    })) || f;
    await popupFrame.getByRole('cell', { name: customerCode, exact: true }).first().click();

    // Same "_CD is the real clickable element" pattern already confirmed
    // for A/P Payment's Vendor OK button (a zero-visibility `_I` sibling
    // exists alongside it) — target `_CD` directly.
    await popupFrame.locator('[id$="_formGeneralSearchControl_btnOk_CD"]').first().click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Adds one invoice line: click the "Items" grid's own Insert icon, pick
   * an Account No., fill the Amount.
   *
   * CONFIRMED live (2026-08-15): the Account No. picker is a popup grid
   * (Code/Description columns) — click the trigger, then click the
   * matching option's Code cell directly. Amount commit is CONFIRMED
   * flaky at least once live (a fill+Tab that silently didn't register,
   * only caught by Post's own mandatory-field validation) — verify via
   * the row's Total, retry once if it didn't stick, matching the
   * "give DevExpress a beat, verify, don't just trust the fill" lesson
   * from cashBookPaymentPage.js.
   */
  async addInvoiceLine({ accountCode, amount }) {
    const f = this.formFrame;
    const addIcon = f.getByRole('img', { name: /Click Here Or Press \[Insert\]/i }).first();
    await addIcon.waitFor({ state: 'visible', timeout: 15000 });
    await addIcon.click();
    await this.page.waitForTimeout(800);

    // BUG FIXED (2026-08-15, live test run): a loose `[id*="DXEditor3"]`
    // substring match also matches this field's LOADING-PANEL sibling
    // element (id suffix `_DXEditor3_LP`), which is attached but never
    // visible — heal() picked it, `.click()` timed out forever. Use the
    // confirmed exact id from Jin's own recording (`_B-1`) instead of a
    // wildcard.
    const { locator: accountTrigger } = await heal(f, {
      id: 'arInvoice.accountNoTrigger',
      label: 'Account No.',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_ARJournalEntryDTL_cbpARJournalEntry_cpnlARJEItem_formARJEItem_PC_0_gvARJEItem_DXEditor3_B-1' },
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
    const amountInput = f.locator('#ctl00_MainContent_ARJournalEntryDTL_cbpARJournalEntry_cpnlARJEItem_formARJEItem_PC_0_gvARJEItem_DXEditor13_I');
    await amountInput.click();
    await amountInput.fill(String(amount));
    await amountInput.press('Tab');
    await this.page.waitForTimeout(500);

    if (await this._isAmountCommitted(amount)) return;

    // BUG FIXED (2026-08-15, live test run): the fill above can silently
    // fail to commit — DevExpress swaps the cell to a read-only
    // "Amount Required" validation-icon state instead of keeping it an
    // editable textbox. Click that flagged cell to re-enter edit mode,
    // then retry once.
    const requiredIcon = f.getByRole('img', { name: 'Amount Required' }).first();
    if (await requiredIcon.count().catch(() => 0) > 0) {
      await requiredIcon.click();
      await this.page.waitForTimeout(300);
    }
    const retryInput = f.locator('#ctl00_MainContent_ARJournalEntryDTL_cbpARJournalEntry_cpnlARJEItem_formARJEItem_PC_0_gvARJEItem_DXEditor13_I');
    await retryInput.click();
    await retryInput.fill(String(amount));
    await retryInput.press('Tab');
    await this.page.waitForTimeout(500);

    if (!(await this._isAmountCommitted(amount))) {
      await this.page.screenshot({ path: 'test-results/debug-ar-invoice-amount-not-committed.png', fullPage: true }).catch(() => {});
      throw new Error(
        `A/R Invoice line Amount never committed to ${amount} after two attempts — ` +
        'saved test-results/debug-ar-invoice-amount-not-committed.png for inspection.'
      );
    }
  }

  async _isAmountCommitted(amount) {
    const total = this.formFrame.getByText(`Total ${Number(amount).toFixed(2)}`, { exact: false });
    return (await total.count().catch(() => 0)) > 0;
  }

  /**
   * CONFIRMED live (2026-08-15): Post/Post & New's "You have un-knock off
   * payment, knock off now?" confirmation — the correct answer for a
   * plain happy-path test is No (Yes would additionally try to apply the
   * invoice against an outstanding payment). Can render with a delay;
   * poll for it rather than assuming its absence means it won't appear.
   */
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

  /** CONFIRMED live (2026-08-15): posts the current document AND leaves a fresh blank New form behind. */
  async clickPostAndNew() {
    const postAndNewButton = this.formFrame.getByRole('listitem', { name: 'Post & New [Alt + Ctrl + P]' });
    await postAndNewButton.click();
    await this._declineKnockOffIfPresent();
  }

  /**
   * CONFIRMED live (2026-08-15): Post/Post & New can also fail with a
   * genuine "Error Encountered" dialog if the Amount didn't truly commit
   * (see _fillAmountWithRetry()'s own retry — this is a second line of
   * defense in case Post is ever called directly against a line the
   * caller filled manually). Dismisses it if present so the caller's next
   * step doesn't hang on a blocking modal; does NOT retry the save itself.
   */
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

  /**
   * CONFIRMED live (2026-08-15), same pattern as apPaymentPage.js's
   * _switchBackToPaymentTab(): Post and Post & New both open a NEW in-app
   * workspace tab ("A/R Invoice Document Report") that becomes the
   * active/frontmost one, leaving the "A/R Invoice" tab's own toolbar no
   * longer interactable until switched back to. Best-effort — a no-op if
   * there's nothing to switch (e.g. after Save Draft, which never opens a
   * report tab).
   */
  async _switchBackToInvoiceTab() {
    await this.page.getByRole('link', { name: 'A/R Invoice', exact: true }).last()
      .click({ timeout: 3000 }).catch(() => {});
    await this.page.waitForTimeout(500);
  }

  /**
   * BUG FIXED (2026-08-15, live test run): the knock-off dialog's
   * appearance is genuinely non-deterministic (confirmed live, matching
   * promotionPage.js's documented finding for its own similar dialog) —
   * it can still be pending, un-answered, and blocking clicks by the time
   * clickBack() runs, even though clickPost()/clickPostAndNew() already
   * checked for it once. Check again here, after switching tabs, before
   * attempting Back.
   */
  async clickBack() {
    await this._switchBackToInvoiceTab();
    await this._declineKnockOffIfPresent();
    const backButton = this.formFrame.getByRole('listitem', { name: 'Back [Alt + B]' });
    await backButton.click();
    await this.page.waitForTimeout(1000);
    await this._resolveListFrame();
  }

  /** New -> Customer -> Reference No -> one Account No. line with Amount. Stops before any save action. */
  async createInvoice({ customerCode, referenceNo, accountCode, amount }) {
    await this.clickNew();
    await this.selectCustomer(customerCode);
    await this.fillReferenceNo(referenceNo);
    await this.addInvoiceLine({ accountCode, amount });
  }

  /**
   * CONFIRMED live (2026-08-15): unlike A/P Payment's Save Draft, this
   * screen shows NO in-form success banner for Save Draft — verify via
   * the listing grid instead (see cancelDocument()'s search-then-act
   * pattern), not an in-form message check.
   */
  async getDocumentNo() {
    const field = this.formFrame.getByRole('textbox', { name: 'Document No.:', exact: true });
    return (await field.inputValue().catch(() => null)) || (await field.textContent().catch(() => null));
  }

  async getStatus() {
    const field = this.formFrame.getByRole('textbox', { name: 'Status:', exact: true });
    return (await field.inputValue().catch(() => null)) || (await field.textContent().catch(() => null));
  }

  /** Waits for a genuine GRID DATA ROW matching the given Reference No — same principle as apPaymentPage.js's equivalent. */
  async _waitForRowMatchingReference(referenceNo, timeout = 15000) {
    const escaped = referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dataRowPattern = new RegExp(`^ARJEDetailPage\\s+Cancel\\b.*\\b${escaped}\\b`, 'i');
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
   * "Cancel Confirmation" dialog via the SAME
   * `pcConfirmCancel_btnYesCancel_CD` control already confirmed for A/P
   * Payment. Scoped to this.listFrame, never page-wide.
   */
  async cancelDocument(referenceNo) {
    await this._resolveListFrame();
    const matched = await this._waitForRowMatchingReference(referenceNo);
    if (!matched) {
      await this.page.screenshot({
        path: `test-results/debug-ar-invoice-cancel-not-found-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `A/R Invoice grid never showed a row matching Reference No. "${referenceNo}" — ` +
        'refusing to proceed with Cancel against a possibly-stale/unfiltered row.'
      );
    }
    const row = this.listFrame.getByRole('row', {
      name: new RegExp(`^ARJEDetailPage\\s+Cancel\\b.*\\b${referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
    }).first();
    await row.getByRole('link', { name: 'Cancel', exact: true }).click();

    const { locator: yesButton } = await heal(this.listFrame, {
      id: 'arInvoice.cancelConfirmYesButton',
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

module.exports = { ArInvoicePage };
