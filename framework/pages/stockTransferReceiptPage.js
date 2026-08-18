const { findFrame } = require('../frameHelper');

/**
 * Page object for Inventory (transactional module) > Stock Transfer
 * Receipt.
 *
 * SOURCE: built directly from Jin's own Playwright codegen recording
 * (2026-08-18) plus a full live exploration/confirmation of the same SIT
 * environment (uat/admin) — no Katalon Object Repository entry exists for
 * this screen yet.
 *
 * WHAT MAKES THIS SCREEN DIFFERENT: unlike every other Inventory module
 * built this session, this screen has NO "New"/Insert action at all.
 * Instead, the list auto-shows one DRAFT placeholder row for every
 * currently-POSTED, not-yet-received Stock Transfer in the system — its
 * "Reference No" column holds that Stock Transfer's own Document No.
 * (e.g. "ST-00001940"). Receiving it means opening that specific row (via
 * its row-level open/edit icon) and Posting it; there is no way to create
 * a receipt without an existing POSTED Stock Transfer behind it.
 *
 * CONFIRMED live (2026-08-18): the recording's row click resolved to a
 * hardcoded per-row id (`gvStockTransferReceipt_DXCBtn0`), which is NOT a
 * stable identity — it reflects that row's position in the grid at
 * recording time (per this repo's explicit "never hardcode a per-row
 * action-button id" rule). `openPendingReceipt()` below instead finds the
 * correct row by matching its own Reference No text, confirmed live by
 * observing the SAME source (ST-00001940) resolve to a DIFFERENT id
 * (DXCBtn2) once it was no longer the first pending row in the grid.
 *
 * CONFIRMED live (2026-08-18): once a pending row is opened, its From
 * Warehouse / To Warehouse / Document No. / Reference No fields are all
 * pre-filled and disabled (inherited from the source Stock Transfer), and
 * its Items grid is already auto-populated from that same source — only
 * the mandatory "Reason:" field needs to be filled manually before
 * Posting.
 *
 * CONFIRMED live (2026-08-18): this screen's own toolbar only has Back,
 * Post, and More Options — genuinely NO Save Draft, Post & New, or Copy
 * From here (matching the user's own instruction that this module is
 * "Post only"). Posting opens a NEW in-app workspace tab ("Stock Transfer
 * Receipt Summary Report"). There is also NO Delete/Cancel action
 * anywhere on this screen's list (neither the pending DRAFT rows nor the
 * completed POSTED ones carry one) — once posted, a Stock Transfer
 * Receipt is a permanent record, same as the real inventory movement it
 * represents. This means test data built through this screen cannot be
 * cleaned up afterward; that is expected, not a bug.
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable — always re-resolved via findFrame() by content, never
 * hardcoded.
 */
class StockTransferReceiptPage {
  constructor(page) {
    this.page = page;
    this.listFrame = null;
    this.formFrame = null;
  }

  /** Scoped to `#navBar` — same confirmed fix as stockTransferPage.js's goto(): avoids ambiguity with an already-open "Stock Transfer Receipt" workspace tab. */
  async goto() {
    const p = this.page;
    await p.getByRole('link', { name: 'Inventory', exact: true }).click();
    await p.locator('#navBar').getByRole('link', { name: 'Stock Transfer Receipt', exact: true }).click();
    await p.waitForLoadState('domcontentloaded');
    await this._resolveListFrame();
  }

  async _resolveListFrame() {
    const p = this.page;
    this.listFrame = await findFrame(p, async (frame) => {
      const heading = frame.getByRole('cell', { name: 'Document Date', exact: true });
      return (await heading.count().catch(() => 0)) > 0 && (await heading.first().isVisible().catch(() => false));
    });
    if (!this.listFrame) {
      await p.screenshot({ path: 'test-results/debug-stock-transfer-receipt-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the frame containing the Stock Transfer Receipt list. ' +
        'Saved test-results/debug-stock-transfer-receipt-list-page.png for inspection.'
      );
    }
  }

  /** CONFIRMED live (2026-08-18): "Reason:" genuinely has that accessible name on this screen's own form. */
  async _resolveFormFrame() {
    const p = this.page;
    this.formFrame = await findFrame(p, async (frame) => {
      const field = frame.getByRole('textbox', { name: 'Reason:', exact: true });
      return (await field.count().catch(() => 0)) > 0 && (await field.first().isVisible().catch(() => false));
    });
    if (!this.formFrame) {
      await p.screenshot({ path: 'test-results/debug-stock-transfer-receipt-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Stock Transfer Receipt form frame (Reason field). ' +
        'Saved test-results/debug-stock-transfer-receipt-form-not-found.png for inspection.'
      );
    }
  }

  /**
   * Opens the pending (DRAFT) receipt row for a specific POSTED Stock
   * Transfer, matched by that Stock Transfer's own Document No. (e.g.
   * "ST-00001940") in the grid's "Reference No" column — never by row
   * index/position, per this repo's row-safety convention (see class doc
   * for why: the recording's own hardcoded row id was confirmed
   * non-stable live).
   */
  async openPendingReceipt(stockTransferDocumentNo) {
    await this._resolveListFrame();
    const escaped = stockTransferDocumentNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const row = this.listFrame.getByRole('row', {
      name: new RegExp(`^StockTransferReceiptDetail\\b.*\\b${escaped}\\b.*\\bDRAFT\\b`, 'i'),
    }).first();
    await row.waitFor({ state: 'visible', timeout: 15000 });
    await row.getByRole('link', { name: 'StockTransferReceiptDetail', exact: true }).click();
    await this._resolveFormFrame();
  }

  /** Fills the header's mandatory Reason field — the only editable field on this form, everything else is inherited from the source Stock Transfer. */
  async fillReason(reason) {
    const field = this.formFrame.getByRole('textbox', { name: 'Reason:', exact: true });
    await field.click();
    await field.fill(reason);
  }

  /** CONFIRMED live (2026-08-18): no confirmation dialog appears for Post on this screen — opens a "Stock Transfer Receipt Summary Report" tab. */
  async clickPost() {
    const postButton = this.formFrame.getByRole('listitem', { name: 'Post [Alt + P]' });
    await postButton.click();
    await this.page.waitForTimeout(1000);
  }

  async getStatus() {
    const field = this.formFrame.getByRole('textbox', { name: 'Status:', exact: true });
    return (await field.inputValue().catch(() => null)) || (await field.textContent().catch(() => null));
  }
}

module.exports = { StockTransferReceiptPage };
