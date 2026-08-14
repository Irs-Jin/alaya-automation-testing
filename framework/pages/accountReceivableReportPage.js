const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for the "Reports > Account Receivable" CATEGORY (the
 * #sub13 nav entry) — covers any report catalog entry within it, not
 * just one report. Same shape as `generalLedgerReportPage.js` /
 * `accountPayableReportPage.js` (the SAME underlying `ReportFrameWork1`
 * reports framework, just a different catalog and category link).
 * Third category to reuse this exact shape — the General Ledger reports
 * category proved it, Account Payable confirmed it generalizes cleanly
 * across categories (9-for-9), this one starts from that same baseline.
 *
 * Built from Jin's own screenshots (no codegen recording) for "Customer
 * Outstanding" — the "Reports Format" dialog default template is
 * "Customer Outstanding By Customer" (the other option is "...By Sales
 * Agent"), plain naming with no "A/P"-style slash quirk seen in this one.
 *
 * The one call sequence for every report in this category (same as the
 * other two): `goto(name) -> viewGrid() -> previewReport(value) ->
 * printReport()`. `viewGrid()`/`previewReport()`'s self-skip behavior is
 * inherited as-is — don't assume a report here needs a special case
 * before actually seeing it fail. Given the Account Payable category's
 * recurring lesson, the ONE thing to verify per report here is still the
 * exact `previewReport(templateName)` string — don't assume it always
 * equals the catalog name.
 */
class AccountReceivableReportPage {
  constructor(page) {
    this.page = page;
    this.catalogFrame = null; // resolved by goto()
    this.reportFrame = null; // resolved by goto()
  }

  /**
   * @param {string} reportName - the catalog entry to click into (e.g.
   *   "Customer Outstanding", "Customer Aging"). Defaults to "Customer
   *   Outstanding" since that's the first report converted here.
   */
  async goto(reportName = 'Customer Outstanding') {
    const p = this.page;

    const reportsLink = p.getByRole('link', { name: 'Reports', exact: true });
    await reportsLink.click();
    // Scoped to the Reports fold's own submenu container to disambiguate
    // from any other "Account Receivable" link elsewhere in the nav — this
    // is the CATEGORY link, same pattern as General Ledger's and Account
    // Payable's.
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
    await p.locator(`#${reportsSubmenuId}`).getByRole('link', { name: 'Account Receivable', exact: true }).click();

    this.catalogFrame = await findFrame(p, async (frame) => {
      const item = frame.locator('span').filter({ hasText: reportName });
      return (await item.count()) > 0 && (await item.first().isVisible().catch(() => false));
    });
    if (!this.catalogFrame) {
      await p.screenshot({ path: 'test-results/debug-ar-report-catalog-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        `Could not find "${reportName}" in the report catalog after clicking Reports > Account Receivable. ` +
        'Saved test-results/debug-ar-report-catalog-not-found.png for inspection.'
      );
    }
    await this.catalogFrame.locator('span').filter({ hasText: reportName }).first().click();

    this.reportFrame = await findFrame(p, async (frame) => {
      const byId = frame.locator('#ctl00_MainContent_ReportFrameWork1_cbpReport_cbpReportFramework_formReportFramework_btnPrint_CD');
      if ((await byId.count().catch(() => 0)) > 0 && (await byId.first().isVisible().catch(() => false))) {
        return true;
      }
      const byRole = frame.getByRole('button', { name: 'Preview Report' });
      return (await byRole.count().catch(() => 0)) > 0 && (await byRole.first().isVisible().catch(() => false));
    });
    if (!this.reportFrame) {
      await p.screenshot({ path: 'test-results/debug-ar-report-runtime-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        `Could not find the report runtime frame after clicking into the "${reportName}" report. ` +
        'Saved test-results/debug-ar-report-runtime-not-found.png for inspection.'
      );
    }
  }

  /**
   * DevExpress shows an app-wide loading overlay (`#ctl00_LoadingPanel_LD`)
   * during any server postback, which can linger long enough to
   * intercept a click on the element underneath it even though that
   * element itself reports "visible, enabled and stable" — confirmed
   * live (2026-07-26) on Customer Outstanding: clicking "Preview Report"
   * timed out for the FULL 10s retry window with
   * `<div id="ctl00_LoadingPanel_LD" ...> intercepts pointer events`
   * repeated on every attempt. Waiting for this overlay to actually
   * disappear before a critical click is more reliable than just
   * retrying the click itself. Best-effort — some pages never show it at
   * all, so a missing overlay isn't an error.
   */
  async _waitForLoadingPanelHidden(timeout = 15000) {
    await this.reportFrame.locator('#ctl00_LoadingPanel_LD').first()
      .waitFor({ state: 'hidden', timeout }).catch(() => {});
  }

  /**
   * NEW PARAMETER SHAPE (confirmed live via Jin's codegen recording,
   * 2026-07-27, Customer Statement Balance): every report before this one
   * defaults Customer to "ALL". This report instead defaults Customer to
   * "Filter By Selection" with an EMPTY "Selection" multi-select grid —
   * View Grid/Preview won't return anything useful until at least one
   * customer is ticked. Per Jin's recording: open the Selection dropdown
   * and click the grid's "Select All" header checkbox before proceeding.
   * Self-skips if this report's Customer field isn't in that state (i.e.
   * every report before this one, and presumably most after it too) —
   * call this unconditionally right after goto(), same self-skip
   * convention as viewGrid()/previewReport().
   */
  async selectAllCustomersIfNeeded() {
    const f = this.reportFrame;
    const openButton = f.locator('[id$="_cbCustomer_glCustomer_B-1Img"]');
    const present = await openButton.count().catch(() => 0);
    if (!present || !(await openButton.first().isVisible().catch(() => false))) {
      return; // this report's Customer field defaults to ALL — nothing to do
    }

    const { locator } = await heal(f, {
      id: 'accountReceivableReport.customerSelectionDropdownButton',
      label: 'Customer Selection dropdown',
      strategies: [
        {
          type: 'css',
          value: '#ctl00_MainContent_ReportFrameWork1_cbpReport_cbpReportFrameworkParameter_rpReportFramework_formReportFrameworkParameter_cbCustomer_glCustomer_B-1Img',
        },
        { type: 'css', value: '[id$="_cbCustomer_glCustomer_B-1Img"]' },
      ],
      timeout: 3000,
    });
    await locator.click();

    const { locator: selectAllCheckbox } = await heal(f, {
      id: 'accountReceivableReport.customerSelectionSelectAll',
      label: 'Select All customers',
      strategies: [
        {
          type: 'css',
          value: '#ctl00_MainContent_ReportFrameWork1_cbpReport_cbpReportFrameworkParameter_rpReportFramework_formReportFrameworkParameter_cbCustomer_glCustomer_DDD_gv_DXSelAllBtn0_D',
        },
        { type: 'css', value: '[id$="_cbCustomer_glCustomer_DDD_gv_DXSelAllBtn0_D"]' },
      ],
      timeout: 5000,
    });
    await selectAllCheckbox.click();
  }

  /** Same self-skip behavior as the other two report categories' viewGrid(). */
  async viewGrid() {
    const f = this.reportFrame;
    const button = f.locator('span:text-is("View Grid")');
    const present = await button.count().catch(() => 0);
    if (!present || !(await button.first().isVisible().catch(() => false))) {
      return; // this report has no View Grid step — nothing to do
    }

    const { locator } = await heal(f, {
      id: 'accountReceivableReport.viewGridButton',
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
   * Same shape as the other two report categories' previewReport().
   *
   * Confirmed live (2026-07-27, Warranty Due Listing): a heavy report can
   * leave `#ctl00_LoadingPanel_LD` intercepting clicks on the "Preview
   * Report" button itself for well over 20s (34+ retries observed) — the
   * button click timeout needs the same generous allowance already given
   * to printReport()'s frame search, not just a pre-click hidden-wait.
   */
  async previewReport(templateName = 'Customer Outstanding By Customer') {
    const f = this.reportFrame;
    await this._waitForLoadingPanelHidden();
    const { locator: previewReportButton } = await heal(f, {
      id: 'accountReceivableReport.previewReportButton',
      label: 'Preview Report',
      strategies: [
        {
          type: 'css',
          value: '#ctl00_MainContent_ReportFrameWork1_cbpReport_cbpReportFramework_formReportFramework_btnPrint_CD',
        },
        { type: 'role', role: 'button', options: { name: 'Preview Report' } },
        { type: 'text', value: 'Preview Report', options: { exact: true } },
      ],
      timeout: 3000,
    });
    await previewReportButton.click({ timeout: 60000 });

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
      id: 'accountReceivableReport.previewConfirmButton',
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
   * NEW ARCHETYPE (confirmed live via Jin's own codegen recording,
   * 2026-07-26, Customer Point Statement): some reports in this category
   * generate ASYNCHRONOUSLY — after clicking Preview, instead of
   * rendering directly like every other report seen so far in this app,
   * the page shows "Your report is being processed." with a "Click here
   * to view Report Output Listing" link. Clicking it opens a listing
   * grid (`ReportOutput_cpnlSessions_gvDefault`) of past + in-progress
   * report sessions; the newest row (row 0, just generated) does NOT
   * have its "Preview"/"Download PDF" action links populated yet — per
   * Jin: you have to click "Refresh List" REPEATEDLY until that row's
   * own "preview" action cell (`cell0_3_preview`) actually appears,
   * THEN click it. His own recording needed 2 refreshes; this is
   * inherently variable (real server-side generation time), so this
   * polls rather than assuming a fixed number of clicks.
   *
   * Self-skip: if the "Click here..." link never appears within a few
   * seconds, this report rendered synchronously like every other report
   * in General Ledger / Account Payable / this category's own Customer
   * Outstanding — nothing to do, `printReport()` can proceed directly.
   * Call this BETWEEN `previewReport()` and `printReport()` for every
   * report in this category until proven otherwise — don't assume a new
   * report is synchronous just because the last one was (Customer
   * Outstanding was; this one wasn't).
   */
  async handleAsyncReportOutputIfPresent() {
    const p = this.page;

    const clickHereFrame = await findFrame(p, async (frame) => {
      const link = frame.locator('span').filter({ hasText: 'Click here to view Report' });
      return (await link.count().catch(() => 0)) > 0 && (await link.first().isVisible().catch(() => false));
    }, { timeout: 8000 });
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

    // Poll: click Refresh List and check again, rather than assuming a
    // fixed number of clicks — real generation time varies.
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
   * Same shape as the other two report categories' printReport() —
   * timeout defaults to the same generous 60s frame-search window
   * established after Vendor Aging's data-volume lesson, since data
   * volume here is unknown until actually run.
   */
  async printReport() {
    const p = this.page;

    const printFrame = await findFrame(p, async (frame) => {
      const btn = frame.getByRole('button', { name: 'Print from Adobe Reader' });
      return (await btn.count()) > 0 && (await btn.first().isVisible().catch(() => false));
    }, { timeout: 60000 });
    if (!printFrame) {
      await p.screenshot({ path: 'test-results/debug-ar-report-print-button-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the report\'s print button — the preview may not have finished rendering. ' +
        'Saved test-results/debug-ar-report-print-button-not-found.png for inspection.'
      );
    }

    const [reportPage] = await Promise.all([
      p.context().waitForEvent('page', { timeout: 30000 }),
      printFrame.getByRole('button', { name: 'Print from Adobe Reader' }).click(),
    ]);

    await reportPage.waitForURL(/FastReport\.Export\.axd/i, { timeout: 15000 }).catch(() => {});
    return reportPage;
  }

  /** Per Jin's established rule: the print-preview tab appearing at all IS success. */
  isReportPageValid(reportPage) {
    return !!reportPage && !reportPage.isClosed();
  }
}

module.exports = { AccountReceivableReportPage };
