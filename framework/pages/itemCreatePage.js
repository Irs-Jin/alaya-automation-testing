const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Inventory (transactional module) > Item.
 *
 * NAMING NOTE: named `itemCreatePage.js`/`ItemCreatePage` (not the more
 * obvious `itemPage.js`/`ItemPage`) because a teammate independently built
 * their own, separately-named Item test (`create-item.spec.js`) with its
 * own `itemPage.js` already on the shared repo by the time this one was
 * pushed. Both cover the same screen from different angles — kept side by
 * side rather than one overwriting the other.
 *
 * SOURCE: built from Jin's own Playwright codegen recording (2026-08-15)
 * plus a full live exploration of the same SIT environment (uat/admin) —
 * no Katalon Object Repository entry exists for this screen yet. Every
 * selector below was exercised live end-to-end (create -> save -> search ->
 * delete -> re-search to confirm gone) using a real TESTING_ITEM_001
 * record, which was cleaned up again before this page object was written.
 *
 * SHAPE: nav (Inventory > Item) > listing grid with a live-filter Search
 * box and its own header "New" icon > New opens a create form in its own
 * iframe, a 12-tab form (General, UOM / Price, Price Group, Warehouse and
 * Quantity, Associated Company, Point Setting, Vendor, Alternative, Alt
 * PLU, Picture, Notes/Reminder, Attachments/External Links, Commission) —
 * CONFIRMED live that only the General tab's Description and Group (Item
 * Group) fields need real input; every other required (*) field across
 * all 12 tabs (Item Code, Item Type, Classification, Base UOM, Costing
 * Method, Associated Item Group) already carries a working default, so
 * this page object only fills those two > Save shows a "Saved
 * Successfully" message and auto-assigns an Item Code > Back returns to
 * the listing grid > the matching row exposes its own Edit/Delete/CopyTo
 * ICONS (unlike Customer/Promotion's text links) > Delete triggers the
 * SAME app-wide delete-confirm dialog (`pcConfirmDel_btnYes_CD`) already
 * confirmed safe in customerPage.js/promotionPage.js/
 * bankReconciliationPage.js.
 *
 * SAFETY LESSON (2026-08-15, confirmed live): unlike Customer, this screen
 * shows NO "Deleted Successfully" banner after confirming delete, and the
 * grid can still appear to show the just-deleted row immediately
 * afterward (a stale client-side render, not a real failure) — a fresh
 * snapshot right after clicking Yes still showed the row, but a genuine
 * re-search (clear + retype the same search term) immediately after
 * showed "Rec: 0" / "No data to display". The only reliable way to
 * confirm a delete actually succeeded here is a fresh re-search, never
 * the immediately-following grid state.
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable (both the listing grid and the create/edit form resolved to
 * name "undefined" live) — always re-resolved via findFrame() by content,
 * never hardcoded.
 */
class ItemCreatePage {
  constructor(page) {
    this.page = page;
    this.listFrame = null;
    this.formFrame = null;
  }

  async goto() {
    const p = this.page;
    await p.getByRole('link', { name: 'Inventory', exact: true }).click();
    await p.getByRole('link', { name: 'Item', exact: true }).click();
    await p.waitForLoadState('domcontentloaded');
    await this._resolveListFrame();
  }

  async _resolveListFrame() {
    const p = this.page;
    this.listFrame = await findFrame(p, async (frame) => {
      const filterBox = frame.locator('[id*="FilterTextBoxGridView_txtFilterGridView_I" i]');
      return (await filterBox.count().catch(() => 0)) > 0 && (await filterBox.first().isVisible().catch(() => false));
    });
    if (!this.listFrame) {
      await p.screenshot({ path: 'test-results/debug-item-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the frame containing the Item search filter box. ' +
        'Saved test-results/debug-item-list-page.png for inspection.'
      );
    }
  }

  async _resolveFormFrame() {
    const p = this.page;
    this.formFrame = await findFrame(p, async (frame) => {
      const field = frame.getByRole('textbox', { name: 'Description:', exact: true });
      return (await field.count().catch(() => 0)) > 0 && (await field.first().isVisible().catch(() => false));
    });
    if (!this.formFrame) {
      await p.screenshot({ path: 'test-results/debug-item-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Item create/edit form frame (Description field). ' +
        'Saved test-results/debug-item-form-not-found.png for inspection.'
      );
    }
  }

  /**
   * CONFIRMED live (2026-08-15): the grid header's own "New"/Insert icon
   * has a fixed CSS id (`..._gvItemMaster_header38_Add`), stable
   * regardless of which rows are currently rendered/filtered — used as the
   * primary strategy, with the accessible-name role match (also confirmed
   * live) as a fallback, same pattern as customerPage.js's clickNew().
   */
  async clickNew() {
    let addIcon;
    try {
      const { locator } = await heal(this.listFrame, {
        id: 'item.newIcon',
        label: 'New',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_ItemMaster_cpnlItemMaster_formItemMaster_gvItemMaster_header38_Add' },
        ],
        timeout: 5000,
      });
      addIcon = locator;
    } catch {
      addIcon = this.listFrame.getByRole('img', { name: /Click Here Or Press \[Insert\]/i }).first();
      await addIcon.waitFor({ state: 'visible', timeout: 5000 });
    }
    await addIcon.click();
    await this._resolveFormFrame();
  }

  /** General tab's Description field — the only free-text field this flow needs. */
  async fillDescription(description) {
    const field = this.formFrame.getByRole('textbox', { name: 'Description:', exact: true });
    await field.click();
    await field.fill(description);
  }

  /**
   * Opens the General tab's Item Group popup-grid picker and clicks its
   * FIRST option — CONFIRMED against Jin's own codegen recording (the
   * dropdown button and first-option ids below) and independently
   * reproduced live end-to-end (selected "ACAR BUAH", a real Item Group in
   * this environment, and the item saved successfully with it).
   */
  async selectFirstItemGroup() {
    const dropdownButton = this.formFrame.locator(
      '#ctl00_MainContent_ItemCreationDetails_cbpItemCreationDetails_cbpDtl_formItemCreationDetails_tabs_formLayoutGeneral_ddlItemGroup_B-1'
    );
    const firstOption = this.formFrame.locator(
      '#ctl00_MainContent_ItemCreationDetails_cbpItemCreationDetails_cbpDtl_formItemCreationDetails_tabs_formLayoutGeneral_ddlItemGroup_DDD_L_LBI0T0'
    );
    if (await dropdownButton.count().catch(() => 0) > 0) {
      await dropdownButton.click();
    } else {
      // Fallback: the Group field's own "v" dropdown arrow icon.
      await this.formFrame.getByRole('textbox', { name: 'Group :', exact: true })
        .locator('xpath=ancestor::tr[1]/following-sibling::td//img').first().click();
    }
    if (await firstOption.count().catch(() => 0) > 0) {
      await firstOption.click();
    } else {
      // Fallback: the popup grid's first data row (Code/Description columns).
      await this.formFrame.locator('table').filter({ hasText: 'Code' }).locator('tr').nth(1).click();
    }
  }

  /**
   * CONFIRMED live (2026-08-15): the recorded toolbar container id did not
   * match what actually saved — following the same lesson already
   * documented in promotionPage.js's clickDetailSave(), the title
   * `"Save Draft [Alt + S]"` is the stable, confirmed-working target.
   */
  async clickSave() {
    const saveButton = this.formFrame.getByRole('listitem', { name: 'Save Draft [Alt + S]' });
    await saveButton.waitFor({ state: 'visible', timeout: 10000 });
    await saveButton.click();
    await this.page.waitForTimeout(1000);
  }

  /** CONFIRMED live (2026-08-15): the toolbar's own Back button, same title pattern as Save. */
  async clickBack() {
    const backButton = this.formFrame.getByRole('listitem', { name: 'Back [Alt + B]' });
    await backButton.click();
    await this.page.waitForTimeout(1000);
    await this._resolveListFrame();
  }

  /** Full flow: New -> fill Description -> pick first Item Group -> Save -> Back. */
  async createItem(description) {
    await this.clickNew();
    await this.fillDescription(description);
    await this.selectFirstItemGroup();
    await this.clickSave();
  }

  /**
   * CONFIRMED live (2026-08-15) as the exact success text shown after a
   * successful Save — but ALSO confirmed live that checking only the
   * cached `this.formFrame` reference intermittently reports false even
   * though the banner is genuinely visible on screen (same "frame
   * reference captured before a postback goes stale" risk already solved
   * in customerPage.js's isDeleteSuccessful()): falls back to a fresh
   * page-wide frame scan before giving up.
   */
  async isSaveSuccessful() {
    if (this.formFrame) {
      const text = this.formFrame.getByText('Saved Successfully');
      if ((await text.count().catch(() => 0)) > 0 && (await text.first().isVisible().catch(() => false))) {
        return true;
      }
    }
    const frame = await findFrame(this.page, async (f) => {
      const text = f.getByText('Saved Successfully');
      return (await text.count().catch(() => 0)) > 0 && (await text.first().isVisible().catch(() => false));
    }, { timeout: 5000 });
    return !!frame;
  }

  /**
   * Fills the listing grid's own live-filter Search box using real
   * keystrokes (per CLAUDE.md — this control needs to actually register
   * with DevExpress's ASPxClientEdit wrapper) and waits for a genuine
   * matching data row before returning, exactly like customerPage.js's
   * searchCustomer() — never proceed to Edit/Delete a possibly-stale,
   * unfiltered row.
   */
  async searchItem(searchText) {
    await this._resolveListFrame();
    const { locator: filterBox } = await heal(this.listFrame, {
      id: 'item.searchFilterBox',
      label: 'Search',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_ItemMaster_cpnlItemMaster_formItemMaster_FilterTextBoxGridView_txtFilterGridView_I' },
        { type: 'css', value: '[id*="FilterTextBoxGridView_txtFilterGridView_I" i]' },
      ],
      timeout: 5000,
    });
    await filterBox.click({ clickCount: 3 });
    await filterBox.pressSequentially(searchText, { delay: 60 });
    await this.listFrame.locator('#ctl00_LoadingPanel_LD').first()
      .waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});

    const matched = await this._waitForGridRowMatching(searchText, 10000);
    if (!matched) {
      await this.page.screenshot({
        path: `test-results/debug-item-search-not-found-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `Item grid never showed a row matching "${searchText}" after searching — ` +
        'refusing to proceed with Delete against a possibly-stale/unfiltered row.'
      );
    }
    await this.page.waitForTimeout(300);
  }

  /**
   * Polls until a genuine GRID DATA ROW matching the search text is
   * visible — the Item grid's own Edit/Delete/CopyTo icons are ALWAYS
   * present on a real data row (confirmed live), so requiring them in the
   * accessible-name match rules out the search box's own wrapper cell,
   * same false-positive risk documented in customerPage.js.
   */
  async _waitForGridRowMatching(searchText, timeout = 10000) {
    const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dataRowPattern = new RegExp(`^Edit\\s+Delete\\s+CopyTo\\s+${escaped}\\b`, 'i');
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

  /** Clicks the (first/only) matching row's own "Delete" icon. */
  async clickDelete() {
    const { locator } = await heal(this.listFrame, {
      id: 'item.deleteIcon',
      label: 'Delete',
      strategies: [
        { type: 'role', role: 'link', options: { name: 'Delete', exact: true } },
      ],
      timeout: 5000,
    });
    await locator.first().click();
  }

  /**
   * Confirms the delete via the SAME app-wide delete-confirm dialog
   * already confirmed safe in customerPage.js/promotionPage.js/
   * bankReconciliationPage.js — CONFIRMED live here too (same
   * `pcConfirmDel_btnYes_CD` id). Scoped to this.listFrame, never
   * page-wide, per this repo's real incident history.
   */
  async confirmDelete() {
    const { locator: yesButton } = await heal(this.listFrame, {
      id: 'item.deleteConfirmYesButton',
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

  /** Full flow: search -> Delete -> confirm Yes. */
  async deleteItem(searchText) {
    await this.searchItem(searchText);
    await this.clickDelete();
    await this.confirmDelete();
  }

  /**
   * CONFIRMED live (2026-08-15) as the ONLY reliable way to verify a
   * delete actually went through on this screen — see the SAFETY LESSON in
   * this file's header comment. Performs a genuine fresh re-search (real
   * triple-click clear + retype, not a page-state assumption) and returns
   * true only if the grid comes back with zero matching rows.
   */
  async verifyDeleted(searchText) {
    await this._resolveListFrame();
    const { locator: filterBox } = await heal(this.listFrame, {
      id: 'item.searchFilterBox',
      label: 'Search',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_ItemMaster_cpnlItemMaster_formItemMaster_FilterTextBoxGridView_txtFilterGridView_I' },
        { type: 'css', value: '[id*="FilterTextBoxGridView_txtFilterGridView_I" i]' },
      ],
      timeout: 5000,
    });
    await filterBox.click({ clickCount: 3 });
    await filterBox.pressSequentially(searchText, { delay: 60 });
    await this.listFrame.locator('#ctl00_LoadingPanel_LD').first()
      .waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
    await this.page.waitForTimeout(500);

    const stillPresent = await this._waitForGridRowMatching(searchText, 3000);
    return !stillPresent;
  }
}

module.exports = { ItemCreatePage };
