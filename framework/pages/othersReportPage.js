const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for the "Reports > Others" CATEGORY (the #sub13 nav entry)
 * — covers any report catalog entry within it, not just one report. Same
 * shape as `generalLedgerReportPage.js` / `accountPayableReportPage.js` /
 * `accountReceivableReportPage.js` / `inventoryReportPage.js` /
 * `purchaseReportPage.js` / `salesReportPage.js`
 * / `gstReportPage.js` / `membershipVoucherReportPage.js` /
 * `staffReportPage.js` (the SAME underlying `ReportFrameWork1` reports
 * framework, just a different catalog and category link). Eleventh (and,
 * per the visible Reports nav list, LAST) category to reuse this exact
 * shape — after "Others" the nav shows "Report Output", which is a
 * different feature, not another report catalog. Only one catalog entry
 * so far: Clock In Clock Out.
 *
 * Carries all lessons confirmed across prior categories:
 * - exact-match-first catalog navigation (substring matches can land on
 *   the wrong entry when one name is a substring of another)
 * - "Filter By Selection" / "ALL combo" field helpers (Customer/Item/
 *   Staff), selecting just ONE row rather than "Select All"
 * - closing a Selection dropdown by re-clicking its own toggle (NOT
 *   Escape — Escape gets interpreted as "cancel" by this DevExpress
 *   control and discards the tick)
 * - a settle wait after switching a field to "Filter By Selection"
 *   before reading its value back, to avoid a wasteful redundant retry
 * - 90s Preview Report click timeout, 20s default async-report-output
 *   detection, and the Promise.any-based printReport() frame race.
 */
class OthersReportPage {
  constructor(page) {
    this.page = page;
    this.catalogFrame = null; // resolved by goto()
    this.reportFrame = null; // resolved by goto()
  }

  /**
   * @param {string} reportName - the catalog entry to click into (e.g.
   *   "Clock In Clock Out").
   */
  async goto(reportName) {
    const p = this.page;

    const reportsLink = p.getByRole('link', { name: 'Reports', exact: true });
    await reportsLink.click();
    // Scoped to the Reports fold's own submenu container to disambiguate
    // from any other "Others" link elsewhere in the nav (e.g. the
    // top-level Others MODULE, distinct from the Reports > Others
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
    await p.locator(`#${reportsSubmenuId}`).getByRole('link', { name: 'Others', exact: true }).click();

    // Exact-match-first: a plain substring match (hasText) can land on
    // the wrong catalog entry when one name is a substring of another.
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
      await p.screenshot({ path: 'test-results/debug-others-report-catalog-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        `Could not find "${reportName}" in the report catalog after clicking Reports > Others. ` +
        'Saved test-results/debug-others-report-catalog-not-found.png for inspection.'
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
      await p.screenshot({ path: 'test-results/debug-others-report-runtime-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        `Could not find the report runtime frame after clicking into the "${reportName}" report. ` +
        'Saved test-results/debug-others-report-runtime-not-found.png for inspection.'
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
   * Jin's Stock Aging/Stock Card lesson.
   *
   * @param {string} glFieldName - e.g. "Staff" or "Customer" (used as
   *   "_gl${glFieldName}_B-1Img" etc).
   */
  async _selectFirstRowInFilterBySelection(glFieldName) {
    const f = this.reportFrame;
    const openButton = f.locator(`[id$="_gl${glFieldName}_B-1Img" i]`);
    const present = await openButton.count().catch(() => 0);
    if (!present || !(await openButton.first().isVisible().catch(() => false))) {
      return; // this report's field defaults to ALL — nothing to do
    }

    const { locator } = await heal(f, {
      id: `othersReport.${glFieldName.toLowerCase()}SelectionDropdownButton`,
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
      id: `othersReport.${glFieldName.toLowerCase()}SelectionFirstRow`,
      label: `Select first ${glFieldName} row`,
      strategies: [
        { type: 'css', value: `[id$="_gl${glFieldName}_DDD_gv_DXSelBtn0_D" i]` },
      ],
      timeout: 8000,
    });
    await firstRowCheckbox.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    await firstRowCheckbox.click();
    await this.page.waitForTimeout(500);
    // Close by re-clicking the toggle (NOT Escape — confirmed to cancel
    // the tick on this control).
    await locator.click().catch(() => {});
    await this.page.waitForTimeout(500);
  }

  async selectFirstStaffIfNeeded() {
    return this._selectFirstRowInFilterBySelection('Staff');
  }

  async selectFirstCustomerIfNeeded() {
    return this._selectFirstRowInFilterBySelection('Customer');
  }

  /**
   * Switches a field's ALL/Filter combo to "Filter By Selection" if it
   * defaults to "ALL".
   *
   * @param {string} fieldName - e.g. "Staff" or "Customer".
   */
  async _switchFieldToFilterBySelectionIfAll(fieldName) {
    const f = this.reportFrame;
    const filterCombo = f.locator(`[id$="_cb${fieldName}_Filter_I" i]`);
    const present = await filterCombo.count().catch(() => 0);
    if (!present) return;

    const currentValue = await filterCombo.first().inputValue().catch(() => '');
    if (currentValue.trim().toUpperCase() !== 'ALL') return;

    await filterCombo.first().click({ force: true });
    const findOption = () => f.locator(`[id*="_cb${fieldName}_Filter_DDD" i]`)
      .getByText('Filter By Selection', { exact: true }).first();
    await findOption().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    await findOption().click({ timeout: 15000, force: true }).catch(() => {});
    await this._waitForLoadingPanelHidden(8000);
    // Settle wait before reading the value back — reading too early can
    // misread a successful switch as still "ALL" and trigger a wasteful
    // redundant retry.
    await this.page.waitForTimeout(2000);

    const valueAfterFirstAttempt = await filterCombo.first().inputValue().catch(() => '');
    if (valueAfterFirstAttempt.trim().toUpperCase() === 'ALL') {
      await filterCombo.first().click({ force: true });
      await findOption().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      await findOption().click({ timeout: 15000, force: true }).catch(() => {});
      await this._waitForLoadingPanelHidden(8000);
      await this.page.waitForTimeout(2000);
    }
    await this.page.waitForTimeout(500);
  }

  async switchStaffToFilterBySelectionIfAll() {
    return this._switchFieldToFilterBySelectionIfAll('Staff');
  }

  async switchCustomerToFilterBySelectionIfAll() {
    return this._switchFieldToFilterBySelectionIfAll('Customer');
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
      id: 'othersReport.viewGridButton',
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

  /** Same shape as the other categories' previewReport(). */
  async previewReport(templateName) {
    const f = this.reportFrame;
    await this._waitForLoadingPanelHidden();
    const { locator: previewReportButton } = await heal(f, {
      id: 'othersReport.previewReportButton',
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
      id: 'othersReport.previewConfirmButton',
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
   * OPTIMIZED (2026-07-28): ported the same fix already applied to
   * salesReportPage.js — the old version always paid the full
   * clickHereTimeout (20s) waiting for the async "Click here" link before
   * giving up on a genuinely synchronous report. Races BOTH signals
   * (print button appearing vs. "Click here" appearing) with the SAME
   * generous ceiling via Promise.any() — a fast synchronous report now
   * returns almost immediately instead of always eating the full 20s.
   */
  async handleAsyncReportOutputIfPresent(clickHereTimeout = 20000) {
    const p = this.page;

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
   * Same shape as the other categories' printReport() — the confirmed
   * real print control is `<input title="Print from Adobe Reader"
   * class="nav print_button">`, and racing `waitFor()` across all frames
   * in parallel avoids the compounding-overhead cost a busy render
   * thread can otherwise cause.
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
      await p.screenshot({ path: 'test-results/debug-others-report-print-button-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the report\'s print button — the preview may not have finished rendering. ' +
        'Saved test-results/debug-others-report-print-button-not-found.png for inspection.'
      );
    }

    // OPTIMIZED/FIXED (2026-07-28): ported the same fix already applied to
    // cashSalesPage.js/journalEntryPage.js/etc. — clicking this button can
    // trigger either a real page navigation OR a genuine file download
    // (Playwright fires a transient `page` event with empty url/title for
    // the download case). The old code only ever awaited `page`, so a
    // download here would hang for the full 30s timeout despite the report
    // having rendered correctly. Race both event types and accept whichever
    // actually fires.
    const eventPromise = Promise.race([
      p.context().waitForEvent('page', { timeout: 30000 }).then((value) => ({ kind: 'page', value })),
      p.context().waitForEvent('download', { timeout: 30000 }).then((value) => ({ kind: 'download', value })),
    ]);
    const [{ kind, value }] = await Promise.all([
      eventPromise,
      printFrame.locator(printButtonSelector).first().click(),
    ]);

    if (kind === 'download') {
      return value; // Playwright Download object
    }

    const reportPage = value;
    await reportPage.waitForURL(/FastReport\.Export\.axd/i, { timeout: 15000 }).catch(() => {});
    return reportPage;
  }

  /**
   * True if printReport() got either a genuine file download or a page
   * that actually navigated to the FastReport PDF endpoint — same shape as
   * cashSalesPage.js's isReportPageValid().
   */
  isReportPageValid(reportPageOrDownload) {
    if (!reportPageOrDownload) return false;
    if (typeof reportPageOrDownload.suggestedFilename === 'function') {
      return true; // a Download object firing at all IS the proof
    }
    return !reportPageOrDownload.isClosed() && /FastReport\.Export\.axd/i.test(reportPageOrDownload.url());
  }
}

module.exports = { OthersReportPage };
