const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for the "Reports > Purchase" CATEGORY (the #sub13 nav
 * entry) — covers any report catalog entry within it, not just one
 * report. Same shape as `generalLedgerReportPage.js` /
 * `accountPayableReportPage.js` / `accountReceivableReportPage.js` /
 * `inventoryReportPage.js` (the SAME underlying `ReportFrameWork1`
 * reports framework, just a different catalog and category link). Fifth
 * category to reuse this exact shape.
 *
 * Built from Jin's screenshot of the Purchase report catalog (Monthly
 * Purchase Analysis, Item Purchase Listing, Purchase Document Listing,
 * Outstanding Purchase Document) — no per-report "Reports Format" dialog
 * screenshot yet. templateName defaults are UNCONFIRMED GUESSES matching
 * the catalog name; expect some to need correcting from a live failure
 * screenshot.
 *
 * The one call sequence for every report in this category (same as the
 * other four): `goto(name) -> viewGrid() -> previewReport(value) ->
 * printReport()`. `viewGrid()`/`previewReport()`'s self-skip behavior is
 * inherited as-is. Also carries Inventory's "Filter By Selection" /
 * "ALL combo" helpers in case a Purchase report has a Vendor/Item field
 * with the same shape (Warehouse's lesson generalized to any field name).
 */
class PurchaseReportPage {
  constructor(page) {
    this.page = page;
    this.catalogFrame = null; // resolved by goto()
    this.reportFrame = null; // resolved by goto()
  }

  /**
   * @param {string} reportName - the catalog entry to click into (e.g.
   *   "Monthly Purchase Analysis", "Item Purchase Listing").
   */
  async goto(reportName) {
    const p = this.page;

    const reportsLink = p.getByRole('link', { name: 'Reports', exact: true });
    await reportsLink.click();
    // Scoped to the Reports fold's own submenu container to disambiguate
    // from any other "Purchase" link elsewhere in the nav (e.g. the
    // top-level Purchase MODULE, distinct from the Reports > Purchase
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
    await p.locator(`#${reportsSubmenuId}`).getByRole('link', { name: 'Purchase', exact: true }).click();

    // Confirmed live (2026-07-27, Sales category): a plain substring match
    // (hasText) can land on the WRONG catalog entry when one name is a
    // substring of another. Prefer an exact text match scoped to the
    // catalog's <span> tiles (a page-wide getByText(exact:true) risks
    // matching an unrelated hidden <input> elsewhere in the frame with
    // the same exact value/title); fall back to substring only if no
    // exact match exists.
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
      await p.screenshot({ path: 'test-results/debug-purchase-report-catalog-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        `Could not find "${reportName}" in the report catalog after clicking Reports > Purchase. ` +
        'Saved test-results/debug-purchase-report-catalog-not-found.png for inspection.'
      );
    }
    const { exact: exactItem, loose: looseItem } = findCatalogItem(this.catalogFrame);
    if (await exactItem.count().catch(() => 0)) {
      await exactItem.first().click();
    } else {
      await looseItem.first().click();
    }

    this.reportFrame = await findFrame(p, async (frame) => {
      // Confirmed pattern across categories: the shared control's prefix
      // varies per category ("ReportFrameWork1", "ReportFrameWorkInventory",
      // ...) — a suffix match generalizes instead of hardcoding one.
      const byId = frame.locator('[id$="_cbpReport_cbpReportFramework_formReportFramework_btnPrint_CD"]');
      if ((await byId.count().catch(() => 0)) > 0 && (await byId.first().isVisible().catch(() => false))) {
        return true;
      }
      const byRole = frame.getByRole('button', { name: 'Preview Report' });
      return (await byRole.count().catch(() => 0)) > 0 && (await byRole.first().isVisible().catch(() => false));
    }, { timeout: 20000 });
    if (!this.reportFrame) {
      await p.screenshot({ path: 'test-results/debug-purchase-report-runtime-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        `Could not find the report runtime frame after clicking into the "${reportName}" report. ` +
        'Saved test-results/debug-purchase-report-runtime-not-found.png for inspection.'
      );
    }
  }

  /** Same DevExpress loading-overlay lesson as the other categories. */
  async _waitForLoadingPanelHidden(timeout = 15000) {
    await this.reportFrame.locator('#ctl00_LoadingPanel_LD').first()
      .waitFor({ state: 'hidden', timeout }).catch(() => {});
  }

  /**
   * Same "Filter By Selection" quirk confirmed on Inventory's Warehouse
   * and Item fields — some report fields default to "Filter By
   * Selection" with an empty Selection grid. Self-skips if this report's
   * field isn't in that state. Selects just ONE row (not "Select All")
   * per Jin's Stock Aging/Stock Card lesson: selecting everything can
   * turn a report into a multi-minute aggregation.
   *
   * @param {string} glFieldName - the internal grid-lookup field name,
   *   e.g. "Vendor" or "Item" (used as "_gl${glFieldName}_B-1Img" etc).
   */
  async _selectFirstRowInFilterBySelection(glFieldName) {
    const f = this.reportFrame;
    const openButton = f.locator(`[id$="_gl${glFieldName}_B-1Img" i]`);
    const present = await openButton.count().catch(() => 0);
    if (!present || !(await openButton.first().isVisible().catch(() => false))) {
      return; // this report's field defaults to ALL — nothing to do
    }

    const { locator } = await heal(f, {
      id: `purchaseReport.${glFieldName.toLowerCase()}SelectionDropdownButton`,
      label: `${glFieldName} Selection dropdown`,
      strategies: [
        { type: 'css', value: `[id$="_gl${glFieldName}_B-1Img" i]` },
      ],
      timeout: 3000,
    });
    await locator.click();
    await this._waitForLoadingPanelHidden(5000);
    await this.page.waitForTimeout(1000);

    const { locator: firstRowCheckbox } = await heal(f, {
      id: `purchaseReport.${glFieldName.toLowerCase()}SelectionFirstRow`,
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

  async selectFirstVendorIfNeeded() {
    return this._selectFirstRowInFilterBySelection('Vendor');
  }

  async selectFirstItemIfNeeded() {
    return this._selectFirstRowInFilterBySelection('Item');
  }

  /**
   * Switches a field's ALL/Filter combo to "Filter By Selection" if it
   * defaults to "ALL" — same shape as Inventory's lesson from Stock Card.
   *
   * @param {string} fieldName - e.g. "Vendor" or "Item" (used as
   *   "_cb${fieldName}_Filter_I").
   */
  async _switchFieldToFilterBySelectionIfAll(fieldName) {
    const f = this.reportFrame;
    const filterCombo = f.locator(`[id$="_cb${fieldName}_Filter_I" i]`);
    const present = await filterCombo.count().catch(() => 0);
    if (!present) return;

    const currentValue = await filterCombo.first().inputValue().catch(() => '');
    if (currentValue.trim().toUpperCase() !== 'ALL') return;

    await filterCombo.first().click();
    const findOption = () => f.locator(`[id*="_cb${fieldName}_Filter_DDD" i]`)
      .getByText('Filter By Selection', { exact: true }).first();
    await findOption().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
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
      await filterCombo.first().click();
      await findOption().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      await findOption().click({ timeout: 15000 }).catch(() => {});
      await this._waitForLoadingPanelHidden(8000);
      await this.page.waitForTimeout(2000);
    }
    await this.page.waitForTimeout(500);
  }

  async switchVendorToFilterBySelectionIfAll() {
    return this._switchFieldToFilterBySelectionIfAll('Vendor');
  }

  async switchItemToFilterBySelectionIfAll() {
    return this._switchFieldToFilterBySelectionIfAll('Item');
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
      id: 'purchaseReport.viewGridButton',
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
      id: 'purchaseReport.previewReportButton',
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
      id: 'purchaseReport.previewConfirmButton',
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
      await p.screenshot({ path: 'test-results/debug-purchase-report-print-button-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the report\'s print button — the preview may not have finished rendering. ' +
        'Saved test-results/debug-purchase-report-print-button-not-found.png for inspection.'
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

module.exports = { PurchaseReportPage };
