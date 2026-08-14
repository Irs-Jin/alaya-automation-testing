const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for the "Reports > Account Payable" CATEGORY (the #sub13
 * nav entry) — covers any report catalog entry within it, not just one
 * report. Same shape as `generalLedgerReportPage.js`'s Reports category
 * ("one core shape, one structural variable: View Grid presence" — see
 * that file's header comment for the full rationale) — this is the SAME
 * underlying `ReportFrameWork1` reports framework, just a different
 * catalog. Built directly from Jin's own codegen recording (2026-07-26),
 * for "Vendor Outstanding" — confirmed to have the full View Grid ->
 * Preview Report -> "Reports Format" template picker -> Preview -> Print
 * sequence, identical ids to the General Ledger category
 * (`...ReportFrameWork1_cbpReport_cbpReportFramework_formReportFramework_btnPrint_CD`
 * for Preview Report, `getByRole('button', {name: 'Print from Adobe
 * Reader'})` in a separately-loaded frame for the final print).
 *
 * The one call sequence for every report in this category (same as
 * General Ledger's): `goto(name) -> viewGrid() -> previewReport(value)
 * -> printReport()`. `viewGrid()`/`previewReport()`'s self-skip behavior
 * is inherited as-is — don't assume a report here needs a special case
 * before actually seeing it fail.
 */
class AccountPayableReportPage {
  constructor(page) {
    this.page = page;
    this.catalogFrame = null; // resolved by goto()
    this.reportFrame = null; // resolved by goto()
  }

  /**
   * @param {string} reportName - the catalog entry to click into (e.g.
   *   "Vendor Outstanding", "Vendor Aging"). Defaults to "Vendor
   *   Outstanding" since that's the first report converted here.
   */
  async goto(reportName = 'Vendor Outstanding') {
    const p = this.page;

    const reportsLink = p.getByRole('link', { name: 'Reports', exact: true });
    await reportsLink.click();
    // Scoped to the Reports fold's own submenu container to disambiguate
    // from any other "Account Payable" link elsewhere in the nav — this is
    // the CATEGORY link, same for every report within it.
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
    await p.locator(`#${reportsSubmenuId}`).getByRole('link', { name: 'Account Payable', exact: true }).click();

    this.catalogFrame = await findFrame(p, async (frame) => {
      const item = frame.locator('span').filter({ hasText: reportName });
      return (await item.count()) > 0 && (await item.first().isVisible().catch(() => false));
    });
    if (!this.catalogFrame) {
      await p.screenshot({ path: 'test-results/debug-ap-report-catalog-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        `Could not find "${reportName}" in the report catalog after clicking Reports > Account Payable. ` +
        'Saved test-results/debug-ap-report-catalog-not-found.png for inspection.'
      );
    }
    await this.catalogFrame.locator('span').filter({ hasText: reportName }).first().click();

    // Same anchor choice as generalLedgerReportPage.js: "Preview Report"
    // is the one element confirmed present regardless of whether a given
    // report also has a "View Grid" step.
    this.reportFrame = await findFrame(p, async (frame) => {
      const byId = frame.locator('#ctl00_MainContent_ReportFrameWork1_cbpReport_cbpReportFramework_formReportFramework_btnPrint_CD');
      if ((await byId.count().catch(() => 0)) > 0 && (await byId.first().isVisible().catch(() => false))) {
        return true;
      }
      const byRole = frame.getByRole('button', { name: 'Preview Report' });
      return (await byRole.count().catch(() => 0)) > 0 && (await byRole.first().isVisible().catch(() => false));
    });
    if (!this.reportFrame) {
      await p.screenshot({ path: 'test-results/debug-ap-report-runtime-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        `Could not find the report runtime frame after clicking into the "${reportName}" report. ` +
        'Saved test-results/debug-ap-report-runtime-not-found.png for inspection.'
      );
    }
  }

  /** Same self-skip behavior as generalLedgerReportPage.js's viewGrid() — confirmed present for Vendor Outstanding. */
  async viewGrid() {
    const f = this.reportFrame;
    const button = f.locator('span:text-is("View Grid")');
    const present = await button.count().catch(() => 0);
    if (!present || !(await button.first().isVisible().catch(() => false))) {
      return; // this report has no View Grid step — nothing to do
    }

    const { locator } = await heal(f, {
      id: 'accountPayableReport.viewGridButton',
      label: 'View Grid',
      strategies: [
        { type: 'css', value: 'span:text-is("View Grid")' },
        { type: 'text', value: 'View Grid', options: { exact: true } },
      ],
      timeout: 3000,
    });
    await locator.click();
  }

  /** Same shape as generalLedgerReportPage.js's previewReport() — confirmed via codegen for Vendor Outstanding / "Vendor Outstanding By Vendor". */
  async previewReport(templateName = 'Vendor Outstanding By Vendor') {
    const f = this.reportFrame;
    const { locator: previewReportButton } = await heal(f, {
      id: 'accountPayableReport.previewReportButton',
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
    await previewReportButton.click();

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
      id: 'accountPayableReport.previewConfirmButton',
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
   * Same shape as generalLedgerReportPage.js's printReport() — confirmed
   * via codegen (context 'page' event, not 'popup').
   *
   * Timeout bumped (live run, 2026-07-26): Vendor Aging covers every
   * vendor's full aging breakdown (hundreds of rows in this UAT dataset)
   * and genuinely takes longer than the default 10s frame-search window
   * to finish rendering — a live failure screenshot showed the report
   * tab still on its loading spinner at the moment `findFrame()` gave up.
   * Same lesson already documented for the General Ledger reports
   * category: report/print timeouts should scale with expected data
   * volume, not be copied verbatim from a lighter report.
   */
  async printReport() {
    const p = this.page;

    const printFrame = await findFrame(p, async (frame) => {
      const btn = frame.getByRole('button', { name: 'Print from Adobe Reader' });
      return (await btn.count()) > 0 && (await btn.first().isVisible().catch(() => false));
    }, { timeout: 60000 });
    if (!printFrame) {
      await p.screenshot({ path: 'test-results/debug-ap-report-print-button-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the report\'s print button — the preview may not have finished rendering. ' +
        'Saved test-results/debug-ap-report-print-button-not-found.png for inspection.'
      );
    }

    const [reportPage] = await Promise.all([
      p.context().waitForEvent('page', { timeout: 30000 }),
      printFrame.getByRole('button', { name: 'Print from Adobe Reader' }).click(),
    ]);

    await reportPage.waitForURL(/FastReport\.Export\.axd/i, { timeout: 15000 }).catch(() => {});
    return reportPage;
  }

  /** Per Jin's established rule (see generalLedgerReportPage.js): the print-preview tab appearing at all IS success. */
  isReportPageValid(reportPage) {
    return !!reportPage && !reportPage.isClosed();
  }
}

module.exports = { AccountPayableReportPage };
