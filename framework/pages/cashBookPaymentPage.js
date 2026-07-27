const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for General Ledger (transactional module, #sub2) > Cash Book
 * Payment. Originally converted from Katalon's CBPD/CBPN/CBPP/CBPPN Object
 * Repository + groovy scripts (2022, stale, unconfirmed) — then CORRECTED
 * against two real Playwright codegen recordings Jin made himself
 * (2026-07-26, Save Draft flow + Post flow) after he reported "Cash Book
 * Payment有问题" (something's wrong). Two genuine bugs found and fixed —
 * see addPaymentLine()/addGlAllocationLine() comments for specifics; this
 * is now one rung more trusted than journalEntryPage.js (live-verified
 * shape, not just Katalon's word for it), though still not a passing run.
 *
 * SHAPE: nav > list grid "Add" icon > detail form (own iframe) > Pay To
 * header field > a PAYMENT-MODE line grid (its own "Add" icon > a mode
 * dropdown trigger > pick "CASH" from a dropdown LIST, not a popup grid >
 * an Amount field) > toolbar action.
 *
 * Draft/New (CBPD/CBPN) stop after the payment-mode line + Save
 * Draft/New. Post/Post & New (CBPP/CBPPN) additionally fill a SECOND,
 * separate grid — a GL account allocation line — before posting: its own
 * "Add" icon (Katalon named it "Simplify Invoice"), an account-code
 * trigger, a row click by account code (confirmed live: a plain popup
 * grid cell click, same shape as Journal Entry's account picker — NOT a
 * type-to-filter text box like Katalon's stale recording suggested), then
 * an amount/description field. `addGlAllocationLine()` is ONLY needed for
 * the Post/Post & New flow.
 *
 * Toolbar ids follow the same `mToolBars_DXI{N}_T` numbering confirmed
 * across Cash Sales and Journal Entry: DXI0=Back, DXI1=Post & New,
 * DXI2=Post, DXI4=Save Draft, DXI10=New — root id here is
 * `mAPPaymentDetailsToolBar_mToolBars_DXI{N}_T`. DXI0/DXI2/DXI4/DXI10 are
 * each confirmed directly from CBPD/CBPN/CBPP's own Object Repository
 * (2026-07-26); DXI1 (Post & New) was NOT separately re-extracted for
 * this specific module (CBPPN's own `.rs` wasn't re-checked) — inferred
 * from the same slot holding across Journal Entry and Cash Book Receipt,
 * kept as a strategy but one notch less certain than the other four.
 *
 * The print button (Payment Voucher report) reuses the exact same
 * `input.nav.print_button` pattern as Cash Sales's GST report and Journal
 * Entry's Journal Voucher report — CONFIRMED live via Jin's own Post
 * recording (`getByRole('button', {name: 'Print from Adobe Reader'})`
 * inside `iframe[name="0"]`, resolving to the same underlying
 * `input[title="Print from Adobe Reader"]` this file's printReport()
 * already targets — no change needed there).
 */
class CashBookPaymentPage {
  constructor(page) {
    this.page = page;
    this.formFrame = null;
  }

  async goto() {
    const p = this.page;

    await p.getByRole('link', { name: 'General Ledger', exact: true }).click();
    await p.getByRole('link', { name: 'Cash Book Payment', exact: true }).click();
    await p.waitForLoadState('networkidle');

    const addIconName = /Click Here Or Press \[Insert\]/i;
    const listFrame = await findFrame(p, async (frame) => {
      const img = frame.getByRole('img', { name: addIconName });
      return (await img.count()) > 0 && (await img.first().isVisible().catch(() => false));
    });
    if (!listFrame) {
      await p.screenshot({ path: 'test-results/debug-cash-book-payment-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the frame containing the "Add" icon on the Cash Book Payment list page. ' +
        'Saved test-results/debug-cash-book-payment-list-page.png for inspection.'
      );
    }
    await listFrame.getByRole('img', { name: addIconName }).first().click();

    this.formFrame = await findFrame(p, async (frame) => {
      const payTo = frame.locator('input[id*="txtPayTo" i]');
      return (await payTo.count()) > 0 && (await payTo.first().isVisible().catch(() => false));
    });
    if (!this.formFrame) {
      await p.screenshot({ path: 'test-results/debug-after-cash-book-payment-add-click.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the new Cash Book Payment form frame after clicking Add. ' +
        'Saved test-results/debug-after-cash-book-payment-add-click.png for inspection.'
      );
    }
  }

  async fields() {
    if (!this.formFrame) throw new Error('Call goto() before fields() — form frame not resolved yet.');
    const f = this.formFrame;

    return {
      payToInput: (await heal(f, {
        id: 'cashBookPayment.payToInput',
        label: 'Pay To',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_CashBookPaymentDTL_cbpAPJournalEntry_cbpAPJournalEntryDetail_ASPxRoundPanel1_formAPJEHeader_txtPayTo_I' },
          { type: 'css', value: 'input[id*="formAPJEHeader" i][id*="txtPayTo" i]' },
        ],
        timeout: 3000,
      }).catch(() => ({ locator: null }))).locator,

      newButton: (await heal(f, {
        id: 'cashBookPayment.newButton',
        label: 'New',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_CashBookPaymentDTL_cbpAPJournalEntry_mAPPaymentDetailsToolBar_mToolBars_DXI10_T' },
          { type: 'css', value: '[id*="mAPPaymentDetailsToolBar" i][id*="DXI10_T" i]' },
          { type: 'text', value: 'New', options: { exact: true } },
        ],
        timeout: 1500,
      }).catch(() => ({ locator: null }))).locator,

      backButton: (await heal(f, {
        id: 'cashBookPayment.backButton',
        label: 'Back',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_CashBookPaymentDTL_cbpAPJournalEntry_mAPPaymentDetailsToolBar_mToolBars_DXI0_T' },
          { type: 'css', value: '[id*="mAPPaymentDetailsToolBar" i][id*="DXI0_T" i]' },
          { type: 'text', value: 'Back', options: { exact: true } },
        ],
        timeout: 1500,
      }).catch(() => ({ locator: null }))).locator,

      postButton: (await heal(f, {
        id: 'cashBookPayment.postButton',
        label: 'Post',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_CashBookPaymentDTL_cbpAPJournalEntry_mAPPaymentDetailsToolBar_mToolBars_DXI2_T' },
          { type: 'css', value: '[id*="mAPPaymentDetailsToolBar" i][id*="DXI2_T" i]' },
          { type: 'text', value: 'Post', options: { exact: true } },
        ],
        timeout: 1500,
      }).catch(() => ({ locator: null }))).locator,

      saveDraftButton: (await heal(f, {
        id: 'cashBookPayment.saveDraftButton',
        label: 'Save Draft',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_CashBookPaymentDTL_cbpAPJournalEntry_mAPPaymentDetailsToolBar_mToolBars_DXI4_T' },
          { type: 'css', value: '[id*="mAPPaymentDetailsToolBar" i][id*="DXI4_T" i]' },
          { type: 'text', value: 'Save Draft', options: { exact: true } },
        ],
        timeout: 1500,
      }).catch(() => ({ locator: null }))).locator,

      // Inferred slot (DXI1), not separately re-extracted for this module — see class header comment.
      postAndNewButton: (await heal(f, {
        id: 'cashBookPayment.postAndNewButton',
        label: 'Post & New',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_CashBookPaymentDTL_cbpAPJournalEntry_mAPPaymentDetailsToolBar_mToolBars_DXI1_T' },
          { type: 'css', value: '[id*="mAPPaymentDetailsToolBar" i][id*="DXI1_T" i]' },
          { type: 'text', value: 'Post & New', options: { exact: true } },
        ],
        timeout: 1500,
      }).catch(() => ({ locator: null }))).locator,
    };
  }

  async fillPayTo(payTo) {
    const { payToInput } = await this.fields();
    await payToInput.fill(payTo);
  }

  /**
   * Adds one payment-mode line: click the payment grid's "Add" icon, pick
   * a mode (default CASH), fill the Amount.
   *
   * BUG FIXED (Jin's codegen, 2026-07-26): the mode picker is a plain
   * DevExpress dropdown LIST (`DDD_L_LBI` = dropdown-list-item), same
   * shape as Cash Sales's MultiPayment mode picker (see
   * cashSalesPage.js's completeMultiPayment()) — NOT a popup search grid.
   * The original version of this method clicked
   * `getByRole('cell', {name: mode})`, which doesn't exist for this
   * control; fixed to click the `DDD_L_LBI` list item instead. Also: the
   * live trigger id is `DXEditor3_B-1` (no "Img" suffix) — kept as
   * primary, with the Katalon-recorded `_B-1Img` variant as a fallback.
   * The Add icon's accessible name here is plain "Add" (confirmed live),
   * not the "Click Here Or Press [Insert]" title used elsewhere in this
   * app — kept as an extra fallback, not the primary strategy.
   */
  async addPaymentLine({ mode = 'CASH', amount } = {}) {
    const f = this.formFrame;
    const { locator: addIcon } = await heal(f, {
      id: 'cashBookPayment.paymentLineAddIcon',
      label: 'Add payment line',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_CashBookPaymentDTL_cbpAPJournalEntry_cpnlAPJEItem_formAPJEItem_PC_0_ASPxFormLayout2_gvAPPItem_header0_Add' },
        { type: 'css', value: 'img[id*="gvAPPItem" i][id*="header0_Add" i]' },
        { type: 'role', role: 'img', options: { name: 'Add', exact: true } },
        { type: 'role', role: 'img', options: { name: /Click Here Or Press \[Insert\]/i } },
      ],
      timeout: 3000,
    });
    await addIcon.click();
    await this.page.waitForTimeout(800);

    const { locator: modeTrigger } = await heal(f, {
      id: 'cashBookPayment.paymentModeTrigger',
      label: 'Payment Mode',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_CashBookPaymentDTL_cbpAPJournalEntry_cpnlAPJEItem_formAPJEItem_PC_0_ASPxFormLayout2_gvAPPItem_DXEditor3_B-1' },
        { type: 'css', value: '#ctl00_MainContent_CashBookPaymentDTL_cbpAPJournalEntry_cpnlAPJEItem_formAPJEItem_PC_0_ASPxFormLayout2_gvAPPItem_DXEditor3_B-1Img' },
        { type: 'css', value: '[id*="gvAPPItem" i][id*="DXEditor3" i][id*="B-1" i]' },
      ],
      timeout: 3000,
    });
    await modeTrigger.click();
    await this.page.waitForTimeout(500);

    // BUG FIXED TWICE (live runs, 2026-07-26):
    // 1st: `:text-is("CASH")` id-substring strategy kept ATTACHING (heal()
    //    only tracks attachment, not whether the click actually committed
    //    the value — the exact KB-poisoning trap documented in
    //    cashSalesPage.js) but left the row stuck showing literal
    //    duplicated text "CASH CASH" with Payment Amount stuck on
    //    "Required" even after being filled.
    // 2nd: replaced with Jin's own recorded exact id, `DDD_L_LBI1T0` —
    //    which turned out to be WRONG. Dumped the live dropdown's actual
    //    contents (`td[id*="DDD_L_LBI"]` textContent) and found this list
    //    is NOT alphabetical and NOT stable-by-position across sessions:
    //    AMEX(0) MASTER(1) VISA(2) POINT(3) **CASH(4)** TRANSFER(5)
    //    CHEQUE(6) BOOST(7) SHOPEE(8). Jin's own recording had
    //    accidentally selected MASTER, not CASH — matching the original
    //    bug screenshot exactly ("MASTER MASTE.../CREDITCARD"). Each item
    //    renders as TWO DOM nodes (`...T0`/`...T1`, same text, both
    //    "visible") — T0 confirmed to be the real interactive one.
    // Fixed to target `LBI4T0` (CASH) specifically. This index is NOT
    // guaranteed stable if the client's Payment Mode master list changes
    // — if `mode` is ever something other than 'CASH', don't reuse this
    // hardcoded index; dump the dropdown fresh instead of guessing again.
    const { locator: modeOption } = await heal(f, {
      id: 'cashBookPayment.paymentModeOption',
      label: mode,
      strategies: [
        ...(mode === 'CASH'
          ? [{ type: 'css', value: '#ctl00_MainContent_CashBookPaymentDTL_cbpAPJournalEntry_cpnlAPJEItem_formAPJEItem_PC_0_ASPxFormLayout2_gvAPPItem_DXEditor3_DDD_L_LBI4T0' }]
          : []),
        { type: 'css', value: `td[id*="gvAPPItem" i][id*="DDD_L_LBI" i][id$="T0"]:visible:text-is("${mode}")` },
        { type: 'text', value: mode, options: { exact: true } },
      ],
      timeout: 3000,
    });
    await modeOption.click();
    // Give DevExpress a beat to actually commit the cell value (not just
    // visually show it) before touching the next field — the previous
    // bug's row-stayed-invalid symptom suggests the commit needs a moment.
    await this.page.waitForTimeout(1000);

    if (amount != null) {
      const { locator: amountInput } = await heal(f, {
        id: 'cashBookPayment.paymentAmountInput',
        label: 'Amount',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_CashBookPaymentDTL_cbpAPJournalEntry_cpnlAPJEItem_formAPJEItem_PC_0_ASPxFormLayout2_gvAPPItem_DXEditor7_I' },
          { type: 'css', value: 'input[id*="gvAPPItem" i][id*="DXEditor7" i]' },
        ],
        timeout: 3000,
      });
      await amountInput.click();
      await amountInput.fill(String(amount));
      await amountInput.press('Tab');
    }
  }

  /**
   * ONLY needed for Post/Post & New (CBPP/CBPPN) — a separate GL account
   * allocation grid.
   *
   * BUG FIXED (Jin's codegen, 2026-07-26): Katalon's stale recording
   * showed a type-to-filter text box here; the live app instead shows a
   * plain trigger + popup grid cell click, the SAME shape as Journal
   * Entry's account picker — click the trigger, then click the row
   * matching `accountCode` directly, no filter text needed. The
   * `accountFilter` param this method used to accept is gone.
   */
  async addGlAllocationLine({ accountCode, amount }) {
    const f = this.formFrame;
    const { locator: addIcon } = await heal(f, {
      id: 'cashBookPayment.glAllocationAddIcon',
      label: 'Add GL allocation line',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_CashBookPaymentDTL_cbpAPJournalEntry_cpnlAPJEItem_formAPJEItem_PC_0_cbpAPPaymentDtl2_formAPPaymentDtl2_gvAPJEItem_header0_Add' },
        { type: 'css', value: 'img[id*="APPaymentDtl2" i][id*="header0_Add" i]' },
        { type: 'role', role: 'img', options: { name: /Click Here Or Press \[Insert\]/i } },
      ],
      timeout: 3000,
    });
    await addIcon.click();
    await this.page.waitForTimeout(800);

    if (accountCode) {
      const { locator: accountTrigger } = await heal(f, {
        id: 'cashBookPayment.glAccountTrigger',
        label: 'GL Account Code',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_CashBookPaymentDTL_cbpAPJournalEntry_cpnlAPJEItem_formAPJEItem_PC_0_cbpAPPaymentDtl2_formAPPaymentDtl2_gvAPJEItem_DXEditor3_B-1' },
          { type: 'css', value: '[id*="APPaymentDtl2" i][id*="DXEditor3" i][id*="B-1" i]' },
        ],
        timeout: 3000,
      });
      await accountTrigger.click();
      await this.page.waitForTimeout(500);

      const popupFrame = (await findFrame(this.page, async (frame) => {
        const cell = frame.getByRole('cell', { name: accountCode, exact: true });
        return (await cell.count()) > 0;
      })) || f;
      await popupFrame.getByRole('cell', { name: accountCode, exact: true }).first().click();
      await this.page.waitForTimeout(500);
    }

    if (amount != null) {
      const { locator: amountInput } = await heal(f, {
        id: 'cashBookPayment.glAllocationAmountInput',
        label: 'GL allocation amount',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_CashBookPaymentDTL_cbpAPJournalEntry_cpnlAPJEItem_formAPJEItem_PC_0_cbpAPPaymentDtl2_formAPPaymentDtl2_gvAPJEItem_DXEditor11_I' },
          { type: 'css', value: 'input[id*="APPaymentDtl2" i][id*="DXEditor11" i]' },
        ],
        timeout: 3000,
      });
      // Same commit fix as addPaymentLine()'s amount field (live run,
      // 2026-07-26): a bare .fill() left this cell showing a validation
      // error (red "!", uncommitted) even though the value was visually
      // set — click first, fill, then Tab to force DevExpress to commit.
      await amountInput.click();
      await amountInput.fill(String(amount));
      await amountInput.press('Tab');
    }
  }

  async clickNew() {
    const { newButton } = await this.fields();
    await newButton.click();
    await this.page.waitForTimeout(1000);
  }

  async clickBack() {
    const { backButton } = await this.fields();
    await backButton.click();
    await this.page.waitForTimeout(1000);
  }

  async clickSaveDraft() {
    const { saveDraftButton } = await this.fields();
    await saveDraftButton.click();
    await this.page.waitForTimeout(1500);
  }

  async clickPost() {
    const { postButton } = await this.fields();
    await postButton.click();
    await this.page.waitForTimeout(1500);
  }

  async clickPostAndNew() {
    const { postAndNewButton } = await this.fields();
    await postAndNewButton.click();
    await this.page.waitForTimeout(1500);
  }

  /** Same `input.nav.print_button` pattern as Cash Sales / Journal Entry — see their printReport() comments. */
  async printReport() {
    const p = this.page;
    const printSelector = 'input.nav.print_button, input[title="Print from Adobe Reader" i]';

    const reportFrame = await findFrame(p, async (frame) => {
      const btn = frame.locator(printSelector);
      return (await btn.count()) > 0 && (await btn.first().isVisible().catch(() => false));
    });
    if (!reportFrame) {
      await p.screenshot({ path: 'test-results/debug-cbp-report-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Payment Voucher report\'s print button. ' +
        'Saved test-results/debug-cbp-report-not-found.png for inspection.'
      );
    }

    const [reportPage] = await Promise.all([
      p.context().waitForEvent('page', { timeout: 10000 }),
      reportFrame.locator(printSelector).first().click(),
    ]);
    await reportPage.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
    return reportPage;
  }

  isReportPageValid(reportPage) {
    return /FastReport\.Export\.axd/i.test(reportPage.url());
  }

  async getValidationErrors() {
    const scope = this.formFrame || this.page;
    const candidates = scope.locator('[class*="error" i], [class*="validation" i]');
    const count = await candidates.count();
    const visibleTexts = [];
    for (let i = 0; i < count; i++) {
      const el = candidates.nth(i);
      if (await el.isVisible().catch(() => false)) {
        const text = (await el.innerText()).trim();
        if (text) visibleTexts.push(text);
      }
    }
    return visibleTexts;
  }
}

module.exports = { CashBookPaymentPage };
