const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for General Ledger (transactional module, #sub2) > Bank
 * Reconciliation. NOT the same as `generalLedgerReportPage.js`'s "Bank
 * Reconciliations" REPORT (Reports category, #sub13, read-only) — this is
 * the actual transactional screen where bank statement dates get added
 * and removed.
 *
 * SOURCE: built directly from Jin's own Playwright codegen recording
 * (2026-07-26) plus his screenshots of the live before/after state — the
 * most trustworthy source used in this module so far (see the reflective
 * discussion on Katalon-vs-codegen-vs-screenshot reliability). Every
 * selector below is taken as CONFIRMED from that recording, one rung
 * above the other GL screens' Katalon-first-guess starting point — but
 * per the Cash Book Payment lesson (a codegen recording can still
 * silently encode a wrong click, e.g. the CASH/MASTER mix-up), this was
 * still verified with a live run before being marked confirmed here.
 *
 * SHAPE: nav > master-detail grid (bank accounts as parent rows, each
 * expandable to show its own bank-statement-date sub-grid) > expand a
 * bank account row > click its own "Add" icon > a "Select Bank Statement
 * Date" dialog defaults to the last day of next month and just needs
 * "Yes" (Katalon-style validation message: "Bank Statement Date must set
 * to last day of the month") > Save > Back (returns to the collapsed
 * master list) > re-expand the same row (iframe name changes here —
 * "93" then "undefined" in the recording — confirms the usual
 * unstable-iframe-name pattern, handled via findFrame() as always,
 * never hardcoded) > click the new row's own delete icon
 * (`gvBankReconDTL_DXCBtn2`) > confirm via a generic delete-confirm
 * dialog's own "Yes" button (`pcConfirmDel_btnYes_CD` — this dialog id
 * looks like a REUSABLE app-wide delete-confirmation control, not
 * specific to this screen; worth trying first on any other screen that
 * needs a delete-confirm step).
 *
 * The row's accessible name is literally "Expand {Account No.} {Description}"
 * (e.g. "Expand 310-0001 MAYBANK") — DevExpress applies this as the whole
 * row's aria-label for its own expand/collapse toggle; `expandBankAccount()`
 * takes that full label as a parameter rather than hardcoding "MAYBANK".
 */
class BankReconciliationPage {
  constructor(page) {
    this.page = page;
    this.listFrame = null; // resolved by goto(), re-resolved by expandBankAccount() since the iframe name is unstable across navigation
  }

  async goto() {
    const p = this.page;

    const link = p.getByRole('link', { name: 'Bank Reconciliation', exact: true });
    if (!(await link.isVisible().catch(() => false))) {
      await p.getByRole('link', { name: 'General Ledger', exact: true }).click();
    }
    await link.click();
    await p.waitForLoadState('domcontentloaded');

    this.listFrame = await findFrame(p, async (frame) => {
      const row = frame.getByRole('row', { name: /^Expand /i });
      return (await row.count()) > 0 && (await row.first().isVisible().catch(() => false));
    });
    if (!this.listFrame) {
      await p.screenshot({ path: 'test-results/debug-bank-reconciliation-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the frame containing a bank account row on the Bank Reconciliation list page. ' +
        'Saved test-results/debug-bank-reconciliation-list-page.png for inspection.'
      );
    }
  }

  /**
   * Expands (or re-expands, after Back) a bank account's row to reveal its
   * own bank-statement-date sub-grid. Re-resolves `this.listFrame` each
   * time since the iframe name is confirmed unstable across a Back
   * navigation (recorded as "93" then "undefined" for the same content).
   *
   * IDEMPOTENT — same reasoning as stockValuePage.js's goto() fix: this
   * expand toggle would COLLAPSE an already-expanded row on a second
   * call (e.g. calling this again right after a delete, with no Back
   * navigation in between), which would silently break any record-count
   * check made right after. Only clicks the toggle if the sub-grid isn't
   * already visible.
   *
   * BUG FIXED (live run, 2026-07-26): once expanded, this row's
   * accessible name flips from "Expand {accountLabel}" to
   * "Collapse {accountLabel}" (standard expand/collapse ARIA pattern) —
   * an earlier version of this method only ever searched for the
   * "Expand " prefix, so calling it a second time while already expanded
   * (exactly the idempotent case this method exists to handle) failed
   * to even find the row, let alone recognize it was already expanded.
   * Matches on the account label alone now, tolerating either state.
   * @param {string} accountLabel - e.g. "310-0001 MAYBANK", matching the
   *   row's full accessible name ("Expand 310-0001 MAYBANK" or
   *   "Collapse 310-0001 MAYBANK" depending on current state).
   */
  async expandBankAccount(accountLabel) {
    const p = this.page;
    const rowNamePattern = new RegExp(`^(Expand|Collapse) ${accountLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

    this.listFrame = await findFrame(p, async (frame) => {
      const row = frame.getByRole('row', { name: rowNamePattern });
      return (await row.count()) > 0 && (await row.first().isVisible().catch(() => false));
    });
    if (!this.listFrame) {
      await p.screenshot({ path: 'test-results/debug-bank-reconciliation-expand-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        `Could not find the row "${accountLabel}" on the Bank Reconciliation list page. ` +
        'Saved test-results/debug-bank-reconciliation-expand-not-found.png for inspection.'
      );
    }

    const alreadyExpanded = await this.listFrame.getByText(/^Rec:\s*\d+/i).first().isVisible().catch(() => false);
    if (!alreadyExpanded) {
      const row = this.listFrame.getByRole('row', { name: rowNamePattern });
      await row.getByRole('img').click();
      await p.waitForTimeout(500);
    }
  }

  /** Reads the "Rec: N" count under the currently-expanded account's sub-grid. */
  async getRecordCount() {
    const text = await this.listFrame.getByText(/^Rec:\s*\d+/i).first().innerText().catch(() => '');
    const match = text.match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
  }

  /** Clicks the expanded row's own "Add" icon, opening the Bank Statement Date dialog. */
  async clickAddStatement() {
    const { locator: addIcon } = await heal(this.listFrame, {
      id: 'bankReconciliation.addIcon',
      label: 'Add',
      strategies: [
        { type: 'role', role: 'img', options: { name: 'Add', exact: true } },
      ],
      timeout: 3000,
    });
    await addIcon.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Confirms the "Select Bank Statement Date" dialog with its default
   * date (last day of next month) via "Yes" — Jin's recording never
   * changes the date, just accepts the default.
   */
  async confirmBankStatementDate() {
    const { locator: yesButton } = await heal(this.listFrame, {
      id: 'bankReconciliation.dateDialogYesButton',
      label: 'Yes',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_BankReconciliation1_cpnlBankRecon_pcBRBankStatementDate_btnBRBankStatementDateYes_CD' },
        { type: 'css', value: '[id*="BRBankStatementDateYes" i]' },
        { type: 'text', value: 'Yes', options: { exact: true } },
      ],
      timeout: 5000,
    });
    await yesButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Detects the "The Bank Reconciliation entry ... is already exist"
   * error dialog (confirmed live, 2026-07-26) that appears when the date
   * dialog's default date already has an entry (e.g. a leftover from an
   * earlier test run) — a genuine business validation, not a selector
   * bug. Dismisses it via its own "OK" button if present. Returns true
   * if the error was shown (and dismissed), false otherwise.
   *
   * BUG FIXED (live run, 2026-07-26): `this.page.getByText(...)` only
   * searches the TOP-LEVEL page, never descends into iframes — and this
   * dialog renders inside the content iframe (same as nearly everything
   * else in this app). The first version of this check always returned
   * false, so the error dialog silently blocked `clickSave()` right
   * after. Fixed to scan `this.listFrame` (and fall back to a fresh
   * findFrame() scan) instead of the bare page.
   */
  async dismissAlreadyExistsError() {
    const p = this.page;
    const findIn = async (frame) => {
      const errorText = frame.getByText(/is already exist/i);
      return (await errorText.count().catch(() => 0)) > 0 && (await errorText.first().isVisible().catch(() => false));
    };

    let targetFrame = null;
    if (this.listFrame && (await findIn(this.listFrame))) {
      targetFrame = this.listFrame;
    } else {
      targetFrame = await findFrame(p, findIn, { timeout: 1500 });
    }
    if (!targetFrame) return false;

    const okButton = targetFrame.getByRole('button', { name: 'OK', exact: true });
    await okButton.first().click().catch(() => {});
    await p.waitForTimeout(500);
    return true;
  }

  async clickSave() {
    const { locator: saveButton } = await heal(this.listFrame, {
      id: 'bankReconciliation.saveButton',
      label: 'Save',
      strategies: [
        { type: 'text', value: 'Save', options: { exact: true } },
      ],
      timeout: 3000,
    });
    await saveButton.click();
    await this.page.waitForTimeout(1000);
  }

  async clickBack() {
    const { locator: backButton } = await heal(this.listFrame, {
      id: 'bankReconciliation.backButton',
      label: 'Back',
      strategies: [
        { type: 'text', value: 'Back', options: { exact: true } },
      ],
      timeout: 3000,
    });
    await backButton.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Deletes the (newest) bank statement row via its own delete icon —
   * confirmed live as a shared inline-template button (`DXCBtn2`), same
   * "one template reused across rows" pattern already established
   * elsewhere in this app, not a position-specific id.
   */
  async clickDeleteStatement() {
    const { locator: deleteButton } = await heal(this.listFrame, {
      id: 'bankReconciliation.deleteButton',
      label: 'Delete statement row',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_BankReconciliation1_cpnlBankRecon_formBankRecon_gvBankRecon_dxdt0_gvBankReconDTL_DXCBtn2' },
        { type: 'css', value: '[id*="gvBankReconDTL" i][id*="DXCBtn2" i]' },
      ],
      timeout: 3000,
    });
    await deleteButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Confirms the delete via a generic delete-confirmation dialog
   * (`pcConfirmDel_btnYes_CD`) — this id looks app-wide/reusable, not
   * specific to Bank Reconciliation; worth trying first if another screen
   * ever needs a delete-confirm step.
   *
   * SAFETY INCIDENT (2026-07-26): an earlier version of this method
   * scoped its `heal()` call to the whole page (not a frame) and kept a
   * page-wide `text: 'Yes'` fallback. During a live cleanup run, this
   * caused Playwright's own click-retry mechanism to end up confirming
   * TWO delete dialogs in a row instead of one — deleting an extra,
   * legitimate row (30/06/2026) that was never meant to be touched.
   * Root cause not fully nailed down (likely: this dialog's id gets
   * reused for the NEXT row's confirm dialog quickly enough that a
   * retried click from an unstable first attempt lands on the second
   * dialog instead of erroring out). Fixed defensively: scope to
   * `this.listFrame`, drop the ambiguous page-wide text fallback, and
   * explicitly wait for the dialog to actually disappear afterward
   * (proof the click registered exactly once) rather than a blind
   * `waitForTimeout`. Given the blast radius of getting this wrong
   * (deleting real rows), do NOT loosen this back to a page-wide/text
   * fallback without a very good reason.
   */
  async confirmDelete() {
    // BUG FIXED THREE TIMES (live run, 2026-07-26) — root-caused via a
    // live DOM dump, not guessed a 4th time: this button actually exists
    // as THREE sibling elements sharing the "Yes" label —
    // `..._btnYes_CD` (a table-cell, proper size ~88x31px, the real
    // clickable surface), `..._btnYes_I` (the underlying `<input
    // type="button">`, zero width/height — invisible despite
    // visibility:visible, and the one `getByRole('button', {name:'Yes'})`
    // matches, since only the raw input carries an implicit button role),
    // and `..._btnYes` (a wrapping table). `_CD` was the ORIGINAL correct
    // guess; it only looked wrong because one early failed attempt
    // poisoned its `knowledge-base.json` entry with a failure that
    // outranked it against a later, wrongly-matching role-based
    // "fix" — see the general-ledger-module memory for the full chain of
    // wrong turns. `_CD` is confirmed via live DOM inspection to be the
    // properly-sized, genuinely clickable element; kept as the ONLY
    // primary strategy — do not reintroduce `getByRole('button', ...)`
    // here, it reliably grabs the wrong zero-size sibling.
    const { locator: yesButton } = await heal(this.listFrame, {
      id: 'bankReconciliation.deleteConfirmYesButton',
      label: 'Yes',
      strategies: [
        { type: 'css', value: '#ctl00_pcConfirmDel_btnYes_CD' },
        { type: 'css', value: '[id*="pcConfirmDel" i][id*="btnYes_CD" i]' },
      ],
      timeout: 5000,
    });
    await yesButton.click();
    await yesButton.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    await this.page.waitForTimeout(1000);
  }

  /**
   * The Add dialog's default Bank Statement Date is confirmed live to be
   * the last day of the CURRENT calendar month (not "next month" as an
   * earlier version of this file guessed from the validation message
   * alone — e.g. on 26 July 2026 it defaulted to 31/07/2026). Computed
   * locally rather than read from the dialog itself, since deleting a
   * leftover needs to happen BEFORE opening Add at all (Jin: "need
   * delete first").
   */
  _defaultBankStatementDateText() {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const dd = String(lastDay.getDate()).padStart(2, '0');
    const mm = String(lastDay.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${lastDay.getFullYear()}`;
  }

  /**
   * Cleans up BEFORE attempting Add: if a row for the date the Add
   * dialog would default to already exists (a leftover from an earlier
   * run — this account's repeated blocker), delete it first. Reuses
   * clickDeleteStatement()/confirmDelete() as-is since that pair is
   * confirmed to act on whichever row is topmost/newest, which is where
   * this leftover always sits (most recent date, sorted first).
   */
  async deleteExistingRowForDefaultDateIfPresent() {
    const defaultDate = this._defaultBankStatementDateText();
    const existingRow = this.listFrame.getByRole('row', { name: new RegExp(defaultDate.replace(/\//g, '\\/')) });
    if ((await existingRow.count().catch(() => 0)) > 0 && (await existingRow.first().isVisible().catch(() => false))) {
      await this.clickDeleteStatement();
      await this.confirmDelete();
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Full flow: expand -> delete any leftover for the default date first
   * (Jin: "need delete first") -> Add -> confirm date -> Save -> Back.
   * The reactive dismissAlreadyExistsError() check is kept as a
   * defensive fallback in case the app's real "next expected date" logic
   * ever diverges from the plain calendar computation above (e.g. it's
   * actually based on the last properly-RECONCILED entry, not just the
   * calendar month) — but the pre-delete should make that path
   * unnecessary in the common case. Returns `{ countBefore, created }`.
   */
  async addBankStatement(accountLabel) {
    await this.expandBankAccount(accountLabel);
    await this.deleteExistingRowForDefaultDateIfPresent();
    const countBefore = await this.getRecordCount();
    await this.clickAddStatement();
    await this.confirmBankStatementDate();

    const alreadyExisted = await this.dismissAlreadyExistsError();
    if (alreadyExisted) {
      await this.clickBack().catch(() => {});
      return { countBefore, created: false };
    }

    await this.clickSave();
    await this.clickBack();
    return { countBefore, created: true };
  }

  /** Full flow: re-expand -> delete the (newest) row -> confirm. */
  async deleteLatestStatement(accountLabel) {
    await this.expandBankAccount(accountLabel);
    await this.clickDeleteStatement();
    await this.confirmDelete();
  }
}

module.exports = { BankReconciliationPage };
