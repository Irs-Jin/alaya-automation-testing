const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for the "Reports > Sales" CATEGORY (the #sub13 nav entry)
 * — covers any report catalog entry within it, not just one report. Same
 * shape as `generalLedgerReportPage.js` / `accountPayableReportPage.js` /
 * `accountReceivableReportPage.js` / `inventoryReportPage.js` /
 * `purchaseReportPage.js` (the SAME underlying `ReportFrameWork1` reports
 * framework, just a different catalog and category link). Sixth category
 * to reuse this exact shape.
 *
 * Built from Jin's screenshot of the Sales report catalog (15 reports:
 * Sales Performance, Sales Document Listing, Payment Collection, Sales
 * Listing (with Profit), Daily Sales Analysis, Sales Profit, Item Sales
 * Listing (with Profit), Preferred Vendor Product Sales Listing, Monthly
 * Sales Analysis, Item Sales Listing, Outstanding Sales Document, Slow
 * Movement Listing, Sales Listing, Item Sales Analysis By Month, Sales
 * Order Listing) — no per-report "Reports Format" dialog screenshot yet.
 * templateName defaults are UNCONFIRMED GUESSES matching the catalog
 * name; expect some to need correcting from a live failure screenshot.
 *
 * The one call sequence for every report in this category (same as the
 * other five): `goto(name) -> viewGrid() -> previewReport(value) ->
 * printReport()`. `viewGrid()`/`previewReport()`'s self-skip behavior is
 * inherited as-is. Also carries the "Filter By Selection" / "ALL combo"
 * helpers (Customer/Item) in case a Sales report has a field with the
 * same shape as Inventory's Warehouse/Item lesson.
 */
class SalesReportPage {
  constructor(page) {
    this.page = page;
    this.catalogFrame = null; // resolved by goto()
    this.reportFrame = null; // resolved by goto()
  }

  /**
   * @param {string} reportName - the catalog entry to click into (e.g.
   *   "Sales Performance", "Monthly Sales Analysis").
   */
  async goto(reportName) {
    const p = this.page;

    const reportsLink = p.getByRole('link', { name: 'Reports', exact: true });
    await reportsLink.click();
    // Scoped to the Reports fold's own submenu container to disambiguate
    // from any other "Sales" link elsewhere in the nav (e.g. the top-level
    // Sales MODULE, distinct from the Reports > Sales CATEGORY).
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
    await p.locator(`#${reportsSubmenuId}`).getByRole('link', { name: 'Sales', exact: true }).click();

    // Confirmed live (2026-07-27, Sales Listing): this catalog has
    // several overlapping names ("Sales Listing" / "Item Sales Listing"
    // / "Sales Listing (with Profit)" / "Item Sales Listing (with
    // Profit)") — a plain substring match (hasText) can land on the
    // WRONG entry (e.g. goto("Sales Listing") matching "Item Sales
    // Listing" instead, since the former is a substring of the latter).
    // Prefer an exact text match scoped to the catalog's <span> tiles;
    // fall back to substring only if no exact match exists. A first
    // attempt using page-wide getByText(exact:true) also failed — it
    // matched an unrelated hidden <input> elsewhere in the frame that
    // happened to share the same exact text/value/title.
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
      await p.screenshot({ path: 'test-results/debug-sales-report-catalog-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        `Could not find "${reportName}" in the report catalog after clicking Reports > Sales. ` +
        'Saved test-results/debug-sales-report-catalog-not-found.png for inspection.'
      );
    }
    const { exact: exactItem, loose: looseItem } = findCatalogItem(this.catalogFrame);
    if (await exactItem.count().catch(() => 0)) {
      await exactItem.first().click();
    } else {
      await looseItem.first().click();
    }

    this.reportFrame = await findFrame(p, async (frame) => {
      const byId = frame.locator('[id$="_cbpReport_cbpReportFramework_formReportFramework_btnPrint_CD"]');
      if ((await byId.count().catch(() => 0)) > 0 && (await byId.first().isVisible().catch(() => false))) {
        return true;
      }
      const byRole = frame.getByRole('button', { name: 'Preview Report' });
      return (await byRole.count().catch(() => 0)) > 0 && (await byRole.first().isVisible().catch(() => false));
    }, { timeout: 20000 });
    if (!this.reportFrame) {
      await p.screenshot({ path: 'test-results/debug-sales-report-runtime-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        `Could not find the report runtime frame after clicking into the "${reportName}" report. ` +
        'Saved test-results/debug-sales-report-runtime-not-found.png for inspection.'
      );
    }
  }

  /** Same DevExpress loading-overlay lesson as the other categories. */
  async _waitForLoadingPanelHidden(timeout = 15000) {
    await this.reportFrame.locator('#ctl00_LoadingPanel_LD').first()
      .waitFor({ state: 'hidden', timeout }).catch(() => {});
  }

  /**
   * Same "Filter By Selection" quirk confirmed on Inventory's Warehouse/
   * Item fields — some report fields default to "Filter By Selection"
   * with an empty Selection grid. Self-skips if this report's field
   * isn't in that state. Selects just ONE row (not "Select All") per
   * Jin's Stock Aging/Stock Card lesson: selecting everything can turn a
   * report into a multi-minute aggregation.
   *
   * @param {string} glFieldName - the internal grid-lookup field name,
   *   e.g. "Customer" or "Item" (used as "_gl${glFieldName}_B-1Img" etc).
   */
  async _selectFirstRowInFilterBySelection(glFieldName) {
    const f = this.reportFrame;
    const openButton = f.locator(`[id$="_gl${glFieldName}_B-1Img" i]`);
    const present = await openButton.count().catch(() => 0);
    if (!present || !(await openButton.first().isVisible().catch(() => false))) {
      return; // this report's field defaults to ALL — nothing to do
    }

    const { locator } = await heal(f, {
      id: `salesReport.${glFieldName.toLowerCase()}SelectionDropdownButton`,
      label: `${glFieldName} Selection dropdown`,
      strategies: [
        { type: 'css', value: `[id$="_gl${glFieldName}_B-1Img" i]` },
      ],
      timeout: 3000,
    });
    await locator.click();
    await this._waitForLoadingPanelHidden(5000);
    // OPTIMIZED (2026-07-28): removed a flat waitForTimeout(1000) here —
    // redundant dead time, since firstRowCheckbox's own
    // waitFor({state:'visible'}) immediately below already polls for
    // exactly this.

    const { locator: firstRowCheckbox } = await heal(f, {
      id: `salesReport.${glFieldName.toLowerCase()}SelectionFirstRow`,
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
    // CONFIRMED REGRESSION: pressing Escape here (an earlier fix attempt)
    // was interpreted by this DevExpress control as "cancel", discarding
    // the tick and triggering "Please Select Customer" on Preview Report
    // — clicking the same toggle button again to close it instead
    // preserves the checked state.
    await locator.click().catch(() => {});
    await this.page.waitForTimeout(500);
  }

  async selectFirstCustomerIfNeeded() {
    return this._selectFirstRowInFilterBySelection('Customer');
  }

  async selectFirstItemIfNeeded() {
    return this._selectFirstRowInFilterBySelection('Item');
  }

  /**
   * Polls a filter combo's value every 200ms until it's no longer "ALL" or
   * `maxWait` elapses, whichever comes first — same ceiling as the flat
   * wait it replaces, but exits early once the postback actually lands
   * instead of always paying the full wait.
   */
  async _pollUntilFilterValueChanges(filterCombo, maxWait) {
    const deadline = Date.now() + maxWait;
    let value = await filterCombo.first().inputValue().catch(() => '');
    while (Date.now() < deadline && value.trim().toUpperCase() === 'ALL') {
      await this.page.waitForTimeout(200);
      value = await filterCombo.first().inputValue().catch(() => '');
    }
    return value;
  }

  /**
   * Switches a field's ALL/Filter combo to "Filter By Selection" if it
   * defaults to "ALL" — same shape as Inventory's lesson from Stock Card.
   *
   * @param {string} fieldName - e.g. "Customer" or "Item" (used as
   *   "_cb${fieldName}_Filter_I").
   */
  async _switchFieldToFilterBySelectionIfAll(fieldName) {
    const f = this.reportFrame;
    const filterCombo = f.locator(`[id$="_cb${fieldName}_Filter_I" i]`);
    const present = await filterCombo.count().catch(() => 0);
    if (!present) return;

    const currentValue = await filterCombo.first().inputValue().catch(() => '');
    if (currentValue.trim().toUpperCase() !== 'ALL') return;

    // Confirmed live (2026-07-27, Item Sales Listing (with Profit)): this
    // report puts the Customer field inside an "Additional Option"
    // collapsible section, whose own wrapper (`dxrpCW`/`dxrpHCW`) can
    // visually sit over the field and intercept a plain click even
    // though the input itself is genuinely visible/enabled — same class
    // of DevExpress actionability quirk as the documented onclick/
    // force-click fallback for icon-only toolbar buttons. force:true
    // dispatches at the element's coordinates regardless.
    await filterCombo.first().click({ force: true });
    const findOption = () => f.locator(`[id*="_cb${fieldName}_Filter_DDD" i]`)
      .getByText('Filter By Selection', { exact: true }).first();
    await findOption().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    await findOption().click({ timeout: 15000, force: true }).catch(() => {});
    await this._waitForLoadingPanelHidden(8000);
    // Confirmed live: reading the combo's value immediately after the
    // loading panel clears was too early — the postback that actually
    // updates the displayed value hadn't landed yet, so this read back
    // "ALL" even though the click had already succeeded, triggering a
    // wasteful full second attempt (measured cost: ~40s vs ~1s once this
    // settle wait was added).
    //
    // OPTIMIZED (2026-07-28): the flat `waitForTimeout(2000)` always paid
    // the full 2s even when the postback landed in a few hundred ms — a
    // real, measured cost on reports with TWO such fields (Customer AND
    // Item), e.g. Item Sales Listing (with Profit). Same 2s ceiling kept
    // (never confirmed safe to shrink), but now polls and exits the
    // instant the value actually changes instead of always waiting it out.
    const valueAfterFirstAttempt = await this._pollUntilFilterValueChanges(filterCombo, 2000);
    if (valueAfterFirstAttempt.trim().toUpperCase() === 'ALL') {
      await filterCombo.first().click({ force: true });
      await findOption().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      await findOption().click({ timeout: 15000, force: true }).catch(() => {});
      await this._waitForLoadingPanelHidden(8000);
      await this._pollUntilFilterValueChanges(filterCombo, 2000);
    }
    await this.page.waitForTimeout(500);
  }

  async switchCustomerToFilterBySelectionIfAll() {
    return this._switchFieldToFilterBySelectionIfAll('Customer');
  }

  async switchItemToFilterBySelectionIfAll() {
    return this._switchFieldToFilterBySelectionIfAll('Item');
  }

  /**
   * Per Jin (2026-07-27, Sales Listing (with Profit)): this report has a
   * "Show Cost" checkbox on its parameter form that must be ticked before
   * previewing — self-skips if this report has no such checkbox, ticks
   * it only if currently unchecked.
   */
  async checkShowCostIfPresent() {
    const f = this.reportFrame;
    const checkbox = f.locator('[id$="_chkShowCost_S_D" i], [id$="_chkShowCost_I" i]');
    const present = await checkbox.count().catch(() => 0);
    if (!present) {
      // Fall back to finding it by its visible label text.
      const byLabel = f.getByText('Show Cost', { exact: true });
      if (!(await byLabel.count().catch(() => 0))) return; // no Show Cost control on this report
      await byLabel.first().click().catch(() => {});
      return;
    }
    const isChecked = await checkbox.first().isChecked().catch(() => null);
    if (isChecked === false) {
      await checkbox.first().click();
    } else if (isChecked === null) {
      // Not a real checkbox input — click via its associated clickable span/label.
      await f.getByText('Show Cost', { exact: true }).first().click().catch(() => {});
    }
  }

  /** Same self-skip behavior as the other categories' viewGrid(). */
  async viewGrid() {
    const f = this.reportFrame;
    const button = f.locator('span:text-is("View Grid")');
    const present = await button.count().catch(() => 0);
    if (!present || !(await button.first().isVisible().catch(() => false))) {
      return; // this report has no View Grid step — nothing to do
    }

    const { locator } = await heal(f, {
      id: 'salesReport.viewGridButton',
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
   * Same shape as the other categories' previewReport(), including the
   * 90s click timeout established after Inventory's Stock Card lesson
   * (loading panel can intercept the Preview Report click itself on a
   * heavy report).
   */
  async previewReport(templateName) {
    const f = this.reportFrame;
    await this._waitForLoadingPanelHidden();
    const { locator: previewReportButton } = await heal(f, {
      id: 'salesReport.previewReportButton',
      label: 'Preview Report',
      strategies: [
        { type: 'css', value: '[id$="_cbpReport_cbpReportFramework_formReportFramework_btnPrint_CD"]' },
        { type: 'role', role: 'button', options: { name: 'Preview Report' } },
        { type: 'text', value: 'Preview Report', options: { exact: true } },
      ],
      timeout: 3000,
    });
    await previewReportButton.click({ timeout: 90000 });

    const dialogAppeared = await f.getByText('Reports Format', { exact: true }).first()
      .waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false);
    if (!dialogAppeared) {
      return; // no template dialog here — Preview Report already opened the result directly
    }

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
      id: 'salesReport.previewConfirmButton',
      label: 'Preview',
      strategies: [
        { type: 'css', value: 'span:text-is("Preview")' },
        { type: 'text', value: 'Preview', options: { exact: true } },
      ],
      timeout: 3000,
    });
    await previewButton.click();
  }

  /**
   * Same async-report-output archetype confirmed across every category
   * so far — call unconditionally between previewReport() and
   * printReport() until a report in this category proves it's needed;
   * self-skips otherwise.
   *
   * @param {number} clickHereTimeout - Inventory's category needed this
   *   raised from AR's original 8s default to 20s; pass a larger value
   *   still for confirmed slow outliers.
   */
  async handleAsyncReportOutputIfPresent(clickHereTimeout = 20000) {
    const p = this.page;

    // BUG FIXED (2026-07-28): the previous attempt at this optimization
    // checked "is the print button ALREADY visible" with only a 1.5s
    // window, then fell back to the full clickHereTimeout (20s) poll for
    // the async "Click here" link if not. Confirmed live (Jin,
    // screenshot) that's still slow: a synchronous report can genuinely
    // take a few real seconds to render — longer than 1.5s, but nowhere
    // near 20s — so the fast check missed it almost every time, and
    // execution fell through to the SAME old 20s dead wait this was
    // supposed to fix. Corrected to a real race: poll for BOTH signals
    // (print button appearing vs. "Click here" appearing) concurrently
    // with the SAME generous ceiling, and take whichever one actually
    // shows up first — Promise.any() resolves on the first FULFILLMENT,
    // not the first settlement, so a fast synchronous report still
    // returns almost immediately without waiting for the async check to
    // exhaust its full timeout.
    const printButtonSelector = '[title="Print from Adobe Reader"], .print_button[title*="Adobe" i]';
    const printReady = Promise.any(
      p.frames().map((frame) => frame.locator(printButtonSelector).first().waitFor({ state: 'visible', timeout: clickHereTimeout }))
    ).then(() => 'print');
    const clickHereReady = findFrame(p, async (frame) => {
      const link = frame.locator('span').filter({ hasText: 'Click here to view Report' });
      return (await link.count().catch(() => 0)) > 0 && (await link.first().isVisible().catch(() => false));
    }, { timeout: clickHereTimeout }).then((frame) => (frame ? 'clickHere' : Promise.reject()));

    const winner = await Promise.any([printReady, clickHereReady]).catch(() => null);
    if (winner !== 'clickHere') {
      return false; // print button won (synchronous report), or neither ever appeared — nothing to do
    }

    const clickHereFrame = await findFrame(p, async (frame) => {
      const link = frame.locator('span').filter({ hasText: 'Click here to view Report' });
      return (await link.count().catch(() => 0)) > 0 && (await link.first().isVisible().catch(() => false));
    }, { timeout: 3000 }); // already confirmed present by the race above — this should resolve almost instantly
    if (!clickHereFrame) return false;

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
   * Same shape as the other categories' printReport() — confirmed live
   * (Inventory Item Consolidate) that the real print control is
   * `<input title="Print from Adobe Reader" class="nav print_button">`,
   * and that racing `waitFor()` across all frames in parallel (instead of
   * manual per-frame `.count()`/`.isVisible()` polling) avoids the
   * compounding-overhead cost a busy render thread can otherwise cause.
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
      await p.screenshot({ path: 'test-results/debug-sales-report-print-button-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the report\'s print button — the preview may not have finished rendering. ' +
        'Saved test-results/debug-sales-report-print-button-not-found.png for inspection.'
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

module.exports = { SalesReportPage };
