const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for the "Reports > General Ledger" CATEGORY (the #sub13 nav
 * entry) — covers any report catalog entry within it, not just the one
 * literally named "General Ledger". Class name kept as-is (not renamed to
 * something like "ReportsCategoryPage") since "General Ledger" is already
 * the established nav/category name Jin uses; this comment is the
 * disambiguation.
 *
 * ONE CORE SHAPE, one structural variable (2026-07-26, corrected same day
 * a second time): `View Grid` is present on some reports and absent on
 * others — `viewGrid()` self-skips when it's not there — but EVERY report
 * confirmed so far (8 of them) DOES show the "Reports Format"
 * template-picker dialog after clicking "Preview Report". An earlier
 * version of this comment claimed Bank Book Analysis skipped that dialog
 * too ("a third archetype") — wrong, based on incomplete manual
 * screenshots that just missed the moment it appeared. Jin's actual run
 * showed the dialog present with a single option ("Bank book analysis");
 * the real bug was the caller not passing that name, not the dialog being
 * absent. Lesson: don't invent a new "skips this step" archetype from a
 * screenshot sequence that might just be incomplete — a self-skip check
 * (like `viewGrid()`'s) is the safe way to handle real absence, not an
 * assumption baked into the caller.
 * So the one call sequence for every report in this category is:
 * `goto(name) -> [any report-specific prerequisite, e.g. goToPreviousMonth()
 * / selectBank()] -> viewGrid() -> previewReport(value) -> printReport()`
 * (or `expectReportMessage()` instead of `printReport()` for the one
 * report, Bank Reconciliations, that ends in a message instead of a PDF).
 * `previewReport()`'s own dialog-detection self-skip stays in place as a
 * genuine defensive fallback — just don't reach for "this report must be
 * the exception" as the first explanation when a run fails to interact
 * with a dialog; check whether it's actually there first.
 *
 * Getting Trial Balance's `goto()` right needed a real fix, root-caused
 * via a live failure snapshot, not guessed: "Preview Report" there is NOT
 * a plain `<span>` — it's a `button`-role element sitting inside a
 * compound wrapper (a separate text label alongside it, not inside it).
 * A combined `'#id, span:text-is(...)'` locator string had its span half
 * silently match nothing. Fixed by checking the id and the
 * `getByRole('button', {name:...})` shape as two INDEPENDENT checks
 * (not comma-joined into one selector string) — same lesson as the
 * Cash Sales OK-button saga: don't trust a combined/compound selector
 * string to gracefully fall back; check alternatives separately when the
 * underlying DOM shape is actually uncertain.
 *
 * SOURCE (Jin, 2026-07-24, extended 2026-07-26): built directly from
 * Playwright codegen recordings Jin made himself against the live UAT
 * instance — NOT from the old Katalon scripts (this module has no Katalon
 * equivalent in the `katalon script` sibling folder). This is first-party,
 * freshly-verified ground truth, one level more trustworthy than the Cash
 * Sales pilot's carried-over Katalon IDs: every selector below is confirmed
 * to have actually worked, in this exact sequence, moments before
 * conversion — for all three reports recorded so far.
 *
 * Structure (same iframe-instability pattern already established for Cash
 * Sales / Create Item — see those page objects): the recordings captured
 * literal iframe names ("152", "16"/"17"/"18", "undefined"), but those are
 * session-specific per the app's own DevExpress callback-panel behavior
 * and are NOT safe to hardcode. Converted to `findFrame()` scans for a
 * matching visible element instead, same as the rest of this framework.
 * Concretely, four separate frames are involved in sequence:
 * 1. The nav frame (main page) — Reports -> General Ledger link click.
 * 2. A report-catalog frame — lists report categories/names to click into.
 * 3. A report-runtime frame — anchored on the "Preview Report" button
 *    specifically (not "View Grid", which isn't present in every report —
 *    see the Form archetype below). View Grid (when present) / Preview
 *    Report / template-or-value picker / final "Preview" confirm all
 *    happen here.
 * 4. The print button then lives in a FOURTH, separately-loaded frame
 *    (recorded as name="undefined" — same unstable-name quirk as Create
 *    Item's form frame) that appears only after the report actually
 *    renders. Clicking it opens a genuinely separate browser tab/popup
 *    (`window.open`), matching the exact same print-to-new-tab pattern
 *    already confirmed for the Cash Sales GST report — see
 *    `cashSalesPage.js`'s `printReport()` for the sibling implementation
 *    (`context.waitForEvent('page')` racing the click — NOT `'popup'`;
 *    `browserContext` has no such event, only `Page` does. An earlier
 *    version of this file used `'popup'` by mistake and looked like a
 *    timeout problem — three rounds of raising the timeout (10s/30s/90s)
 *    "still failed" the same way every time because the event could
 *    never fire at all, not because the wait was too short. Fixed.)
 *
 * Login itself is untouched — the recording used the exact same selectors
 * already in `loginHelper.js` (`#cbpCallback_txtClientId_I` etc.), which
 * re-confirms those are still correct; nothing to change there.
 */
class GeneralLedgerReportPage {
  constructor(page) {
    this.page = page;
    this.catalogFrame = null; // resolved by goto()
    this.reportFrame = null; // resolved by goto()
  }

  /**
   * @param {string} reportName - the catalog entry to click into (e.g.
   *   "General Ledger", "Journal Of Transaction"). Defaults to "General
   *   Ledger" for backward compatibility with the original pilot.
   */
  async goto(reportName = 'General Ledger') {
    const p = this.page;

    const reportsLink = p.getByRole('link', { name: 'Reports', exact: true });
    await reportsLink.click();
    // Scoped to the Reports fold's own submenu container to disambiguate
    // from any other "General Ledger" link elsewhere in the nav — this is
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
    await p.locator(`#${reportsSubmenuId}`).getByRole('link', { name: 'General Ledger', exact: true }).click();

    this.catalogFrame = await findFrame(p, async (frame) => {
      const item = frame.locator('span').filter({ hasText: reportName });
      return (await item.count()) > 0 && (await item.first().isVisible().catch(() => false));
    });
    if (!this.catalogFrame) {
      await p.screenshot({ path: 'test-results/debug-gl-report-catalog-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        `Could not find "${reportName}" in the report catalog after clicking Reports > General Ledger. ` +
        'Saved test-results/debug-gl-report-catalog-not-found.png for inspection.'
      );
    }
    await this.catalogFrame.locator('span').filter({ hasText: reportName }).first().click();

    // Confirmed via codegen (General Ledger, Journal Of Transaction, AND
    // Trial Balance — 2026-07-26): some reports in this category skip
    // straight to a parameter form with NO "View Grid" step at all (Trial
    // Balance's "Preview Report" button is the same element, just
    // rendered as a prominent button instead of a small toolbar icon —
    // same id: ...btnPrint_CD). "Preview Report" is the one element
    // confirmed present in EVERY report variant seen so far, so anchor
    // frame detection on that instead of "View Grid", which isn't
    // universal.
    // Root-caused via a live failure snapshot (Jin, 2026-07-26): on Trial
    // Balance, "Preview Report" is NOT a plain <span> — it's a
    // `button`-role element inside a compound wrapper (a separate text
    // label sits alongside it, not inside it), so a combined
    // `'#id, span:text-is(...)'` selector string's span half could never
    // match. Checking the id and the role separately (not comma-joined)
    // instead of trusting one combined selector string to parse safely.
    this.reportFrame = await findFrame(p, async (frame) => {
      const byId = frame.locator('#ctl00_MainContent_ReportFrameWork1_cbpReport_cbpReportFramework_formReportFramework_btnPrint_CD');
      if ((await byId.count().catch(() => 0)) > 0 && (await byId.first().isVisible().catch(() => false))) {
        return true;
      }
      const byRole = frame.getByRole('button', { name: 'Preview Report' });
      return (await byRole.count().catch(() => 0)) > 0 && (await byRole.first().isVisible().catch(() => false));
    });
    if (!this.reportFrame) {
      await p.screenshot({ path: 'test-results/debug-gl-report-runtime-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        `Could not find the report runtime frame after clicking into the "${reportName}" report. ` +
        'Saved test-results/debug-gl-report-runtime-not-found.png for inspection.'
      );
    }
  }

  /**
   * Confirmed via codegen — renders the report's data grid before it can
   * be previewed. NOT universal: confirmed absent entirely on Trial
   * Balance (2026-07-26), which goes straight to a parameter form (Date /
   * Trial Balance Type / Report Format / Export To) with no grid step.
   * Self-skips when the button isn't present, rather than requiring every
   * caller to know in advance which archetype a given report is — so the
   * same `goto() -> viewGrid() -> previewReport() -> printReport()`
   * sequence works unmodified whether or not a report has this step.
   */
  async viewGrid() {
    const f = this.reportFrame;
    const button = f.locator('span:text-is("View Grid")');
    const present = await button.count().catch(() => 0);
    if (!present || !(await button.first().isVisible().catch(() => false))) {
      return; // this report has no View Grid step — nothing to do
    }

    const { locator } = await heal(f, {
      id: 'generalLedgerReport.viewGridButton',
      label: 'View Grid',
      strategies: [
        { type: 'css', value: 'span:text-is("View Grid")' },
        { type: 'text', value: 'View Grid', options: { exact: true } },
      ],
      timeout: 3000,
    });
    await locator.click();
  }

  /**
   * Confirmed via codegen (both General Ledger and Journal Of Transaction
   * recordings): click "Preview Report" (a specific toolbar button, same
   * `..._btnPrint_CD` naming convention as Cash Sales's toolbar buttons),
   * pick the report template from the resulting list (parametrized — each
   * recording used the template name matching its own report name), then
   * confirm with the "Preview" button.
   *
   * The two recordings picked the template differently: General Ledger's
   * used a plain text locator, Journal Of Transaction's used
   * `getByRole('cell', ...)`. Tries cell-role first (more specific, so
   * less likely to hit an ambiguous ancestor), falls back to plain text.
   */
  async previewReport(templateName = 'General Ledger') {
    const f = this.reportFrame;
    const { locator: previewReportButton } = await heal(f, {
      id: 'generalLedgerReport.previewReportButton',
      label: 'Preview Report',
      strategies: [
        {
          type: 'css',
          value: '#ctl00_MainContent_ReportFrameWork1_cbpReport_cbpReportFramework_formReportFramework_btnPrint_CD',
        },
        // Trial Balance's rendering of this same control has "Preview
        // Report" as a button-role element (confirmed via a live failure
        // snapshot), not a plain span — role-based fallback covers that
        // shape too, ahead of the plain-text guess.
        { type: 'role', role: 'button', options: { name: 'Preview Report' } },
        { type: 'text', value: 'Preview Report', options: { exact: true } },
      ],
      timeout: 3000,
    });
    await previewReportButton.click();

    // Confirmed via Jin's manual walkthrough (2026-07-26): some reports
    // (Bank Book Analysis) skip the "Reports Format" template-picker
    // dialog entirely — "Preview Report" goes STRAIGHT to the rendered
    // report. Same self-skip philosophy as viewGrid(): detect absence and
    // return early rather than assume every report has this dialog.
    const dialogAppeared = await f.getByText('Reports Format', { exact: true }).first()
      .waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false);
    if (!dialogAppeared) {
      return; // no template dialog here — Preview Report already opened the result directly
    }

    // Root-caused via a live failure (Jin, 2026-07-26): on Trial Balance,
    // the underlying parameter form stays present (just dimmed) behind
    // this popup, and it ALREADY shows the same value in its own "Report
    // Format" dropdown — so a bare text/role search for e.g. "This Year"
    // can match THAT dropdown's filter cell instead of the popup's actual
    // selectable row. The wrong match's id contained "_Filter"
    // (`..._cbYearFormat_Filter`) — exclude that shape explicitly, ahead
    // of the plain cell/text checks that already work fine for General
    // Ledger / Journal Of Transaction (kept as fallbacks, unchanged).
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
      id: 'generalLedgerReport.previewConfirmButton',
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
   * Confirmed via codegen: after Preview renders, a print button appears in
   * yet another dynamically-named frame and opens a genuine new browser
   * tab (`window.open`) — same pattern as Cash Sales's printReport(), see
   * that method's comment for the general technique. Returns the new Page.
   */
  async printReport() {
    const p = this.page;

    const printFrame = await findFrame(p, async (frame) => {
      const btn = frame.getByRole('button', { name: 'Print from Adobe Reader' });
      return (await btn.count()) > 0 && (await btn.first().isVisible().catch(() => false));
    });
    if (!printFrame) {
      await p.screenshot({ path: 'test-results/debug-gl-report-print-button-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the report\'s print button — the preview may not have finished rendering. ' +
        'Saved test-results/debug-gl-report-print-button-not-found.png for inspection.'
      );
    }

    // ROOT CAUSE found (Jin, 2026-07-26) after two rounds of chasing the
    // wrong thing (10s, then 30s, then 90s timeouts, each "still failing"):
    // this was never a timing problem. `browserContext` has no `'popup'`
    // event — that event only exists on `Page` (`page.on('popup', ...)`).
    // `context().waitForEvent('popup', ...)` was listening for an event
    // that can NEVER fire, so it was guaranteed to exhaust whatever
    // timeout was set, every single time, regardless of value — which is
    // exactly why increasing it never helped, even though the report kept
    // rendering successfully underneath (visible in every failure
    // screenshot). The correct context-level event is `'page'` — same one
    // already used correctly in cashSalesPage.js's printReport(), which is
    // why that one worked first try. Fixed to match.
    const [reportPage] = await Promise.all([
      p.context().waitForEvent('page', { timeout: 30000 }),
      printFrame.getByRole('button', { name: 'Print from Adobe Reader' }).click(),
    ]);

    // Per Jin: the report tab appearing at all IS success — don't let a
    // slow-to-settle URL/load state turn that into a failure. Best-effort
    // wait, but never throw past this point.
    await reportPage.waitForURL(/FastReport\.Export\.axd/i, { timeout: 15000 }).catch(() => {});
    return reportPage;
  }

  /**
   * Per Jin: the print-preview tab appearing at all IS success — don't
   * require its URL to have already settled on the FastReport pattern by
   * the moment this is checked (report render time varies, and that's not
   * a failure condition). Only "no new tab ever showed up / it's already
   * closed" counts as failure.
   */
  isReportPageValid(reportPage) {
    return !!reportPage && !reportPage.isClosed();
  }

  /**
   * CONFIRMED via a live codegen recording (Jin, 2026-07-26) — replaces an
   * earlier UNCONFIRMED guess that was wrong on two counts: it targeted a
   * plain "Date"-labeled input (the real trigger is an `<img>` icon with a
   * completely different id), and it assumed clicking the "previous month"
   * arrow alone would apply the change — it doesn't; the calendar just
   * changes its DISPLAYED month, and you still have to click a day cell
   * for the field's actual value to update. Real flow: click the
   * calendar-icon trigger -> click the "previous month" arrow (itself an
   * `<img>` whose accessible name is literally "<", not "Prev") -> click
   * the day cell matching today's day-of-month. The recording hardcoded
   * "26" (today's date when Jin recorded it) — generalized here to the
   * actual current day so this isn't locked to one specific calendar
   * date. The recording also needed `.nth(1)` to disambiguate — the
   * calendar grid shows overlapping day numbers from adjacent months, and
   * the second match was the correct (in-focus-month) one.
   * UNCONFIRMED edge case: if the target month has fewer days than
   * today's day-of-month (e.g. today is the 31st and the previous month
   * only has 30 days), this exact day cell may not exist — not yet
   * handled, no live evidence yet of what the calendar does then.
   */
  async goToPreviousMonth() {
    const f = this.reportFrame;
    const { locator: dateFieldTrigger } = await heal(f, {
      id: 'generalLedgerReport.dateFieldTrigger',
      label: 'Date',
      strategies: [
        {
          type: 'css',
          value: '#ctl00_MainContent_ReportFrameWork1_cbpReport_cbpReportFrameworkParameter_rpReportFramework_formReportFrameworkParameter_cbDocDate_dtDocDate_B-1Img',
        },
        { type: 'css', value: 'img[id*="DocDate" i][id*="B-1Img" i]' },
        { type: 'css', value: 'img[id*="dtDocDate" i]' },
      ],
      timeout: 3000,
    });
    await dateFieldTrigger.click();

    const { locator: prevMonthButton } = await heal(f, {
      id: 'generalLedgerReport.calendarPrevMonthButton',
      label: 'Previous Month',
      strategies: [
        { type: 'role', role: 'img', options: { name: '<', exact: true } },
      ],
      timeout: 3000,
    });
    await prevMonthButton.click();

    const dayOfMonth = String(new Date().getDate());
    await f.getByRole('cell', { name: dayOfMonth, exact: true }).nth(1).click();
  }

  /**
   * UNCONFIRMED (Jin, 2026-07-26) — built from a manual-walkthrough
   * description only, not a codegen recording. Needed for Bank
   * Reconciliations, which requires picking a Bank via a search popup
   * before Preview Report will do anything useful. Same shape as Cash
   * Sales's selectCustomer() (search icon -> popup grid -> click matching
   * row -> OK) — reuses the already-proven dx-vam :visible OK-button fix
   * proactively instead of waiting to hit that same bug again.
   */
  async selectBank(bankCode) {
    const f = this.reportFrame;
    const { locator: trigger } = await heal(f, {
      id: 'generalLedgerReport.bankSearchTrigger',
      label: 'Bank',
      strategies: [
        { type: 'css', value: 'img[id*="Bank" i]:visible' },
        { type: 'role', role: 'img', options: { name: /search/i } },
      ],
      timeout: 3000,
    });
    await trigger.click();

    const popupFrame = (await findFrame(this.page, async (frame) => {
      const cell = frame.getByRole('cell', { name: bankCode, exact: true });
      return (await cell.count()) > 0;
    })) || f;

    await popupFrame.getByRole('cell', { name: bankCode, exact: true }).first().click();

    // Same root-caused dx-vam ambiguity as every other OK button in this
    // app (Cash Sales's Customer/Item/MultiPayment popups) — settle wait
    // first, then the :visible-scoped fix, applied proactively here.
    await this.page.waitForTimeout(800);
    const { locator: okButton } = await heal(popupFrame, {
      id: 'generalLedgerReport.bankPopupOkButton',
      label: 'OK',
      strategies: [
        { type: 'css', value: 'span.dx-vam:visible:text-is("OK")' },
        { type: 'text', value: 'OK', options: { exact: true } },
      ],
      timeout: 5000,
    });
    await okButton.click();
  }

  /**
   * Some reports (Bank Reconciliations) don't produce a print/PDF flow at
   * all — Preview just shows a plain instructional message (e.g. "Please
   * do bank reconciliation for related month."). Per Jin, reaching that
   * message IS success for those reports.
   *
   * ROOT-CAUSED (Jin, 2026-07-26), after wrongly blaming timing first: the
   * 30s bump didn't help because this was never a timeout problem.
   * `page.waitForSelector()` only searches the TOP-LEVEL page — it never
   * descends into iframes, no matter how long you wait. Jin's failure
   * snapshot confirmed the message text was there in the DOM all along,
   * just nested inside an `<iframe>` (this report's content frame, same
   * as every other report in this category). Fixed by scanning all frames
   * with `findFrame()` — the same helper used everywhere else in this
   * page object — instead of a bare page-level selector. Same lesson as
   * the earlier `'popup'` vs `'page'` event bug: when a fix "still fails
   * the same way" after a generous timeout increase, stop tuning the
   * duration and check whether the call is even looking in the right
   * place.
   */
  async expectReportMessage(pattern) {
    const frame = await findFrame(this.page, async (f) => {
      const text = f.getByText(pattern);
      return (await text.count().catch(() => 0)) > 0;
    }, { timeout: 30000 });
    return !!frame;
  }
}

module.exports = { GeneralLedgerReportPage };
