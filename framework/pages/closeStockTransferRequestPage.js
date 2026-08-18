const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Inventory > Close Stock Transfer Request.
 *
 * SOURCE: built directly from Jin's own Playwright codegen recordings
 * (2026-08-17/2026-08-18, two independent recordings both starting with
 * Copy From before Save Draft) plus a full live exploration/confirmation of
 * the same SIT environment (uat/admin) — no Katalon Object Repository entry
 * exists for this screen yet.
 *
 * WHAT MAKES THIS SCREEN DIFFERENT: unlike every other Inventory module
 * built this session, this screen does NOT populate its Items grid via a
 * manual item search. Instead it "closes" an existing PENDING/POSTED Stock
 * Transfer Request by copying its header + item lines in wholesale via the
 * "Copy From" toolbar button. CONFIRMED LIVE this requires From Warehouse,
 * To Warehouse, and Reason to already be filled BEFORE clicking Copy From —
 * clicking it on a blank form shows a validation toast ("Changes not
 * saved: From Warehouse is required / To Warehouse is required / Reason is
 * required") and does not open the picker.
 *
 * CONFIRMED LIVE (2026-08-18): clicking Copy From goes DIRECTLY to the
 * "TransferFrom" picker grid — no intermediate document-type selector
 * appeared in either of two independent live attempts (both via CLI
 * exploration and via Jin's own fresh recording), even though the very
 * first recording of this screen (2026-08-17) included an extra
 * `getByText('Stock Transfer Request', {exact:true})` click after Copy
 * From. Two independent, more-recent confirmations agreeing with each
 * other outweigh that one first recording — treated as a one-off UI
 * artifact, not a required step.
 *
 * CONFIRMED LIVE (2026-08-18): a source Stock Transfer Request remains
 * available in the TransferFrom picker after being copied into a DRAFT
 * Close Stock Transfer Request (i.e. copying into a draft does not consume
 * it). It disappears from the picker only once the Close document that
 * copied it is actually POSTED (Post or Post & New) — posting the closure
 * is what finalizes/consumes the source. This means: reuse one posted
 * source across multiple DRAFT-only tests if needed, but each Post/Post &
 * New test needs its OWN, not-yet-closed source document.
 *
 * CONFIRMED LIVE (2026-08-18): the TransferFrom grid sorts newest-first, so
 * a source document created immediately before opening the picker is
 * always its row 0 — but `selectCopyFromSource()` below still matches by
 * the source's own Reference No text rather than blind index, per this
 * repo's row-safety convention (never assume position; verify identity).
 *
 * CONFIRMED LIVE (2026-08-18): Post opens a NEW in-app workspace tab
 * ("Close Stock Transfer Request Summary Report"). Post & New does NOT
 * open a report tab on this screen (same pattern as Stock Transfer
 * Request/Stock Issue/Stock Adjustment) — it just posts and leaves a fresh
 * blank form in the SAME tab. Save Draft, Post, and Post & New all
 * complete with no confirmation dialog.
 *
 * CONFIRMED APP BUG (2026-08-18, verified via an actual clean Playwright
 * spec run, not just CLI exploration): this screen's row-level "Delete"
 * action (same app-wide Delete Confirmation dialog /
 * `pcConfirmDel_btnYes_CD` control used everywhere else in this app) shows
 * a "Delete Confirmation" dialog and a "Cancelled Successfully" toast, but
 * for a DRAFT-status row the row does NOT actually disappear — confirmed
 * three times independently (twice via CLI exploration, once via a real
 * `close-stock-transfer-request.spec.js` test run with a fresh reload
 * verification), including with `test.describe.configure`'s default
 * retry, which failed identically on the retry (a real bug, not a
 * load-related flake — see this repo's CONTRIBUTING.md on that
 * distinction). By contrast, the SAME action on a POSTED-status row
 * genuinely works — confirmed via two passing spec tests (Post, Post &
 * New) that create, post, delete, and verify-gone cleanly. So: Delete
 * works for POSTED Close Stock Transfer Request documents, but NOT for
 * DRAFT ones. `deleteDocument()`/`isDeleteSuccessful()` below still call
 * the real UI action (so POSTED cleanup keeps working) — callers deleting
 * a DRAFT document should expect `isDeleteSuccessful()` to genuinely
 * return `false` until this is fixed app-side; do not loosen this
 * assertion to hide it.
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable — always re-resolved via findFrame() by content, never
 * hardcoded.
 */
class CloseStockTransferRequestPage {
  constructor(page) {
    this.page = page;
    this.listFrame = null;
    this.formFrame = null;
  }

  /**
   * Scoped to `#navBar` — same confirmed fix as
   * stockTransferRequestPage.js's goto(): if a "Close Stock Transfer
   * Request" workspace tab is already open, the app's own open-tab bar
   * carries a link with the same accessible name, which would otherwise
   * cause a strict-mode ambiguity if goto() is ever called a second time
   * within one test.
   */
  async goto() {
    const p = this.page;
    await p.getByRole('link', { name: 'Inventory', exact: true }).click();
    await p.locator('#navBar').getByRole('link', { name: 'Close Stock Transfer Request', exact: true }).click();
    await p.waitForLoadState('domcontentloaded');
    await this._resolveListFrame();
  }

  async _resolveListFrame() {
    const p = this.page;
    this.listFrame = await findFrame(p, async (frame) => {
      const addIcon = frame.getByRole('img', { name: /Click Here Or Press \[Insert\]/i });
      return (await addIcon.count().catch(() => 0)) > 0 && (await addIcon.first().isVisible().catch(() => false));
    });
    if (!this.listFrame) {
      await p.screenshot({ path: 'test-results/debug-close-stock-transfer-request-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the frame containing the Close Stock Transfer Request list "New" icon. ' +
        'Saved test-results/debug-close-stock-transfer-request-list-page.png for inspection.'
      );
    }
  }

  /** CONFIRMED live (2026-08-18): "Reason:" genuinely has that accessible name on this screen's own form, same as Stock Transfer Request's. */
  async _resolveFormFrame() {
    const p = this.page;
    this.formFrame = await findFrame(p, async (frame) => {
      const field = frame.getByRole('textbox', { name: 'Reason:', exact: true });
      return (await field.count().catch(() => 0)) > 0 && (await field.first().isVisible().catch(() => false));
    });
    if (!this.formFrame) {
      await p.screenshot({ path: 'test-results/debug-close-stock-transfer-request-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Close Stock Transfer Request create/edit form frame (Reason field). ' +
        'Saved test-results/debug-close-stock-transfer-request-form-not-found.png for inspection.'
      );
    }
  }

  /** CONFIRMED live (2026-08-18): the grid header's own "New"/Insert icon. */
  async clickNew() {
    const addIcon = this.listFrame.getByRole('img', { name: /Click Here Or Press \[Insert\]/i }).first();
    await addIcon.waitFor({ state: 'visible', timeout: 5000 });
    await addIcon.click();
    await this._resolveFormFrame();
  }

  /** Opens the From Warehouse combo's dropdown and selects a row by its Code. */
  async selectFromWarehouse(warehouseCode) {
    const f = this.formFrame;
    const dropdownArrow = f.locator('#ctl00_MainContent_CloseStockTransferRequestDetail_cbpCloseStockTransferRequestDetails_ASPxRoundPanel1_formCloseStockTransferRequest_cbFromWarehouse_cbWarehouse_B-1Img');
    await dropdownArrow.click();
    await this.page.waitForTimeout(500);

    const option = f.getByRole('row', { name: `${warehouseCode} ${warehouseCode}`, exact: true }).first();
    await option.waitFor({ state: 'visible', timeout: 5000 });
    await option.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Opens the To Warehouse combo's dropdown and selects a row by its Code
   * — CONFIRMED live (2026-08-18) this list is NOT filtered against the
   * already-selected From Warehouse, matching Stock Transfer Request's own
   * confirmed behavior.
   */
  async selectToWarehouse(warehouseCode) {
    const f = this.formFrame;
    const dropdownArrow = f.locator('#ctl00_MainContent_CloseStockTransferRequestDetail_cbpCloseStockTransferRequestDetails_ASPxRoundPanel1_formCloseStockTransferRequest_cbToWarehouse_cbWarehouse_B-1Img');
    await dropdownArrow.click();
    await this.page.waitForTimeout(500);

    const option = f.getByRole('row', { name: `${warehouseCode} ${warehouseCode}`, exact: true }).first();
    await option.waitFor({ state: 'visible', timeout: 5000 });
    await option.click();
    await this.page.waitForTimeout(500);
  }

  /** Fills the header's mandatory Reason field — required before Copy From will proceed. */
  async fillReason(reason) {
    const field = this.formFrame.getByRole('textbox', { name: 'Reason:', exact: true });
    await field.click();
    await field.fill(reason);
  }

  /** Fills the header's Reference No field — the reliable way to find this specific document again, since Document No. stays "[DEFAULT]" until Posted. Keep to 20 characters or fewer (confirmed display truncation). */
  async fillReferenceNo(referenceNo) {
    const field = this.formFrame.getByRole('textbox', { name: 'Reference No:', exact: true });
    await field.click();
    await field.fill(referenceNo);
  }

  /**
   * Clicks the "Copy From" toolbar button and picks a source Stock
   * Transfer Request by matching its own Reference No text in the
   * "TransferFrom" picker grid (never by blind row index, even though the
   * newest document is always row 0 — see class doc). Confirms via the
   * picker's own "OK" button.
   *
   * CONFIRMED live (2026-08-18): must be called AFTER From Warehouse, To
   * Warehouse, and Reason are already filled, or the click is rejected
   * with a validation toast and no picker opens.
   */
  async copyFromSource(sourceReferenceNo) {
    const f = this.formFrame;
    const copyFromButton = f.getByRole('listitem', { name: 'Copy From [Alt + M]' });
    await copyFromButton.click();
    await this.page.waitForTimeout(800);

    // CONFIRMED live (2026-08-18): `getByRole('row', {name: ...})` against
    // this grid's accessible names is unreliable — DevExpress's nested
    // table markup made an accessible-name regex match every data row's
    // "U" select cell at once (a Playwright strict-mode violation across
    // ~10+ elements), not just the intended one. Matching by rendered TEXT
    // CONTENT on the actual grid data rows (scoped by their own confirmed
    // "gvTransferFrom_DXDataRow" id fragment) is what the picker's real
    // structure supports reliably.
    const pickerRows = f.locator('tr[id*="gvTransferFrom_DXDataRow"]').filter({ hasText: sourceReferenceNo });
    await pickerRows.first().waitFor({ state: 'visible', timeout: 10000 });
    const matchCount = await pickerRows.count();
    if (matchCount !== 1) {
      await this.page.screenshot({
        path: `test-results/debug-close-stock-transfer-request-copyfrom-ambiguous-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `Expected exactly one TransferFrom picker row matching "${sourceReferenceNo}", found ${matchCount} — ` +
        'refusing to guess which one to select.'
      );
    }
    const sourceRow = pickerRows.first();
    await sourceRow.getByRole('cell', { name: 'U', exact: true }).click();
    await this.page.waitForTimeout(300);

    const { locator: okButton } = await heal(f, {
      id: 'closeStockTransferRequest.transferFromOkButton',
      label: 'TransferFrom OK',
      strategies: [
        { type: 'css', value: '[id*="formTransferFrom_btnPurchaseTransferOk_CD" i]' },
      ],
      timeout: 5000,
    });
    await okButton.click();
    await this.page.waitForTimeout(800);
  }

  /** New -> From Warehouse -> To Warehouse -> Reason -> Reference No -> Copy From a source document. Stops before any save action. */
  async createCloseStockTransferRequest({ fromWarehouseCode = 'AMPANG', toWarehouseCode = 'BERCHAM RAYA', reason = 'Testing', referenceNo, sourceReferenceNo }) {
    await this.clickNew();
    await this.selectFromWarehouse(fromWarehouseCode);
    await this.selectToWarehouse(toWarehouseCode);
    await this.fillReason(reason);
    await this.fillReferenceNo(referenceNo);
    await this.copyFromSource(sourceReferenceNo);
  }

  /** CONFIRMED live (2026-08-18): no confirmation dialog appears for Save Draft on this screen. */
  async clickSaveDraft() {
    const saveButton = this.formFrame.getByRole('listitem', { name: 'Save Draft [Alt + S]' });
    await saveButton.click();
    await this.page.waitForTimeout(1000);
  }

  /** CONFIRMED live (2026-08-18): no confirmation dialog appears for Post either — opens a "Close Stock Transfer Request Summary Report" tab, and finalizes/consumes the copied-from source document. */
  async clickPost() {
    const postButton = this.formFrame.getByRole('listitem', { name: 'Post [Alt + P]' });
    await postButton.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * CONFIRMED live (2026-08-18): posts the current document (finalizing/
   * consuming its copied-from source, same as Post) and leaves a fresh
   * blank New form behind, all in the SAME tab — does NOT open a report
   * tab on this screen, matching Stock Transfer Request's own confirmed
   * behavior.
   */
  async clickPostAndNew() {
    const postAndNewButton = this.formFrame.getByRole('listitem', { name: 'Post & New [Alt + Ctrl + P]' });
    await postAndNewButton.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * CONFIRMED live (2026-08-18): Post (but not Post & New, on this screen)
   * opens a NEW in-app workspace tab ("Close Stock Transfer Request
   * Summary Report") that becomes frontmost, leaving the "Close Stock
   * Transfer Request" tab's own toolbar uninteractable until switched back
   * to. Best-effort — a no-op if there's nothing to switch.
   */
  async _switchBackToCloseStockTransferRequestTab() {
    await this.page.getByRole('link', { name: 'Close Stock Transfer Request', exact: true }).last()
      .click({ timeout: 3000 }).catch(() => {});
    await this.page.waitForTimeout(500);
  }

  /**
   * Re-resolves the form frame before looking for Back — Post & New
   * rebuilds the SAME tab's form in place, genuinely detaching any
   * previously-cached frame reference (same fix as
   * stockTransferRequestPage.js/stockAdjustmentPage.js/arCreditNotePage.js).
   */
  async clickBack() {
    await this._switchBackToCloseStockTransferRequestTab();
    await this._resolveFormFrame().catch(() => {});
    const backButton = this.formFrame.getByRole('listitem', { name: 'Back [Alt + B]' });
    await backButton.click();
    await this.page.waitForTimeout(1000);
    await this._resolveListFrame();
  }

  async getStatus() {
    const field = this.formFrame.getByRole('textbox', { name: 'Status:', exact: true });
    return (await field.inputValue().catch(() => null)) || (await field.textContent().catch(() => null));
  }

  /** Waits for a genuine GRID DATA ROW matching the given Reference No — same principle as every other module's equivalent. */
  async _waitForRowMatchingReference(referenceNo, timeout = 15000) {
    const escaped = referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dataRowPattern = new RegExp(`^CloseStockTransferRequestDetail\\s+Delete\\b.*\\b${escaped}\\b`, 'i');
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

  /**
   * The row's own action link is genuinely labelled "Delete" (not
   * "Cancel"), using the same app-wide "Delete Confirmation" dialog /
   * `pcConfirmDel_btnYes_CD` control confirmed everywhere else in this
   * app. Scoped to this.listFrame, never page-wide.
   *
   * SEE CLASS DOC "OPEN ISSUE": live CLI exploration of this exact action
   * showed the row NOT actually disappearing despite the dialog + success
   * toast. This method is written to the established convention; treat
   * `isDeleteSuccessful()`'s result from an ACTUAL spec run as the real
   * answer, not the CLI exploration notes above.
   */
  async deleteDocument(referenceNo) {
    await this._resolveListFrame();
    const matched = await this._waitForRowMatchingReference(referenceNo);
    if (!matched) {
      await this.page.screenshot({
        path: `test-results/debug-close-stock-transfer-request-delete-not-found-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `Close Stock Transfer Request grid never showed a row matching Reference No. "${referenceNo}" — ` +
        'refusing to proceed with Delete against a possibly-stale/unfiltered row.'
      );
    }
    const row = this.listFrame.getByRole('row', {
      name: new RegExp(`^CloseStockTransferRequestDetail\\s+Delete\\b.*\\b${referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
    }).first();
    await row.getByRole('link', { name: 'Delete', exact: true }).click();

    const { locator: yesButton } = await heal(this.listFrame, {
      id: 'closeStockTransferRequest.deleteConfirmYesButton',
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
   * Verify via the listing grid — the row must disappear entirely. Polls
   * for up to `timeout` to tolerate the stale-render trap already
   * documented elsewhere in this repo, but ALSO — per this screen's OPEN
   * ISSUE — do not treat a `true` result here as fully trustworthy until
   * cross-checked with a genuinely fresh page reload + re-navigation, not
   * just this in-session poll.
   */
  async isDeleteSuccessful(referenceNo, timeout = 10000) {
    const escaped = referenceNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dataRowPattern = new RegExp(`^CloseStockTransferRequestDetail\\s+Delete\\b.*\\b${escaped}\\b`, 'i');
    const row = this.listFrame.getByRole('row', { name: dataRowPattern });
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if ((await row.count().catch(() => 0)) === 0) return true;
      await this.page.waitForTimeout(300);
    }
    return false;
  }
}

module.exports = { CloseStockTransferRequestPage };
