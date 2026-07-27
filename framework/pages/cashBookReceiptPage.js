const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for General Ledger (transactional module, #sub2) > Cash Book
 * Receipt. Structurally a mirror of cashBookPaymentPage.js (same app,
 * same "AP Journal Entry" detail-form family, receipt side instead of
 * payment side) — see that file's header comment for the shared
 * rationale (Katalon-sourced, not yet run, same trust level as
 * journalEntryPage.js). Converted from Katalon's CBRD/CBRN/CBRP/CBRPN.
 *
 * Field naming differences from Cash Book Payment: "Received From"
 * instead of "Pay To"; the Post-flow's second grid is Katalon-named
 * "Tax Itemize" instead of "Simplify Invoice" but is the same shape (its
 * own Add icon, an account-code trigger, a row click, an amount field).
 * Toolbar root is `mAPReceiptDetailsToolBar` (vs. Cash Book Payment's
 * `mAPPaymentDetailsToolBar`) but the SAME DXI numbering:
 *
 * NOT YET independently re-recorded: Cash Book Payment's own codegen
 * (2026-07-26) found its Payment Mode picker is a dropdown LIST
 * (`DDD_L_LBI`), not a popup grid cell, and its GL allocation account
 * picker is a trigger+popup-cell click, not a type-to-filter text box —
 * both fixed in cashBookPaymentPage.js. This file mirrors those SAME
 * fixes on the assumption the identical underlying control renders the
 * same way here (same "AP Journal Entry" component family) — but that's
 * an inference, not confirmed for Receipt specifically. If Jin's own run
 * shows otherwise, fix this file from the real error, don't re-guess.
 * DXI0=Back, DXI1=Post & New, DXI2=Post, DXI4=Save Draft, DXI10=New — all
 * five confirmed directly from CBRD/CBRN/CBRP/CBRPN's own Object
 * Repository (2026-07-26), one notch more certain than Cash Book
 * Payment's inferred DXI1.
 *
 * Print button: same `input.nav.print_button` pattern, confirmed via
 * Katalon's own `input_TANJAK MEGA GROUP SDN BHD_nav print_button` object
 * (the name is just that run's counterparty, not a fixed label).
 */
class CashBookReceiptPage {
  constructor(page) {
    this.page = page;
    this.formFrame = null;
  }

  async goto() {
    const p = this.page;

    await p.getByRole('link', { name: 'General Ledger', exact: true }).click();
    await p.getByRole('link', { name: 'Cash Book Receipt', exact: true }).click();
    await p.waitForLoadState('networkidle');

    const addIconName = /Click Here Or Press \[Insert\]/i;
    const listFrame = await findFrame(p, async (frame) => {
      const img = frame.getByRole('img', { name: addIconName });
      return (await img.count()) > 0 && (await img.first().isVisible().catch(() => false));
    });
    if (!listFrame) {
      await p.screenshot({ path: 'test-results/debug-cash-book-receipt-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the frame containing the "Add" icon on the Cash Book Receipt list page. ' +
        'Saved test-results/debug-cash-book-receipt-list-page.png for inspection.'
      );
    }
    await listFrame.getByRole('img', { name: addIconName }).first().click();

    this.formFrame = await findFrame(p, async (frame) => {
      const receivedFrom = frame.locator('input[id*="txtReceivedFrom" i]');
      return (await receivedFrom.count()) > 0 && (await receivedFrom.first().isVisible().catch(() => false));
    });
    if (!this.formFrame) {
      await p.screenshot({ path: 'test-results/debug-after-cash-book-receipt-add-click.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the new Cash Book Receipt form frame after clicking Add. ' +
        'Saved test-results/debug-after-cash-book-receipt-add-click.png for inspection.'
      );
    }
  }

  async fields() {
    if (!this.formFrame) throw new Error('Call goto() before fields() — form frame not resolved yet.');
    const f = this.formFrame;

    return {
      receivedFromInput: (await heal(f, {
        id: 'cashBookReceipt.receivedFromInput',
        label: 'Received From',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_CashBookReceiptDTL_cbpAPJournalEntry_cbpAPJournalEntryDetail_ASPxRoundPanel1_formAPJEHeader_txtReceivedFrom_I' },
          { type: 'css', value: 'input[id*="formAPJEHeader" i][id*="txtReceivedFrom" i]' },
        ],
        timeout: 3000,
      }).catch(() => ({ locator: null }))).locator,

      newButton: (await heal(f, {
        id: 'cashBookReceipt.newButton',
        label: 'New',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_CashBookReceiptDTL_cbpAPJournalEntry_mAPReceiptDetailsToolBar_mToolBars_DXI10_T' },
          { type: 'css', value: '[id*="mAPReceiptDetailsToolBar" i][id*="DXI10_T" i]' },
          { type: 'text', value: 'New', options: { exact: true } },
        ],
        timeout: 1500,
      }).catch(() => ({ locator: null }))).locator,

      backButton: (await heal(f, {
        id: 'cashBookReceipt.backButton',
        label: 'Back',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_CashBookReceiptDTL_cbpAPJournalEntry_mAPReceiptDetailsToolBar_mToolBars_DXI0_T' },
          { type: 'css', value: '[id*="mAPReceiptDetailsToolBar" i][id*="DXI0_T" i]' },
          { type: 'text', value: 'Back', options: { exact: true } },
        ],
        timeout: 1500,
      }).catch(() => ({ locator: null }))).locator,

      postButton: (await heal(f, {
        id: 'cashBookReceipt.postButton',
        label: 'Post',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_CashBookReceiptDTL_cbpAPJournalEntry_mAPReceiptDetailsToolBar_mToolBars_DXI2_T' },
          { type: 'css', value: '[id*="mAPReceiptDetailsToolBar" i][id*="DXI2_T" i]' },
          { type: 'text', value: 'Post', options: { exact: true } },
        ],
        timeout: 1500,
      }).catch(() => ({ locator: null }))).locator,

      saveDraftButton: (await heal(f, {
        id: 'cashBookReceipt.saveDraftButton',
        label: 'Save Draft',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_CashBookReceiptDTL_cbpAPJournalEntry_mAPReceiptDetailsToolBar_mToolBars_DXI4_T' },
          { type: 'css', value: '[id*="mAPReceiptDetailsToolBar" i][id*="DXI4_T" i]' },
          { type: 'text', value: 'Save Draft', options: { exact: true } },
        ],
        timeout: 1500,
      }).catch(() => ({ locator: null }))).locator,

      postAndNewButton: (await heal(f, {
        id: 'cashBookReceipt.postAndNewButton',
        label: 'Post & New',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_CashBookReceiptDTL_cbpAPJournalEntry_mAPReceiptDetailsToolBar_mToolBars_DXI1_T' },
          { type: 'css', value: '[id*="mAPReceiptDetailsToolBar" i][id*="DXI1_T" i]' },
          { type: 'text', value: 'Post & New', options: { exact: true } },
        ],
        timeout: 1500,
      }).catch(() => ({ locator: null }))).locator,
    };
  }

  async fillReceivedFrom(receivedFrom) {
    const { receivedFromInput } = await this.fields();
    await receivedFromInput.fill(receivedFrom);
  }

  /**
   * Same shape as cashBookPaymentPage.js's addPaymentLine() — including
   * its dropdown-LIST fix for the mode picker (inferred here, not
   * independently re-recorded for Receipt — see class header comment).
   */
  async addPaymentLine({ mode = 'CASH', amount } = {}) {
    const f = this.formFrame;
    const { locator: addIcon } = await heal(f, {
      id: 'cashBookReceipt.paymentLineAddIcon',
      label: 'Add payment line',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_CashBookReceiptDTL_cbpAPJournalEntry_cpnlAPJEItem_formAPJEItem_PC_0_ASPxFormLayout2_gvAPPItem_header0_Add' },
        { type: 'css', value: 'img[id*="gvAPPItem" i][id*="header0_Add" i]' },
        { type: 'role', role: 'img', options: { name: 'Add', exact: true } },
        { type: 'role', role: 'img', options: { name: /Click Here Or Press \[Insert\]/i } },
      ],
      timeout: 3000,
    });
    await addIcon.click();
    await this.page.waitForTimeout(800);

    const { locator: modeTrigger } = await heal(f, {
      id: 'cashBookReceipt.paymentModeTrigger',
      label: 'Payment Mode',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_CashBookReceiptDTL_cbpAPJournalEntry_cpnlAPJEItem_formAPJEItem_PC_0_ASPxFormLayout2_gvAPPItem_DXEditor3_B-1' },
        { type: 'css', value: '#ctl00_MainContent_CashBookReceiptDTL_cbpAPJournalEntry_cpnlAPJEItem_formAPJEItem_PC_0_ASPxFormLayout2_gvAPPItem_DXEditor3_B-1Img' },
        { type: 'css', value: '[id*="gvAPPItem" i][id*="DXEditor3" i][id*="B-1" i]' },
      ],
      timeout: 3000,
    });
    await modeTrigger.click();
    await this.page.waitForTimeout(500);

    // Same fix as cashBookPaymentPage.js's addPaymentLine() (live run,
    // 2026-07-26): the Payment Mode dropdown list is NOT alphabetical and
    // NOT position-guessable from a codegen recording alone — Cash Book
    // Payment's own list turned out to be AMEX(0) MASTER(1) VISA(2)
    // POINT(3) **CASH(4)** TRANSFER(5) CHEQUE(6) BOOST(7) SHOPEE(8), found
    // by dumping the live dropdown's actual `td[id*="DDD_L_LBI"]` text
    // content rather than guessing again. Assuming the SAME master
    // Payment Mode list is shared between Payment and Receipt (same
    // underlying reference table) — index 4 = CASH here too — but this
    // has NOT been independently re-confirmed for Receipt specifically.
    // If it fails, dump the dropdown fresh rather than re-guessing.
    const { locator: modeOption } = await heal(f, {
      id: 'cashBookReceipt.paymentModeOption',
      label: mode,
      strategies: [
        ...(mode === 'CASH'
          ? [{ type: 'css', value: '#ctl00_MainContent_CashBookReceiptDTL_cbpAPJournalEntry_cpnlAPJEItem_formAPJEItem_PC_0_ASPxFormLayout2_gvAPPItem_DXEditor3_DDD_L_LBI4T0' }]
          : []),
        { type: 'css', value: `td[id*="gvAPPItem" i][id*="DDD_L_LBI" i][id$="T0"]:visible:text-is("${mode}")` },
        { type: 'text', value: mode, options: { exact: true } },
      ],
      timeout: 3000,
    });
    await modeOption.click();
    await this.page.waitForTimeout(1000);

    if (amount != null) {
      const { locator: amountInput } = await heal(f, {
        id: 'cashBookReceipt.paymentAmountInput',
        label: 'Amount',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_CashBookReceiptDTL_cbpAPJournalEntry_cpnlAPJEItem_formAPJEItem_PC_0_ASPxFormLayout2_gvAPPItem_DXEditor7_I' },
          { type: 'css', value: 'input[id*="gvAPPItem" i][id*="DXEditor7" i]' },
        ],
        timeout: 3000,
      });
      // Same commit fix as Cash Book Payment: a bare .fill() left the cell
      // showing a validation error even though the value was visually set.
      await amountInput.click();
      await amountInput.fill(String(amount));
      await amountInput.press('Tab');
    }
  }

  /**
   * ONLY needed for Post/Post & New (CBRP/CBRPN) — see
   * cashBookPaymentPage.js's addGlAllocationLine() for the shared
   * rationale (trigger + popup-cell click, no filter text — inferred
   * here, not independently re-recorded for Receipt). Katalon calls this
   * trigger "Tax Itemize" here.
   */
  async addGlAllocationLine({ accountCode, amount }) {
    const f = this.formFrame;
    const { locator: addIcon } = await heal(f, {
      id: 'cashBookReceipt.glAllocationAddIcon',
      label: 'Add GL allocation line',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_CashBookReceiptDTL_cbpAPJournalEntry_cpnlAPJEItem_formAPJEItem_PC_0_cbpAPReceiptDtl2_formAPReceiptDtl2_gvAPJEItem_header0_Add' },
        { type: 'css', value: 'img[id*="APReceiptDtl2" i][id*="header0_Add" i]' },
        { type: 'role', role: 'img', options: { name: /Click Here Or Press \[Insert\]/i } },
      ],
      timeout: 3000,
    });
    await addIcon.click();
    await this.page.waitForTimeout(800);

    if (accountCode) {
      const { locator: accountTrigger } = await heal(f, {
        id: 'cashBookReceipt.glAccountTrigger',
        label: 'GL Account Code',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_CashBookReceiptDTL_cbpAPJournalEntry_cpnlAPJEItem_formAPJEItem_PC_0_cbpAPReceiptDtl2_formAPReceiptDtl2_gvAPJEItem_DXEditor3_B-1' },
          { type: 'css', value: '[id*="APReceiptDtl2" i][id*="DXEditor3" i][id*="B-1" i]' },
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
        id: 'cashBookReceipt.glAllocationAmountInput',
        label: 'GL allocation amount',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_CashBookReceiptDTL_cbpAPJournalEntry_cpnlAPJEItem_formAPJEItem_PC_0_cbpAPReceiptDtl2_formAPReceiptDtl2_gvAPJEItem_DXEditor11_I' },
          { type: 'css', value: 'input[id*="APReceiptDtl2" i][id*="DXEditor11" i]' },
        ],
        timeout: 3000,
      });
      // Same commit fix as Cash Book Payment's GL allocation amount.
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

  async printReport() {
    const p = this.page;
    const printSelector = 'input.nav.print_button, input[title="Print from Adobe Reader" i]';

    const reportFrame = await findFrame(p, async (frame) => {
      const btn = frame.locator(printSelector);
      return (await btn.count()) > 0 && (await btn.first().isVisible().catch(() => false));
    });
    if (!reportFrame) {
      await p.screenshot({ path: 'test-results/debug-cbr-report-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the receipt report\'s print button. ' +
        'Saved test-results/debug-cbr-report-not-found.png for inspection.'
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

module.exports = { CashBookReceiptPage };
