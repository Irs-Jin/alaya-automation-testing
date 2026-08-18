const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for the "Reports > Inventory" CATEGORY (the #sub13 nav
 * entry) — covers any report catalog entry within it, not just one
 * report. Same shape as `generalLedgerReportPage.js` /
 * `accountPayableReportPage.js` / `accountReceivableReportPage.js` (the
 * SAME underlying `ReportFrameWork1` reports framework, just a different
 * catalog and category link). Fourth category to reuse this exact shape.
 *
 * Built from Jin's screenshot of the Inventory report catalog (no
 * per-report "Reports Format" dialog screenshot or codegen recording yet)
 * — templateName defaults below are UNCONFIRMED GUESSES matching the
 * catalog name, following the majority pattern seen across the other
 * three categories. Given the Account Payable/Receivable categories'
 * recurring lesson, expect some of these to need correcting from a live
 * failure screenshot — don't assume a guess is right before seeing it
 * pass.
 *
 * The one call sequence for every report in this category (same as the
 * other three): `goto(name) -> viewGrid() -> previewReport(value) ->
 * printReport()`. `viewGrid()`/`previewReport()`'s self-skip behavior is
 * inherited as-is.
 */
class InventoryReportPage {
  constructor(page) {
    this.page = page;
    this.catalogFrame = null; // resolved by goto()
    this.reportFrame = null; // resolved by goto()
  }

  /**
   * @param {string} reportName - the catalog entry to click into (e.g.
   *   "Stock Movement", "Stock Expiry Listing").
   */
  async goto(reportName) {
    const p = this.page;

    const reportsLink = p.getByRole('link', { name: 'Reports', exact: true });
    await reportsLink.click();
    // Scoped to the Reports fold's own submenu container to disambiguate
    // from any other "Inventory" link elsewhere in the nav (e.g. the
    // top-level Inventory MODULE, distinct from the Reports > Inventory
    // CATEGORY).
    //
    // BUG FIXED (2026-08-14): a hardcoded "#sub13" worked for the account
    // this suite was originally built against, but confirmed live to NOT
    // exist for a different account (yew/qa3) — this app assigns the
    // submenu's container id dynamically per session/company (it was
    // "#sub174" here). The id always matches whatever the "Reports" link's
    // own href points to, so read that at runtime instead of assuming a
    // fixed constant — same "resolve by relationship, not a guessed value"
    // philosophy already used for iframes in this repo.
    const reportsSubmenuId = (await reportsLink.getAttribute('href')).replace('#', '');
    await p.locator(`#${reportsSubmenuId}`).getByRole('link', { name: 'Inventory', exact: true }).click();

    // Confirmed live (2026-07-27, Sales category): a plain substring match
    // (hasText) can land on the WRONG catalog entry when one name is a
    // substring of another (e.g. "Inventory Item Consolidate" is a
    // substring of "Inventory Item Consolidate (without Cost)"). Prefer
    // an exact text match scoped to the catalog's <span> tiles (a
    // page-wide getByText(exact:true) risks matching an unrelated hidden
    // <input> elsewhere in the frame with the same exact value/title);
    // fall back to substring only if no exact match exists.
    const escapedName = reportName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exactPattern = new RegExp(`^${escapedName}$`);
    const findCatalogItem = (frame) => ({
      exact: frame.locator('span').filter({ hasText: exactPattern }),
      loose: frame.locator('span').filter({ hasText: reportName }),
    });

    this.catalogFrame = await findFrame(p, async (frame) => {
      const { exact, loose } = findCatalogItem(frame);
      if ((await exact.count().catch(() => 0)) > 0 && (await exact.first().isVisible().catch(() => false))) {
        return true;
      }
      return (await loose.count().catch(() => 0)) > 0 && (await loose.first().isVisible().catch(() => false));
    });
    if (!this.catalogFrame) {
      await p.screenshot({ path: 'test-results/debug-inventory-report-catalog-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        `Could not find "${reportName}" in the report catalog after clicking Reports > Inventory. ` +
        'Saved test-results/debug-inventory-report-catalog-not-found.png for inspection.'
      );
    }
    const { exact: exactItem, loose: looseItem } = findCatalogItem(this.catalogFrame);
    if (await exactItem.count().catch(() => 0)) {
      await exactItem.first().click();
    } else {
      await looseItem.first().click();
    }

    this.reportFrame = await findFrame(p, async (frame) => {
      // Confirmed live (2026-07-27, Stock Movement): unlike General
      // Ledger/Account Payable/Account Receivable (all "ReportFrameWork1"),
      // this category's shared control is named "ReportFrameWorkInventory"
      // — a suffix match generalizes across whatever this framework is
      // named per category instead of hardcoding one category's prefix.
      const byId = frame.locator('[id$="_cbpReport_cbpReportFramework_formReportFramework_btnPrint_CD"]');
      if ((await byId.count().catch(() => 0)) > 0 && (await byId.first().isVisible().catch(() => false))) {
        return true;
      }
      const byRole = frame.getByRole('button', { name: 'Preview Report' });
      return (await byRole.count().catch(() => 0)) > 0 && (await byRole.first().isVisible().catch(() => false));
    }, { timeout: 20000 });
    if (!this.reportFrame) {
      await p.screenshot({ path: 'test-results/debug-inventory-report-runtime-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        `Could not find the report runtime frame after clicking into the "${reportName}" report. ` +
        'Saved test-results/debug-inventory-report-runtime-not-found.png for inspection.'
      );
    }
  }

  /** Same DevExpress loading-overlay lesson as the other three categories. */
  async _waitForLoadingPanelHidden(timeout = 15000) {
    await this.reportFrame.locator('#ctl00_LoadingPanel_LD').first()
      .waitFor({ state: 'hidden', timeout }).catch(() => {});
  }

  /**
   * Same "Filter By Selection" quirk as Account Receivable's Customer
   * Statement Balance — some report fields (Warehouse, Item, ...) default
   * to "Filter By Selection" with an empty Selection grid. Self-skips if
   * this report's field isn't in that state.
   *
   * Per Jin (2026-07-27, Stock Aging): select just ONE row, not "Select
   * All" — ticking every row turned Stock Aging into a multi-minute
   * cross-warehouse aggregation (confirmed live: previewReport()'s click
   * alone took over 2 minutes under load, still not the report's own
   * rendering time). A single row's checkbox (`DXSelBtn0_D`, row 0) is
   * enough to satisfy the required-field validation and keeps the report
   * fast.
   *
   * CASE MISMATCH LESSON (Warehouse specifically): the real id is
   * "..._cbWareHouse_glWarehouse_B-1Img" — capital H in "WareHouse" but
   * lowercase h in "glWarehouse". A first guess assuming consistent
   * casing ("cbWarehouse_glWarehouse") silently matched nothing, so this
   * no-op'd, View Grid ran with no warehouse selected, and the app threw
   * a blocking "Please select Warehouse." alert — confirmed via a live
   * DOM dump. Selectors below use case-insensitive suffix matches to
   * avoid relying on exact casing.
   *
   * @param {string} glFieldName - the internal grid-lookup field name,
   *   e.g. "Warehouse" or "Item" (used as "_gl${glFieldName}_B-1Img" etc).
   */
  async _selectFirstRowInFilterBySelection(glFieldName) {
    const f = this.reportFrame;
    const openButton = f.locator(`[id$="_gl${glFieldName}_B-1Img" i]`);
    const present = await openButton.count().catch(() => 0);
    if (!present || !(await openButton.first().isVisible().catch(() => false))) {
      return; // this report's field defaults to ALL — nothing to do
    }

    const { locator } = await heal(f, {
      id: `inventoryReport.${glFieldName.toLowerCase()}SelectionDropdownButton`,
      label: `${glFieldName} Selection dropdown`,
      strategies: [
        { type: 'css', value: `[id$="_gl${glFieldName}_B-1Img" i]` },
      ],
      timeout: 3000,
    });
    await locator.click();
    // Confirmed live (2026-07-27, Stock Card): the Selection grid shows a
    // brief loading state right after the dropdown opens (it's fetching
    // the row list, e.g. 300 items across 38 pages for Item) — clicking
    // the first-row checkbox too fast lands before the grid has actually
    // populated. Wait for the loading panel to clear before searching.
    await this._waitForLoadingPanelHidden(5000);
    await this.page.waitForTimeout(1000);

    const { locator: firstRowCheckbox } = await heal(f, {
      id: `inventoryReport.${glFieldName.toLowerCase()}SelectionFirstRow`,
      label: `Select first ${glFieldName} row`,
      strategies: [
        { type: 'css', value: `[id$="_gl${glFieldName}_DDD_gv_DXSelBtn0_D" i]` },
      ],
      timeout: 8000,
    });
    await firstRowCheckbox.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    await firstRowCheckbox.click();
    await this.page.waitForTimeout(500);
    // Per Jin: ticking the row alone leaves the Selection dropdown open —
    // the next step then has to contend with that still-open overlay.
    // CONFIRMED REGRESSION (Sales category): pressing Escape here was
    // interpreted by this DevExpress control as "cancel", discarding the
    // tick and triggering a "Please Select ..." validation error —
    // clicking the same toggle button again to close it instead
    // preserves the checked state.
    await locator.click().catch(() => {});
    await this.page.waitForTimeout(500);
  }

  async selectFirstWarehouseIfNeeded() {
    return this._selectFirstRowInFilterBySelection('Warehouse');
  }

  /**
   * Same shape as selectFirstWarehouseIfNeeded() but for the ITEM field
   * (confirmed live 2026-07-27, Stock Card: Item=ALL alone — even with
   * just one warehouse already selected — was still too heavy; per Jin,
   * switch Item to "Filter By Selection" and pick a handful of items too).
   */
  async selectFirstItemIfNeeded() {
    return this._selectFirstRowInFilterBySelection('Item');
  }

  /**
   * Some reports (confirmed live 2026-07-27, Stock Card) default a field
   * to a plain "ALL" combo (`cb${fieldName}_Filter_I`) rather than
   * already being in "Filter By Selection" mode — per Jin, switching this
   * combo to "Filter By Selection" and then picking just one row (via
   * _selectFirstRowInFilterBySelection() right after) keeps a heavy
   * report fast instead of scanning everything. Self-skips if this
   * report's field isn't this ALL/Filter combo shape, or if it's already
   * been switched to something other than "ALL".
   *
   * @param {string} fieldName - e.g. "Warehouse" or "Item" (used as
   *   "_cb${fieldName}_Filter_I").
   */
  async _switchFieldToFilterBySelectionIfAll(fieldName) {
    const f = this.reportFrame;
    const filterCombo = f.locator(`[id$="_cb${fieldName}_Filter_I" i]`);
    const present = await filterCombo.count().catch(() => 0);
    if (!present) return; // this report's field isn't this ALL/Filter combo shape

    const currentValue = await filterCombo.first().inputValue().catch(() => '');
    if (currentValue.trim().toUpperCase() !== 'ALL') return; // not in the ALL state — leave it alone

    await filterCombo.first().click();
    // Scoped to this field's own dropdown container — with more than one
    // ALL/Filter combo on the page (e.g. Warehouse AND Item), a page-wide
    // getByText('Filter By Selection') can match a different, already-used
    // combo's leftover (hidden but still in the DOM) list item instead of
    // the one that just opened.
    const findOption = () => f.locator(`[id*="_cb${fieldName}_Filter_DDD" i]`)
      .getByText('Filter By Selection', { exact: true }).first();
    await findOption().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    // Confirmed live: selecting this option triggers its own postback,
    // which can detach the list item mid-click — Playwright reports that
    // as a click failure even though the selection itself often already
    // landed. Swallow the error and check the combo's actual resulting
    // value instead of assuming the click failed.
    await findOption().click({ timeout: 15000 }).catch(() => {});
    await this._waitForLoadingPanelHidden(8000);
    // Confirmed live (Sales category): reading the combo's value right
    // after the loading panel clears was too early — the postback that
    // updates the displayed value hadn't landed yet, causing a wasteful
    // full second attempt even though the first click had already
    // succeeded (measured cost: ~40s vs ~1s once this settle wait was
    // added).
    await this.page.waitForTimeout(2000);

    const valueAfterFirstAttempt = await filterCombo.first().inputValue().catch(() => '');
    if (valueAfterFirstAttempt.trim().toUpperCase() === 'ALL') {
      // Genuinely still unswitched — try once more.
      await filterCombo.first().click();
      await findOption().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      await findOption().click({ timeout: 15000 }).catch(() => {});
      await this._waitForLoadingPanelHidden(8000);
      await this.page.waitForTimeout(2000);
    }
    await this.page.waitForTimeout(500);
  }

  async switchWarehouseToFilterBySelectionIfAll() {
    return this._switchFieldToFilterBySelectionIfAll('Warehouse');
  }

  /** Same shape as switchWarehouseToFilterBySelectionIfAll() but for Item. */
  async switchItemToFilterBySelectionIfAll() {
    return this._switchFieldToFilterBySelectionIfAll('Item');
  }

  /** Same self-skip behavior as the other three report categories' viewGrid(). */
  async viewGrid() {
    const f = this.reportFrame;
    const button = f.locator('span:text-is("View Grid")');
    const present = await button.count().catch(() => 0);
    if (!present || !(await button.first().isVisible().catch(() => false))) {
      return; // this report has no View Grid step — nothing to do
    }

    const { locator } = await heal(f, {
      id: 'inventoryReport.viewGridButton',
      label: 'View Grid',
      strategies: [
        { type: 'css', value: 'span:text-is("View Grid")' },
        { type: 'text', value: 'View Grid', options: { exact: true } },
      ],
      timeout: 3000,
    });
    await locator.click();
    await this._waitForLoadingPanelHidden();
  }

  /**
   * Same shape as the other three report categories' previewReport(),
   * including the 60s click timeout established after Account
   * Receivable's Warranty Due Listing lesson (loading panel can
   * intercept the Preview Report click itself on a heavy report).
   */
  async previewReport(templateName) {
    const f = this.reportFrame;
    await this._waitForLoadingPanelHidden();
    const { locator: previewReportButton } = await heal(f, {
      id: 'inventoryReport.previewReportButton',
      label: 'Preview Report',
      strategies: [
        { type: 'css', value: '[id$="_cbpReport_cbpReportFramework_formReportFramework_btnPrint_CD"]' },
        { type: 'role', role: 'button', options: { name: 'Preview Report' } },
        { type: 'text', value: 'Preview Report', options: { exact: true } },
      ],
      timeout: 3000,
    });
    // Confirmed live (2026-07-27, Stock Card with Warehouse=ALL and
    // Item=ALL): even 60s wasn't enough — bumped to 90s. Harmless ceiling
    // for fast reports since the click resolves as soon as the panel
    // actually hides.
    await previewReportButton.click({ timeout: 90000 });

    const dialogAppeared = await f.getByText('Reports Format', { exact: true }).first()
      .waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false);
    if (dialogAppeared) {
      const unambiguousOption = f.locator(`td:visible:text-is("${templateName}"):not([id*="_Filter" i])`);
      if (await unambiguousOption.count().catch(() => 0)) {
        await unambiguousOption.first().click();
      } else {
        const templateCell = f.getByRole('cell', { name: templateName, exact: true });
        if (await templateCell.count().catch(() => 0)) {
          await templateCell.first().click();
        } else {
          await f.getByText(templateName, { exact: true }).click();
        }
      }

      const { locator: previewButton } = await heal(f, {
        id: 'inventoryReport.previewConfirmButton',
        label: 'Preview',
        strategies: [
          { type: 'css', value: 'span:text-is("Preview")' },
          { type: 'text', value: 'Preview', options: { exact: true } },
        ],
        timeout: 3000,
      });
      await previewButton.click();
    }
    // (no `else`/early-return: some reports skip the dialog and open the
    // result directly, but the verification below must run for BOTH paths)

    await this._verifyReportTitleRendered(templateName);
  }

  /**
   * FIXED (2026-08-18): confirmed live under --workers=2 that two report
   * requests running concurrently under the SAME shared admin session can
   * cross-contaminate — one test's preview breadcrumb said one report
   * name, but the rendered body was a DIFFERENT report entirely (visible
   * in a live failure screenshot: identical data/timestamp appeared under
   * two different report titles in two different tests running at once).
   * `isReportPageValid()` only ever checked "a report tab opened and isn't
   * closed" — it never checked WHICH report rendered, so a collision like
   * this would silently PASS with wrong data instead of failing. This
   * can't be checked from the final print tab (a rendered PDF, not
   * regular inspectable DOM) — the preview iframe is regular HTML and
   * still open at this point, so verify here, right after the preview
   * renders and before printReport() wastes time on a report that's
   * already known to be wrong.
   */
  async _verifyReportTitleRendered(expectedTitle, timeout = 30000) {
    const p = this.page;
    const frame = await findFrame(p, async (frame) => {
      const text = frame.getByText(expectedTitle, { exact: false });
      return (await text.count().catch(() => 0)) > 0 && (await text.first().isVisible().catch(() => false));
    }, { timeout });
    if (!frame) {
      await p.screenshot({ path: 'test-results/debug-inventory-report-title-mismatch.png', fullPage: true }).catch(() => {});
      throw new Error(
        `Report preview never showed the expected title "${expectedTitle}" — either it failed to render, ` +
        'or (confirmed possible under --workers=2 against the shared admin session) a concurrent report ' +
        'request cross-contaminated this session with a DIFFERENT report\'s content. ' +
        'Saved test-results/debug-inventory-report-title-mismatch.png for inspection.'
      );
    }
  }

  /**
   * Same async-report-output archetype as Account Receivable — call
   * unconditionally between previewReport() and printReport() until a
   * report in this category proves it's needed; self-skips otherwise.
   *
   * @param {number} clickHereTimeout - confirmed live twice in this
   *   category (Stock Aging with all warehouses selected, and again on
   *   Inventory Item Consolidate with plain default filters) that this
   *   category's reports can take well over Account Receivable's
   *   original 8s default just to render the "Your report is being
   *   processed" message — not only on data-heavy reports. Default
   *   raised to 20s category-wide rather than requiring every spec to
   *   remember an override; pass a larger value still for confirmed
   *   slow outliers.
   */
  async handleAsyncReportOutputIfPresent(clickHereTimeout = 20000) {
    const p = this.page;

    const clickHereFrame = await findFrame(p, async (frame) => {
      const link = frame.locator('span').filter({ hasText: 'Click here to view Report' });
      return (await link.count().catch(() => 0)) > 0 && (await link.first().isVisible().catch(() => false));
    }, { timeout: clickHereTimeout });
    if (!clickHereFrame) return false; // synchronous report — nothing to do

    await clickHereFrame.locator('span').filter({ hasText: 'Click here to view Report' }).first().click();
    await p.waitForTimeout(1500);

    const listingFrame = await findFrame(p, async (frame) => {
      const refreshButton = frame.locator('span').filter({ hasText: 'Refresh List' });
      return (await refreshButton.count().catch(() => 0)) > 0 && (await refreshButton.first().isVisible().catch(() => false));
    }, { timeout: 15000 });
    if (!listingFrame) return true; // couldn't find the listing — let printReport() try anyway

    const previewCellSelector = '[id*="ReportOutput" i][id*="gvDefault" i][id*="cell0" i][id*="preview" i]';
    const refreshButton = listingFrame.locator('span').filter({ hasText: 'Refresh List' }).first();

    const maxAttempts = 20;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const previewCell = listingFrame.locator(previewCellSelector);
      if ((await previewCell.count().catch(() => 0)) > 0 && (await previewCell.first().isVisible().catch(() => false))) {
        break;
      }
      await refreshButton.click().catch(() => {});
      await p.waitForTimeout(2000);
    }

    const previewCell = listingFrame.locator(previewCellSelector);
    if (await previewCell.count().catch(() => 0)) {
      await previewCell.first().click();
      await p.waitForTimeout(1500);
    }
    return true;
  }

  /**
   * Confirmed live (2026-07-27, Inventory Item Consolidate): the real
   * print control is `<input title="Print from Adobe Reader"
   * class="nav print_button">`.
   *
   * PERFORMANCE LESSON: the previous approach polled every frame every
   * 300ms via manual `.count()` + `.isVisible()` calls (framework's
   * findFrame()). Confirmed via a live DOM dump that under this report's
   * actual data volume, the browser's main thread is busy enough
   * rendering that EVERY frame's plain `.count()` call could take
   * multiple seconds to even resolve — so findFrame()'s manual polling
   * loop compounded that cost every 300ms across up to 9 frames, adding
   * up to 60-100s of pure overhead on top of genuine render time (Jin
   * confirmed manually clicking the equivalent control responded in ~2s
   * once visible). Playwright's own built-in `locator.waitFor()` does
   * its actionability polling at the protocol level without our script
   * re-issuing a fresh JS round-trip every cycle, so racing `waitFor()`
   * across all frames in parallel (first one to resolve wins) avoids
   * that compounding cost entirely.
   */
  async printReport() {
    const p = this.page;

    const printButtonSelector = '[title="Print from Adobe Reader"], .print_button[title*="Adobe" i]';
    const frames = p.frames();
    const waits = frames.map((frame) =>
      frame.locator(printButtonSelector).first()
        .waitFor({ state: 'visible', timeout: 90000 })
        .then(() => frame)
    );
    const printFrame = await Promise.any(waits).catch(() => null);
    if (!printFrame) {
      await p.screenshot({ path: 'test-results/debug-inventory-report-print-button-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the report\'s print button — the preview may not have finished rendering. ' +
        'Saved test-results/debug-inventory-report-print-button-not-found.png for inspection.'
      );
    }

    const [reportPage] = await Promise.all([
      p.context().waitForEvent('page', { timeout: 30000 }),
      printFrame.locator(printButtonSelector).first().click(),
    ]);

    await reportPage.waitForURL(/FastReport\.Export\.axd/i, { timeout: 15000 }).catch(() => {});
    return reportPage;
  }

  /** Per Jin's established rule: the print-preview tab appearing at all IS success. */
  isReportPageValid(reportPage) {
    return !!reportPage && !reportPage.isClosed();
  }
}

module.exports = { InventoryReportPage };
