const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for General Ledger (transactional module, #sub2) > Stock
 * Value. Originally converted from Katalon's single `SV` Object Repository
 * + groovy script (2022, stale) — CORRECTED against Jin's own codegen
 * recording of the full desired flow (2026-07-26): set a value, Save,
 * close the tab, reopen, delete the row, Save again — after he reported
 * "failed" against the Katalon-only version, which never even filled a
 * value or covered delete at all.
 *
 * DIFFERENT SHAPE from Journal Entry / Cash Book Payment/Receipt — there
 * is no separate "New record" detail form and no Post/Save Draft/New/Back
 * toolbar. Instead: an "Add" icon (Katalon oddly names it "Undo Update",
 * likely just auto-named from nearby text, not its real function) opens a
 * Project/Cost Centre picker popup directly on the main list screen:
 * 1. Click the Add icon.
 * 2. Click the Project dropdown trigger -> click a Project cell (e.g.
 *    "P1") -> click OK. This OK button's id IS fully scoped/specific
 *    (`...pcGeneralSearchControl...btnOk_CD`), NOT a generic dx-vam
 *    clone like Cash Sales's Customer/Item OK buttons.
 * 3. Click the Cost Centre dropdown trigger -> click a Cost Centre cell
 *    (e.g. "ST18") -> click OK (its own `pcGeneralSearchControl...btnOk_CD`
 *    scoped to Cost Centre). CORRECTED (Jin's codegen, 2026-07-26): an
 *    earlier version of this file claimed Cost Centre does NOT need an OK
 *    click, based on an incomplete Katalon recording that simply never
 *    exercised it — WRONG. Both pickers need their own OK click; don't
 *    assume "some pickers skip OK" again without checking a real
 *    recording of the FULL flow, not just a partial one.
 * 4. Click the Project/Cost Centre popup's own Save (`btnSave_CD`) — this
 *    closes that popup and creates a new row in the main grid.
 * 5. Click the target month's numeric cell TWICE (`.dxgv.dx-ar`, confirmed
 *    live — a single click selects the cell, a second click actually
 *    enters edit mode) to open its input, then fill + Tab to commit —
 *    same DevExpress batch-grid commit gap documented in
 *    cashBookPaymentPage.js/journalEntryPage.js. `DXEditor15_I` is
 *    confirmed live for whichever month column renders first (Jin's
 *    recording used it for "Oct-2019") — a different fiscal
 *    year/scroll position could expose a different id; not generalized
 *    to other months since only one value was ever needed here.
 * 6. Click the MAIN toolbar Save (`mOBToolBar_mToolBars_DXI4_T` — same
 *    DXI4 numbering slot as Save Draft elsewhere, plain "Save" here).
 * 7. To prove real persistence (not just client-side state that never
 *    left the page), Jin's flow explicitly closes the Stock Value tab and
 *    reopens it before deleting — `goto()` below is written to be
 *    idempotent (checks whether the Stock Value nav link is already
 *    visible before re-clicking the collapsible "General Ledger" toggle,
 *    since that's a Bootstrap collapse panel that would otherwise
 *    COLLAPSE on a second click and hide the link it's trying to reveal).
 * 8. Click the row's "Delete" link (a plain text link once a row exists —
 *    different from the icon-only Add button), then click the MAIN Save
 *    again to persist the deletion.
 */
class StockValuePage {
  constructor(page) {
    this.page = page;
    this.listFrame = null; // resolved by goto()
  }

  /**
   * Idempotent — safe to call more than once in the same test (e.g. after
   * closeTab()) without accidentally collapsing the "General Ledger" nav
   * panel on a second click (it's a Bootstrap collapse toggle, not a
   * plain expand-only control).
   */
  async goto() {
    const p = this.page;

    const stockValueLink = p.getByRole('link', { name: 'Stock Value', exact: true });
    if (!(await stockValueLink.isVisible().catch(() => false))) {
      await p.getByRole('link', { name: 'General Ledger', exact: true }).click();
    }
    await stockValueLink.click();
    // BUG FIXED (live run, 2026-07-26): 'networkidle' hung the full test
    // timeout on this screen — Stock Value likely has some background
    // polling that keeps the network "active" indefinitely, unlike the
    // other GL module screens where this same wait worked fine. Use the
    // much looser 'domcontentloaded' instead and let findFrame()'s own
    // poll/retry loop (below) handle waiting for the actual target to
    // render, rather than hard-blocking on network idleness this screen
    // apparently never reaches.
    await p.waitForLoadState('domcontentloaded');

    // BUG FIXED TWICE (live run, 2026-07-26): first tried matching this
    // control by accessible name ("Click Here Or Press [Insert]"/"Undo
    // Update" — Katalon's stale recording's shape) — never matched.
    // Then tried a visible "+ New" text button — also never matched,
    // because a live DOM dump showed the actual element IS the confirmed
    // `<img id="...addButton_PRJCC">` (same id already used in
    // clickAdd()), it just has no title/alt text at all, and the visible
    // "New" label is a separate sibling element, not on the img itself.
    // Fixed to detect by the SAME confirmed id-substring the click target
    // uses, instead of guessing at role/name/text a third time.
    this.listFrame = await findFrame(p, async (frame) => {
      const addIcon = frame.locator('[id*="gvStockValueMaintenance" i][id*="addButton" i]');
      return (await addIcon.count()) > 0 && (await addIcon.first().isVisible().catch(() => false));
    });
    if (!this.listFrame) {
      await p.screenshot({ path: 'test-results/debug-stock-value-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the frame containing the "Add" icon on the Stock Value list page. ' +
        'Saved test-results/debug-stock-value-list-page.png for inspection.'
      );
    }
  }

  async clickAdd() {
    const { locator: addIcon } = await heal(this.listFrame, {
      id: 'stockValue.addIcon',
      label: 'Add',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_StockValue_cpnlStockValue_frmStockValue_gvStockValueMaintenance_header0_addButton_PRJCC' },
        { type: 'css', value: '[id*="gvStockValueMaintenance" i][id*="addButton" i]' },
        { type: 'text', value: 'New', options: { exact: true } },
      ],
      timeout: 3000,
    });
    await addIcon.click();
    await this.page.waitForTimeout(800);
  }

  /**
   * Picks a Project and a Cost Centre, each via its own popup search + OK
   * click (CORRECTED — see class header comment). Call clickAdd() first.
   */
  async selectProjectAndCostCentre({ project, costCentre }) {
    const p = this.page;

    if (project) {
      const { locator: projectTrigger } = await heal(this.listFrame, {
        id: 'stockValue.projectTrigger',
        label: 'Project',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_StockValue_cpnlStockValue_pcProjectCostCentre_formPopup_cbProject_B0Img' },
          { type: 'css', value: 'img[id*="cbProject" i][id*="B0Img" i]' },
        ],
        timeout: 3000,
      });
      await projectTrigger.click();

      const popupFrame = (await findFrame(p, async (frame) => {
        const cell = frame.getByRole('cell', { name: project, exact: true });
        return (await cell.count()) > 0;
      })) || this.listFrame;
      await popupFrame.getByRole('cell', { name: project, exact: true }).first().click();
      await p.waitForTimeout(500);

      const { locator: okButton } = await heal(popupFrame, {
        id: 'stockValue.projectPopupOkButton',
        label: 'OK',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_StockValue_cpnlStockValue_pcProjectCostCentre_gsc_cbProject_pcGeneralSearchControl_cpnlGeneralSearchControl_formGeneralSearchControl_btnOk_CD' },
          { type: 'css', value: '[id*="GeneralSearchControl" i][id*="btnOk" i]:visible' },
          { type: 'text', value: 'OK', options: { exact: true } },
        ],
        timeout: 5000,
      });
      await okButton.click();
      await p.waitForTimeout(500);
    }

    if (costCentre) {
      const { locator: costCentreTrigger } = await heal(this.listFrame, {
        id: 'stockValue.costCentreTrigger',
        label: 'Cost Centre',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_StockValue_cpnlStockValue_pcProjectCostCentre_formPopup_cbCostCentre_B0Img' },
          { type: 'css', value: 'img[id*="cbCostCentre" i][id*="B0Img" i]' },
        ],
        timeout: 3000,
      });
      await costCentreTrigger.click();

      const popupFrame = (await findFrame(p, async (frame) => {
        const cell = frame.getByRole('cell', { name: costCentre, exact: true });
        return (await cell.count()) > 0;
      })) || this.listFrame;
      await popupFrame.getByRole('cell', { name: costCentre, exact: true }).first().click();
      await p.waitForTimeout(500);

      // CORRECTED (Jin's codegen, 2026-07-26): Cost Centre DOES need its
      // own OK click — see class header comment. Own scoped id, same
      // "not a generic dx-vam clone" shape as the Project OK button.
      const { locator: okButton } = await heal(popupFrame, {
        id: 'stockValue.costCentrePopupOkButton',
        label: 'OK',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_StockValue_cpnlStockValue_pcProjectCostCentre_gsc_cbCostCentre_pcGeneralSearchControl_cpnlGeneralSearchControl_formGeneralSearchControl_btnOk_CD' },
          { type: 'css', value: '[id*="GeneralSearchControl" i][id*="btnOk" i]:visible' },
          { type: 'text', value: 'OK', options: { exact: true } },
        ],
        timeout: 5000,
      });
      await okButton.click();
      await p.waitForTimeout(500);
    }
  }

  /** Closes the Project/Cost Centre popup and creates the new row. Call after selectProjectAndCostCentre(). */
  async clickPopupSave() {
    const { locator: saveButton } = await heal(this.listFrame, {
      id: 'stockValue.popupSaveButton',
      label: 'Save',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_StockValue_cpnlStockValue_pcProjectCostCentre_formPopup_btnSave_CD' },
        { type: 'css', value: '[id*="pcProjectCostCentre" i][id*="btnSave" i]' },
      ],
      timeout: 3000,
    });
    await saveButton.click();
    await this.page.waitForTimeout(800);
  }

  /**
   * Fills the value for whichever month column renders first (confirmed
   * live as `DXEditor15_I` — see class header comment). A single click
   * selects the cell; DevExpress needs a SECOND click to actually enter
   * edit mode (confirmed live, not guessed) before the input becomes
   * fillable.
   */
  async fillMonthValue(value) {
    const cell = this.listFrame.locator('.dxgv.dx-ar').first();
    await cell.click();
    await cell.click();
    await this.page.waitForTimeout(300);

    const { locator: valueInput } = await heal(this.listFrame, {
      id: 'stockValue.monthValueInput',
      label: 'Month value',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_StockValue_cpnlStockValue_frmStockValue_gvStockValueMaintenance_DXEditor15_I' },
        { type: 'css', value: 'input[id*="gvStockValueMaintenance" i][id*="DXEditor" i]' },
      ],
      timeout: 3000,
    });
    await valueInput.click();
    await valueInput.fill(String(value));
    await valueInput.press('Tab');
  }

  /** The main toolbar's own Save — same DXI4 slot as Save Draft elsewhere, different label on this screen. */
  async clickMainSave() {
    const { locator: saveButton } = await heal(this.listFrame, {
      id: 'stockValue.mainSaveButton',
      label: 'Save',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_StockValue_mOBToolBar_mToolBars_DXI4_T' },
        { type: 'css', value: '[id*="mOBToolBar" i][id*="DXI4_T" i]' },
        { type: 'text', value: 'Save', options: { exact: true } },
      ],
      timeout: 3000,
    });
    await saveButton.click();
    await this.page.waitForTimeout(1500);
  }

  /**
   * Closes the Stock Value tab (its own close icon — an icon-only link
   * with no accessible text, confirmed live). Best-effort/self-skip: if
   * the tab UI differs from what was recorded, this just no-ops rather
   * than failing the whole flow, since re-calling goto() afterward still
   * works whether or not the tab actually closed.
   */
  async closeTab() {
    await this.page.getByRole('link').filter({ hasText: /^$/ }).first().click({ timeout: 2000 }).catch(() => {});
  }

  /**
   * Clicks the row's "Delete" link. Confirmed live as a plain text link
   * (role=link, name "Delete") once a row exists — different from the
   * icon-only Add button used to create one.
   */
  async deleteRow() {
    const { locator: deleteLink } = await heal(this.listFrame, {
      id: 'stockValue.deleteLink',
      label: 'Delete',
      strategies: [
        { type: 'role', role: 'link', options: { name: 'Delete', exact: true } },
      ],
      timeout: 3000,
    });
    await deleteLink.click();
  }

  /** Convenience: Add -> pick Project/Cost Centre -> popup Save -> fill a month value -> main Save. */
  async createStockValue({ project, costCentre, value }) {
    await this.clickAdd();
    await this.selectProjectAndCostCentre({ project, costCentre });
    await this.clickPopupSave();
    if (value != null) await this.fillMonthValue(value);
    await this.clickMainSave();
  }

  /**
   * Full flow Jin asked for: create + save, close the tab, reopen (to
   * prove real server-side persistence, not just client-side state that
   * never left the page), delete the row, save again.
   */
  async createSaveCloseReopenAndDelete({ project, costCentre, value }) {
    await this.createStockValue({ project, costCentre, value });
    await this.closeTab();
    await this.goto();
    await this.deleteRow();
    await this.clickMainSave();
  }
}

module.exports = { StockValuePage };
