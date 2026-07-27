const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for General Ledger (transactional module, top nav `#sub2`) >
 * Journal Entry. NOT the same "General Ledger" as
 * `generalLedgerReportPage.js` — that one is the Reports category (#sub13,
 * read-only report catalog). This one is the actual GL entry screen
 * (Katalon: Test Cases/Regression Test/General Ledger/Journal Entry).
 *
 * SOURCE: converted from Katalon's JEN ("Journal Entry New") Object
 * Repository + Script1666619936762.groovy — a 2022 recording, not a fresh
 * codegen capture, and NOT yet run against the live app by either of us.
 * Every `heal()` id below is a Katalon-carried-over FIRST GUESS, one rung
 * less trusted than the Reports category's codegen-sourced selectors and
 * on par with Cash Sales's original pilot before its live confirmation
 * pass. Loose id-substring / role / text fallbacks are included so fuzzy
 * matching has less work to do if the exact id has drifted; genuine fuzzy
 * discovery (`heal()`'s last resort) covers whatever those miss. Treat
 * every selector here as "needs reconfirm on first real run" until proven
 * otherwise — do not upgrade this comment to "confirmed" without an actual
 * pass.
 *
 * Structure mirrors cashSalesPage.js exactly, since Katalon's own flow is
 * the same shape (nav -> list grid "Add" icon -> detail form in its own
 * iframe -> header field -> line-items grid with its own "Add" icon ->
 * popup-pick a field on the new line -> numeric field -> toolbar action):
 * - The list grid's "Add" icon shares the same title text
 *   ("Click Here Or Press [Insert] To Add Record") as every other ASPx
 *   grid toolbar in this app (Create Item, Cash Sales) — same detection
 *   pattern via `findFrame()` + role=img regex, no new logic needed.
 * - The Account Code trigger on a JE line (`DXEditor3_B-1Img`, alt="v") is
 *   a plain dropdown-arrow icon, NOT a `cbSelectCust`/`ItemSearch`-style
 *   "GeneralSearchControl" trigger like Cash Sales's Customer/Item pickers.
 *   Katalon's own script clicks the popup row (`td_410-0000`) and moves
 *   straight to the Amount field with NO separate "OK" click recorded —
 *   suggesting this is a simpler auto-closing grid-lookup, not a modal
 *   search dialog. `selectAccount()` below matches that: click trigger ->
 *   click matching row -> if an OK-shaped control happens to still be
 *   visible, click it (self-skip, same defensive pattern as
 *   `previewReport()` in the Reports page object) -> otherwise proceed.
 *   Don't assume this needs the dx-vam OK fix Cash Sales needed until a
 *   live run actually shows that ambiguity here too.
 * - Toolbar button ids follow the exact same `mToolBars_DXI{N}_T` numbering
 *   Cash Sales uses (`mCashSalesDetailsToolBar_mToolBars_DXI0/2/4/10_T` for
 *   Back/Post/Save Draft/New) — here it's
 *   `mJEDetailsToolBar_mToolBars_DXI{N}_T`. Back(0)/New(10) come from JEN's
 *   own script; Save Draft(4)/Post(2) were originally carried over from
 *   Cash Sales's numbering as an educated guess, then CONFIRMED exactly
 *   right by reading JED's and JEP's own Object Repository (`.rs`) files
 *   directly (2026-07-26) — same ids, no correction needed. Post & New is
 *   DXI1 (from JEPN's `.rs`, not a number that could have been guessed
 *   from Cash Sales alone, which has no Post & New button).
 * - JEP/JEPN add a SECOND line the same way as the first (same `addLine()`
 *   call, same ids reused — DevExpress reuses one inline-edit template
 *   positioned over whichever row is active, confirmed by Katalon
 *   recording identical ids for both lines' Add icon and Account Code
 *   trigger).
 *
 * ROOT-CAUSED (live run + real DOM dump, 2026-07-26, after Jin reported
 * "有问题" against a target screenshot showing separate DR/CR columns):
 * `DXEditor11_I` and `DXEditor12_I` are NOT two interchangeable "amount"
 * ids for two different lines — they are the row's genuinely separate
 * **DR** and **CR** column editors (confirmed by dumping every visible
 * input in an open edit row: the column order is Account No.(3) →
 * Description(4) → 2nd Description(5) → Cost Centre(8) → **DR(11)** →
 * **CR(12)** → Tax Type(13) → Tax Code(14) → ...). An earlier version of
 * this file wrongly guessed these were "JEP's first vs second line amount
 * field, inconsistent, not root-caused" and had `addLine()` try one then
 * fall back to the other for a single generic `amount` param — which
 * silently filled NEITHER the DR nor the CR the row actually needed,
 * producing Post's real validation error: "Dr & Cr Amount must be greater
 * than 0". Katalon's own JEP script was correct all along: line 1 fills
 * DXEditor11 (DR), line 2 fills DXEditor12 (CR) — that's a real two-sided
 * double-entry line, not an id quirk. `addLine()` now takes explicit
 * `dr`/`cr` params instead of a generic `amount`.
 */
class JournalEntryPage {
  constructor(page) {
    this.page = page;
    this.formFrame = null; // resolved by goto() once the Journal Entry detail form iframe is found
  }

  async goto() {
    const p = this.page;

    await p.getByRole('link', { name: 'General Ledger', exact: true }).click();
    await p.getByRole('link', { name: 'Journal Entry', exact: true }).click();
    await p.waitForLoadState('networkidle');

    const addIconName = /Click Here Or Press \[Insert\]/i;
    const listFrame = await findFrame(p, async (frame) => {
      const img = frame.getByRole('img', { name: addIconName });
      return (await img.count()) > 0 && (await img.first().isVisible().catch(() => false));
    });
    if (!listFrame) {
      await p.screenshot({ path: 'test-results/debug-journal-entry-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the frame containing the "Add" icon on the Journal Entry list page. ' +
        'Saved test-results/debug-journal-entry-list-page.png for inspection.'
      );
    }
    await listFrame.getByRole('img', { name: addIconName }).first().click();

    // Distinguishing element for the detail form frame: the header
    // Description input (Katalon id: ...formJEHeader_txtDescription_I).
    this.formFrame = await findFrame(p, async (frame) => {
      const desc = frame.locator('input[id*="txtDescription" i]');
      return (await desc.count()) > 0 && (await desc.first().isVisible().catch(() => false));
    });
    if (!this.formFrame) {
      await p.screenshot({ path: 'test-results/debug-after-journal-entry-add-click.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the new Journal Entry form frame after clicking Add. ' +
        'Saved test-results/debug-after-journal-entry-add-click.png for inspection.'
      );
    }
  }

  async fields() {
    if (!this.formFrame) {
      throw new Error('Call goto() before fields() — form frame has not been resolved yet.');
    }
    const f = this.formFrame;

    return {
      descriptionInput: (await heal(f, {
        id: 'journalEntry.descriptionInput',
        label: 'Description',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_JournalEntryDetail_cbpJournalEntry_cbpJournalEntryDetail_ASPxRoundPanel1_formJEHeader_txtDescription_I' },
          { type: 'css', value: 'input[id*="formJEHeader" i][id*="txtDescription" i]' },
          { type: 'css', value: 'input[id*="txtDescription" i]' },
        ],
        timeout: 3000,
      }).catch(() => ({ locator: null }))).locator,

      lineAddIcon: (await heal(f, {
        id: 'journalEntry.lineAddIcon',
        label: 'Add journal entry line',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_JournalEntryDetail_cbpJournalEntry_cpnlJEItem_formJEItem_PC_0_gvJEItem_header0_Add' },
          { type: 'css', value: 'img[id*="gvJEItem" i][id*="header0_Add" i]' },
          { type: 'role', role: 'img', options: { name: /Click Here Or Press \[Insert\]/i } },
        ],
        timeout: 3000,
      }).catch(() => ({ locator: null }))).locator,

      newButton: (await heal(f, {
        id: 'journalEntry.newButton',
        label: 'New',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_JournalEntryDetail_cbpJournalEntry_mJEDetailsToolBar_mToolBars_DXI10_T' },
          { type: 'css', value: '[id*="mJEDetailsToolBar" i][id*="DXI10_T" i]' },
          { type: 'text', value: 'New', options: { exact: true } },
        ],
        timeout: 1500,
      }).catch(() => ({ locator: null }))).locator,

      backButton: (await heal(f, {
        id: 'journalEntry.backButton',
        label: 'Back',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_JournalEntryDetail_cbpJournalEntry_mJEDetailsToolBar_mToolBars_DXI0_T' },
          { type: 'css', value: '[id*="mJEDetailsToolBar" i][id*="DXI0_T" i]' },
          { type: 'text', value: 'Back', options: { exact: true } },
        ],
        timeout: 1500,
      }).catch(() => ({ locator: null }))).locator,

      // Confirmed via JEP's own Object Repository (2026-07-26).
      postButton: (await heal(f, {
        id: 'journalEntry.postButton',
        label: 'Post',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_JournalEntryDetail_cbpJournalEntry_mJEDetailsToolBar_mToolBars_DXI2_T' },
          { type: 'css', value: '[id*="mJEDetailsToolBar" i][id*="DXI2_T" i]' },
          { type: 'text', value: 'Post', options: { exact: true } },
        ],
        timeout: 1500,
      }).catch(() => ({ locator: null }))).locator,

      // Confirmed via JED's own Object Repository (2026-07-26).
      saveDraftButton: (await heal(f, {
        id: 'journalEntry.saveDraftButton',
        label: 'Save Draft',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_JournalEntryDetail_cbpJournalEntry_mJEDetailsToolBar_mToolBars_DXI4_T' },
          { type: 'css', value: '[id*="mJEDetailsToolBar" i][id*="DXI4_T" i]' },
          { type: 'text', value: 'Save Draft', options: { exact: true } },
        ],
        timeout: 1500,
      }).catch(() => ({ locator: null }))).locator,

      // Confirmed via JEPN's own Object Repository (2026-07-26) — DXI1, not
      // a number guessable from Cash Sales (which has no Post & New).
      postAndNewButton: (await heal(f, {
        id: 'journalEntry.postAndNewButton',
        label: 'Post & New',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_JournalEntryDetail_cbpJournalEntry_mJEDetailsToolBar_mToolBars_DXI1_T' },
          { type: 'css', value: '[id*="mJEDetailsToolBar" i][id*="DXI1_T" i]' },
          { type: 'text', value: 'Post & New', options: { exact: true } },
        ],
        timeout: 1500,
      }).catch(() => ({ locator: null }))).locator,
    };
  }

  async fillHeader(description) {
    const { descriptionInput } = await this.fields();
    await descriptionInput.fill(description);
  }

  /**
   * Adds one JE line: clicks the line grid's "Add" icon, picks an Account
   * Code via its dropdown/lookup trigger, then fills DR and/or CR (a real
   * double-entry line — fill whichever side this line actually needs, not
   * both; see class header comment for how this was root-caused).
   * See class header comment re: the account picker likely NOT needing an
   * explicit OK click (Katalon's script doesn't record one) — an OK-shaped
   * control is clicked only if one happens to be visible, so this still
   * works if the real popup turns out to behave like Cash Sales's instead.
   */
  async addLine({ accountCode, dr, cr }) {
    const f = this.formFrame;
    const { lineAddIcon } = await this.fields();
    await lineAddIcon.click();
    await this.page.waitForTimeout(800);

    if (accountCode) {
      const { locator: accountTrigger } = await heal(f, {
        id: 'journalEntry.accountTrigger',
        label: 'Account Code',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_JournalEntryDetail_cbpJournalEntry_cpnlJEItem_formJEItem_PC_0_gvJEItem_DXEditor3_B-1Img' },
          { type: 'css', value: 'img[id*="gvJEItem" i][id*="DXEditor3" i][id*="B-1Img" i]' },
          { type: 'css', value: 'img[id*="gvJEItem" i][id*="B-1Img" i]' },
        ],
        timeout: 3000,
      });
      await accountTrigger.click();

      const popupFrame = (await findFrame(this.page, async (frame) => {
        const cell = frame.getByRole('cell', { name: accountCode, exact: true });
        return (await cell.count()) > 0;
      })) || f;

      await popupFrame.getByRole('cell', { name: accountCode, exact: true }).first().click();

      // Self-skip: only click an OK-shaped control if one is genuinely
      // visible within a short window — Katalon's JEN script never clicked
      // one here, unlike Cash Sales's Customer/Item popups.
      const okButton = popupFrame.locator('span.dx-vam:visible:text-is("OK")');
      if (await okButton.count().catch(() => 0)) {
        await okButton.first().click().catch(() => {});
      }
      await this.page.waitForTimeout(500);
    }

    // DXEditor11_I = DR, DXEditor12_I = CR — confirmed via a live DOM dump
    // (see class header comment). A bare .fill() also left cells showing
    // a validation error despite the value being visibly set (same
    // DevExpress batch-grid commit gap found in cashBookPaymentPage.js) —
    // click, fill, then Tab to force the commit.
    if (dr != null) {
      const { locator: drInput } = await heal(f, {
        id: 'journalEntry.drInput',
        label: 'DR',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_JournalEntryDetail_cbpJournalEntry_cpnlJEItem_formJEItem_PC_0_gvJEItem_DXEditor11_I' },
          { type: 'css', value: 'input[id*="gvJEItem" i][id*="DXEditor11" i]' },
        ],
        timeout: 3000,
      });
      await drInput.click();
      await drInput.fill(String(dr));
      await drInput.press('Tab');
    }

    if (cr != null) {
      const { locator: crInput } = await heal(f, {
        id: 'journalEntry.crInput',
        label: 'CR',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_JournalEntryDetail_cbpJournalEntry_cpnlJEItem_formJEItem_PC_0_gvJEItem_DXEditor12_I' },
          { type: 'css', value: 'input[id*="gvJEItem" i][id*="DXEditor12" i]' },
        ],
        timeout: 3000,
      });
      await crInput.click();
      await crInput.fill(String(cr));
      await crInput.press('Tab');
    }
  }

  /**
   * Fills the header Description and adds one line (account + dr/cr).
   * For multiple lines (JEP/JEPN each add two, one DR one CR), call
   * addLine() again directly, or pass
   * `lines: [{accountCode, dr}, {accountCode, cr}, ...]` instead of a
   * single accountCode/dr/cr set.
   */
  async createJournalEntry({ description, accountCode, dr, cr, lines }) {
    if (description) await this.fillHeader(description);
    if (accountCode || dr != null || cr != null) await this.addLine({ accountCode, dr, cr });
    if (Array.isArray(lines)) {
      for (const line of lines) await this.addLine(line);
    }
  }

  /**
   * Confirmed by Katalon's own JEN script — this does NOT save; it clears
   * the form back to a blank record, same behavior as Cash Sales's "New".
   * Kept for parity with the original test case, not as a persist step.
   */
  async clickNew() {
    const { newButton } = await this.fields();
    await newButton.click();
    await this.page.waitForTimeout(1000);
  }

  /** Confirmed by Katalon's own JEN script — returns to the Journal Entry list. */
  async clickBack() {
    const { backButton } = await this.fields();
    await backButton.click();
    await this.page.waitForTimeout(1000);
  }

  /** Confirmed via JEP's Object Repository — see postButton's comment in fields(). */
  async clickPost() {
    const { postButton } = await this.fields();
    await postButton.click();
    await this.page.waitForTimeout(1500);
  }

  /** Confirmed via JED's Object Repository — see saveDraftButton's comment in fields(). */
  async clickSaveDraft() {
    const { saveDraftButton } = await this.fields();
    await saveDraftButton.click();
    await this.page.waitForTimeout(1500);
  }

  /** Confirmed via JEPN's Object Repository — see postAndNewButton's comment in fields(). */
  async clickPostAndNew() {
    const { postAndNewButton } = await this.fields();
    await postAndNewButton.click();
    await this.page.waitForTimeout(1500);
  }

  /**
   * Clicks the "Journal Voucher" print button that JEP's Post opens in its
   * own iframe, same `input.nav.print_button` pattern already confirmed
   * for Cash Sales's GST report (see cashSalesPage.js's printReport()) —
   * reused as-is since Katalon's JEP script clicks the exact same-shaped
   * `input_Journal Voucher_nav print_button` object next. Returns the new
   * Page so the caller can assert on it directly.
   */
  async printReport() {
    const p = this.page;
    const printSelector = 'input.nav.print_button, input[title="Print from Adobe Reader" i]';

    // BUG FIXED (2026-07-27): widened from findFrame()'s default 10s —
    // confirmed live to be too tight when this runs deep into the full
    // ~100-test suite under sustained load, not just standalone. See
    // cashSalesPage.js's printReport() for the full incident writeup.
    const reportFrame = await findFrame(p, async (frame) => {
      const btn = frame.locator(printSelector);
      return (await btn.count()) > 0 && (await btn.first().isVisible().catch(() => false));
    }, { timeout: 30000 });
    if (!reportFrame) {
      await p.screenshot({ path: 'test-results/debug-je-report-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Journal Voucher report\'s print button — the report may not have ' +
        'finished rendering yet. Saved test-results/debug-je-report-not-found.png for inspection.'
      );
    }

    const [reportPage] = await Promise.all([
      p.context().waitForEvent('page', { timeout: 10000 }),
      reportFrame.locator(printSelector).first().click(),
    ]);
    await reportPage.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
    return reportPage;
  }

  /** Same validity check as cashSalesPage.js's isReportPageValid(). */
  isReportPageValid(reportPage) {
    return /FastReport\.Export\.axd/i.test(reportPage.url());
  }

  /** Same visible-only filtering rationale as the other page objects. */
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

module.exports = { JournalEntryPage };
