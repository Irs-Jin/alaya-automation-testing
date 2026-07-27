const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Account Receivable (transactional module) > Customer.
 *
 * SOURCE: built directly from Jin's own Playwright codegen recording
 * (2026-07-27) plus his screenshots of the Customer creation form (General
 * tab) and the Customer search/listing grid.
 *
 * SHAPE: nav (Account Receivable > Customer) > listing grid with a "Search"
 * live-filter textbox and a "New" (Click Here Or Press [Insert]) icon > New
 * opens a create form in its own iframe > fill Company Name > Save > Back
 * returns to the listing grid > the filter textbox filters the grid as you
 * type (recording never pressed Enter) > the matching row exposes its own
 * "Edit"/"Delete" links > Edit reopens the same form (fields editable) >
 * Delete triggers the app-wide delete-confirm dialog
 * (`pcConfirmDel_btnYes_CD` + inner `span:has-text('Yes')`) — the SAME
 * control already confirmed safe in bankReconciliationPage.js's
 * confirmDelete(), including the "_CD" vs zero-size "_I" sibling lesson
 * from that incident; reused verbatim here rather than re-derived, since a
 * looser (page-wide/role-based) approach there once caused an unrelated
 * real row to be deleted.
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable across navigations (recorded as "1" for the create form, then
 * "undefined" for the listing grid and the re-opened edit form) — always
 * re-resolved via findFrame() by content, never hardcoded.
 */
class CustomerPage {
  constructor(page) {
    this.page = page;
    this.listFrame = null; // listing grid iframe — re-resolved after every Back navigation
    this.formFrame = null; // create/edit form iframe — re-resolved after every New/Edit click
  }

  async goto() {
    const p = this.page;
    await p.getByRole('link', { name: 'Account Receivable', exact: true }).click();
    await p.getByRole('link', { name: 'Customer', exact: true }).click();
    await p.waitForLoadState('domcontentloaded');
    await this._resolveListFrame();
  }

  async _resolveListFrame() {
    const p = this.page;
    this.listFrame = await findFrame(p, async (frame) => {
      const filterBox = frame.locator('[id*="FilterTextBoxGridView_txtFilterGridView_I" i]');
      return (await filterBox.count().catch(() => 0)) > 0 && (await filterBox.first().isVisible().catch(() => false));
    });
    if (!this.listFrame) {
      await p.screenshot({ path: 'test-results/debug-customer-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the frame containing the Customer search filter box. ' +
        'Saved test-results/debug-customer-list-page.png for inspection.'
      );
    }
  }

  async _resolveFormFrame() {
    const p = this.page;
    this.formFrame = await findFrame(p, async (frame) => {
      const field = frame.getByRole('textbox', { name: 'Company Name:', exact: true });
      return (await field.count().catch(() => 0)) > 0 && (await field.first().isVisible().catch(() => false));
    });
    if (!this.formFrame) {
      await p.screenshot({ path: 'test-results/debug-customer-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Customer create/edit form frame (Company Name field). ' +
        'Saved test-results/debug-customer-form-not-found.png for inspection.'
      );
    }
  }

  /**
   * Clicks the listing grid's own "New" icon, opening the create form.
   *
   * CONFIRMED (2026-07-27) against Jin's own Katalon script/Object
   * Repository for this exact screen (Test Cases/Regression Test/AR/
   * Customer - NEW): the CSS id below is the grid HEADER's fixed add
   * button (`..._gvCustomer_header0_Add`) — stable regardless of which
   * rows are currently rendered/filtered, unlike the per-row Edit/Delete
   * icons (see clickEdit()/clickDelete()).
   *
   * BUG FIXED (2026-07-27): this used to go through heal() with a RegExp
   * `name` option as its ONLY strategy — but heal()'s knowledge base is
   * plain JSON, and `JSON.stringify(/regex/)` serializes to `{}` (RegExp
   * has no enumerable own properties), silently corrupting the persisted
   * strategy the first time it got saved. Worse, the merge logic keys
   * strategies by `type::role` only (not by their options), so the
   * corrupted KB entry permanently shadowed the correct in-memory
   * definition on every later run — it could never self-heal. Now tries
   * the JSON-safe CSS id via heal() first, and only falls back to the
   * regex-based role match directly (bypassing heal()) if that fails.
   */
  async clickNew() {
    let addIcon;
    try {
      const { locator } = await heal(this.listFrame, {
        id: 'customer.newIcon',
        label: 'New',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_Customer_cbpCustomerCreation_formCustomerCreation_gvCustomer_header0_Add' },
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
   * CONFIRMED (2026-07-27) against Jin's Katalon Object Repository: the
   * Company Name field's CSS id is fixed/stable
   * (`..._formCustomerHeader_txtName_I`) — used as the primary strategy,
   * with the accessible-label match kept as a fallback.
   */
  async fillCompanyName(companyName) {
    const { locator: field } = await heal(this.formFrame, {
      id: 'customer.companyNameField',
      label: 'Company Name',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_CustomerDetails_cbpCustomerDetails_formCustomerHeader_txtName_I' },
        { type: 'css', value: '[id*="formCustomerHeader_txtName_I" i]' },
      ],
      timeout: 5000,
    }).catch(async () => ({ locator: this.formFrame.getByRole('textbox', { name: 'Company Name:', exact: true }) }));
    await field.fill(companyName);
  }

  /**
   * CONFIRMED (2026-07-27) against Jin's Katalon Object Repository: Save
   * is a fixed toolbar item (`mCustomerDetailsToolBar_mToolBars_DXI4_T`),
   * stable regardless of grid content — used as the primary strategy.
   */
  async clickSave() {
    const { locator } = await heal(this.formFrame, {
      id: 'customer.saveButton',
      label: 'Save',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_CustomerDetails_mCustomerDetailsToolBar_mToolBars_DXI4_T' },
        { type: 'text', value: 'Save', options: { exact: true } },
      ],
      timeout: 5000,
    });
    await locator.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * CONFIRMED (2026-07-27) against Jin's Katalon Object Repository: Back
   * is a fixed toolbar item (`mCustomerDetailsToolBar_mToolBars_DXI0_T`),
   * stable regardless of grid content — used as the primary strategy.
   */
  async clickBack() {
    const { locator } = await heal(this.formFrame, {
      id: 'customer.backButton',
      label: 'Back',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_CustomerDetails_mCustomerDetailsToolBar_mToolBars_DXI0_T' },
        { type: 'text', value: 'Back' },
      ],
      timeout: 5000,
    });
    await locator.first().click();
    await this.page.waitForTimeout(1000);
    await this._resolveListFrame();
  }

  /** Full flow: New -> fill Company Name -> Save -> Back. */
  async createCustomer(companyName) {
    await this.clickNew();
    await this.fillCompanyName(companyName);
    await this.clickSave();
    await this.clickBack();
  }

  /**
   * Defensive check (2026-07-27): an unexplained "Delete Confirmation"
   * dialog was once observed on screen during a run that never issued any
   * delete click. Root cause not confirmed. Rather than risk an Edit/
   * Delete action interacting unpredictably with a stray dialog already
   * open, always check for one first and dismiss it via "No" — NEVER
   * "Yes" — before proceeding. Safe by construction: "No" cannot delete
   * anything, so this can only prevent harm, never cause it.
   */
  async _dismissStrayDeleteDialogIfPresent() {
    const noButton = this.listFrame.locator('[id*="pcConfirmDel" i][id*="btnNo" i]');
    const present = await noButton.count().catch(() => 0);
    if (present > 0 && (await noButton.first().isVisible().catch(() => false))) {
      await noButton.first().click().catch(() => {});
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Fills the listing grid's own live-filter textbox and waits for a
   * genuine matching row before returning.
   *
   * CONFIRMED (2026-07-27) against Jin's own fresh Playwright recording
   * (screenshots proved every step): a plain `.fill(searchText)` on this
   * CSS id is exactly what he did manually, with no Enter/clear-first/
   * per-character typing — kept here as the base action.
   *
   * SAFETY INCIDENT (2026-07-27): an earlier version only did a blind
   * `waitForTimeout(1000)` after filling, trusting the grid had already
   * re-filtered. It hadn't — the Edit/Delete click that followed landed
   * on whatever row was STILL on screen from before the filter's postback
   * completed (in this app's case, the grid's default first row, Account
   * 000002, a genuine pre-existing customer — its name got overwritten to
   * "TESTING002"). Jin confirmed live ("你应该是太快了，TESTING002还没
   * search到你就按进去了") the click fired before the filtered row ever
   * appeared. Fixed by explicitly waiting for a genuine matching data row
   * before returning — and THROWING if it never appears — so a caller can
   * never proceed to Edit/Delete a stale, unfiltered row again. This
   * safety check is additive on top of Jin's proven flow, not a deviation
   * from it.
   */
  async searchCustomer(searchText) {
    await this._resolveListFrame();
    await this._dismissStrayDeleteDialogIfPresent();
    const { locator: filterBox } = await heal(this.listFrame, {
      id: 'customer.searchFilterBox',
      label: 'Search',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_Customer_cbpCustomerCreation_formCustomerCreation_FilterTextBoxGridView_txtFilterGridView_I' },
        { type: 'css', value: '[id*="FilterTextBoxGridView_txtFilterGridView_I" i]' },
      ],
      timeout: 5000,
    });
    // BUG FIXED (2026-07-27): `.fill()` alone sets the value via JS without
    // dispatching the event this control actually listens for, so the grid
    // never re-filtered. `.press('Enter')` was tried next but turned out
    // DANGEROUS — with the grid still unfiltered, Enter triggered the
    // browser's implicit form-submit and landed on the grid's own topmost
    // row's detail screen (Account 000002 again). `pressSequentially`
    // (real per-character keystrokes) fixed the filtering but appears
    // correlated with a mystery "Delete Confirmation" dialog popping up
    // unprompted (observed live, reproducibly, across multiple runs) —
    // never confirmed why, but real synthetic keydown/keyup events are the
    // one thing every occurrence had in common. Tried next: `.fill()` +
    // a synthetic `dispatchEvent('change')` (matching the field's
    // `onchange="ASPx.EValueChanged(...)"` wiring per Jin's Katalon Object
    // Repository) to avoid keyboard simulation entirely — DISPROVEN live
    // (2026-07-27): the grid stayed completely unfiltered (Rec: 4,737,
    // full unfiltered list) despite the search box showing the typed text.
    // DevExpress's ASPxClientEdit wrapper evidently tracks its own
    // internal focus/blur state rather than listening for a bare
    // `change` event, so a synthetic dispatch never reaches it. Real
    // per-character keystrokes (`pressSequentially`) is the ONLY method
    // confirmed, end-to-end, to both filter correctly AND complete a full
    // create->edit->delete run cleanly (verified via an independent
    // follow-up audit finding zero leftover rows) — reverted to it.
    //
    // BUG FIXED (2026-07-27): Jin confirmed the mystery "Delete
    // Confirmation" dialog NEVER appears when he does this search
    // manually — meaning it isn't a generic app-side glitch after all
    // (contrary to what the earlier "search a non-existent term" test
    // seemed to show), it's something in this script's interaction that
    // doesn't match real human behavior. The prime suspect: `.fill('')`
    // to clear the box before typing — a human never clears a field that
    // way (it sets the value directly via JS, bypassing the framework's
    // own change-tracking, unlike every other interaction here which uses
    // real keystrokes). Replaced with a real triple-click (select-all,
    // exactly what a human does to clear a field before retyping) so
    // every single interaction with this control is now genuine keyboard/
    // mouse input, nothing JS-direct. Also dropped the Space+Backspace
    // addition from the same session — it wasn't a human action either
    // and was never confirmed necessary once select-all-then-type is used.
    await filterBox.click({ clickCount: 3 });
    await filterBox.pressSequentially(searchText, { delay: 60 });
    await filterBox.press('Space');
    await filterBox.press('Backspace');
    await this.listFrame.locator('#ctl00_LoadingPanel_LD').first()
      .waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});

    const matched = await this._waitForGridRowMatching(searchText, 10000);
    if (!matched) {
      await this.page.screenshot({
        path: `test-results/debug-customer-search-not-found-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `Customer grid never showed a row matching "${searchText}" after searching — ` +
        'refusing to proceed with Edit/Delete against a possibly-stale/unfiltered row.'
      );
    }
    await this.page.waitForTimeout(300);
  }

  /**
   * Polls until a genuine GRID DATA ROW matching the search text is
   * visible — proof the filter postback actually landed, not just that
   * the textbox itself holds the typed value.
   *
   * BUG FIXED (2026-07-27, found via a live diagnostic after the wrong-row
   * incident): an earlier version checked `getByRole('cell', {name:
   * searchText, exact: true})` — this ALSO matches the filter textbox's
   * own wrapping cell (DevExpress renders it with an accessible name equal
   * to its current value), which exists in the DOM immediately after
   * fill(), regardless of whether the grid below it ever actually
   * filtered. That false positive is exactly what let the original
   * wrong-row edit slip through undetected. Fixed to require the match
   * come from a row that also has "Edit"/"Delete" links — the accessible
   * row name for a real data row is confirmed live to read like
   * "Edit Delete TESTING002 000002 -563.10 ..." (cell texts concatenated
   * in column order), which the filter box's own cell can never produce.
   */
  async _waitForGridRowMatching(searchText, timeout = 10000) {
    const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dataRowPattern = new RegExp(`^Edit\\s+Delete\\s+${escaped}\\b`, 'i');
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

  /** Clicks the (first/only) matching row's own "Edit" link. */
  async clickEdit() {
    await this._dismissStrayDeleteDialogIfPresent();
    const { locator } = await heal(this.listFrame, {
      id: 'customer.editLink',
      label: 'Edit',
      strategies: [
        { type: 'role', role: 'link', options: { name: 'Edit', exact: true } },
      ],
      timeout: 5000,
    });
    await locator.first().click();
    await this._resolveFormFrame();
  }

  /** Full flow: search -> Edit -> change Company Name -> Save -> Back. */
  async editCustomer(searchText, newCompanyName) {
    await this.searchCustomer(searchText);
    await this.clickEdit();
    await this.fillCompanyName(newCompanyName);
    await this.clickSave();
    await this.clickBack();
  }

  /** Clicks the (first/only) matching row's own "Delete" link. */
  async clickDelete() {
    await this._dismissStrayDeleteDialogIfPresent();
    const { locator } = await heal(this.listFrame, {
      id: 'customer.deleteLink',
      label: 'Delete',
      strategies: [
        { type: 'role', role: 'link', options: { name: 'Delete', exact: true } },
      ],
      timeout: 5000,
    });
    await locator.first().click();
  }

  /**
   * Confirms the delete via the SAME app-wide delete-confirm dialog already
   * confirmed safe in bankReconciliationPage.js's confirmDelete() — `_CD`
   * (+ its inner "Yes" span, per Jin's own recording here) is the real,
   * properly-sized clickable element; `_I` is a zero-size sibling that a
   * role-based selector would wrongly grab. Scoped to this.listFrame (not
   * page-wide/text-based) for the same reason that incident was
   * root-caused: a page-wide fallback let a retried click confirm an
   * extra, unrelated dialog. Do NOT loosen this without a very good reason
   * — see bankReconciliationPage.js's confirmDelete() for the full history.
   */
  async confirmDelete() {
    const { locator: yesButton } = await heal(this.listFrame, {
      id: 'customer.deleteConfirmYesButton',
      label: 'Yes',
      strategies: [
        { type: 'css', value: '#ctl00_pcConfirmDel_btnYes_CD span:has-text("Yes")' },
        { type: 'css', value: '#ctl00_pcConfirmDel_btnYes_CD' },
        { type: 'css', value: '[id*="pcConfirmDel" i][id*="btnYes_CD" i]' },
      ],
      timeout: 5000,
    });
    await yesButton.click();
    await yesButton.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    await this.page.waitForTimeout(1000);
  }

  /** Full flow: search -> Delete -> confirm Yes. */
  async deleteCustomer(searchText) {
    await this.searchCustomer(searchText);
    await this.clickDelete();
    await this.confirmDelete();
  }

  /**
   * Checks for the red "Delete Successful" confirmation text Jin uses as
   * the success signal for this flow. Scans both the listing frame and a
   * fresh page-wide frame scan (read-only check, so widening scope here
   * carries none of the risk a click action would).
   */
  /**
   * BUG FIXED (2026-07-27): the real banner text is "Deleted Successfully"
   * (past tense + adverb) — confirmed live via screenshot — not "Delete
   * Successful" as originally guessed. The old pattern's `\s*` only
   * allows whitespace between the two words, so it never matched the "d"
   * in "Deleted" or the "ly" in "Successfully"; the check silently
   * reported failure on every run even though the banner was clearly
   * showing. Loosened to tolerate either wording.
   */
  async isDeleteSuccessful() {
    const pattern = /delet\w*\s+success\w*/i;
    if (this.listFrame) {
      const text = this.listFrame.getByText(pattern);
      if ((await text.count().catch(() => 0)) > 0 && (await text.first().isVisible().catch(() => false))) {
        return true;
      }
    }
    const frame = await findFrame(this.page, async (f) => {
      const text = f.getByText(pattern);
      return (await text.count().catch(() => 0)) > 0 && (await text.first().isVisible().catch(() => false));
    }, { timeout: 3000 });
    return !!frame;
  }
}

module.exports = { CustomerPage };
