const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Inventory > Item Master.
 *
 * SOURCE: built from the alaya-knowledge-vault "Item - Screen Reference"
 * (field layout, mandatory rules and verbatim validation messages) plus the
 * Katalon Object Repository entries for this exact screen, in preference
 * order required by CONTRIBUTING.md:
 *
 *   CONFIRMED (Katalon Object Repository):
 *   - The Item module lives in ONE iframe (`.../Modules/Inventory/
 *     m_ItemMaster.aspx`, name/id both "44" in the recording) which holds
 *     BOTH the listing grid AND the toggled-in ItemCreationDetails form
 *     (`iframe_Item_44.rs`) — unlike Customer, which uses separate frames.
 *   - Discontinue checkbox: `..._formItemCreationHeader_chkDiscontinue`
 *     (`Checkbox/label_Discontinue.rs`).
 *   - "Warehouse and Quantity" tab: `..._cbpDtl_formItemCreationDetails_
 *     tabs_T3T` (`span_Warehouse and Quantity.rs`).
 *   - Item Associated Group / Warehouse / Bin grids live under
 *     `..._tabs_ctl165_...` (`a_AMPANG.rs`, `td_33.rs`).
 *
 *   CONFIRMED (this repo's own knowledge-base.json, previous create-item
 *   attempts):
 *   - Item Code field is label-accessible: `getByLabel('Item Code')`
 *     (`createItem.itemCode`, 9 successes).
 *   - General-tab Item Group combo trigger:
 *     `..._tabs_formLayoutGeneral_ddlItemGroup_B-1Img`
 *     (`createItem.itemGroupTrigger`, 9 successes).
 *
 *   UNCONFIRMED (must be verified live — marked as guesses below, per
 *   CONTRIBUTING.md "selectors from a screenshot alone are unconfirmed;
 *   mark them as such"): the Item Type combo, Description field, Costing
 *   Method combo, Item Associated Group combo and the Save/Back toolbar
 *   ids. Every one goes through heal() with a label/text/title fallback
 *   so the knowledge base learns the real id on first live run.
 *
 * MANDATORY FIELDS (per knowledge-vault Screen Reference):
 *   Item Code (required), Item Type (required), Description (required),
 *   and on the Warehouse and Quantity tab: Costing Method (required,
 *   defaults to Fixed Price) and Item Associated Group (required).
 *
 * DevExpress gotchas: iframe names are unstable — always re-resolve via
 * findFrame() by content, never hardcode. `.fill()` bypasses
 * ASPxClientEdit change tracking — use `.click()` then
 * `.pressSequentially()`. Save/Back toolbar items expose stable
 * `title="Save [Alt + S]"` attributes (confirmed across Customer,
 * Promotion, Cash Sales) even where their container ids drift.
 */
class ItemPage {
  constructor(page) {
    this.page = page;
    this.frame = null; // single Item module iframe (grid AND creation form toggle inside it)
  }

  async goto() {
    const p = this.page;
    await p.getByRole('link', { name: 'Inventory', exact: true }).click();
    await p.getByRole('link', { name: 'Item', exact: true }).click();
    await p.waitForLoadState('domcontentloaded');
    await this._resolveFrame();
  }

  async _resolveFrame() {
    const p = this.page;
    // The Item listing grid is a DevExpress ASPxGridView rendered inside the
    // module iframe (`.../Modules/Inventory/m_ItemMaster.aspx`, frame name
    // "44" — UNSTABLE, matched by content only). Its data grid id is
    // `..._formItemMaster_gvItemMaster` (confirmed live on UAT), and the
    // filter box id is `..._FilterTextBoxGridView_txtFilterGridView_I`.
    //
    // BUG FIXED (2026-08-16): the original check used the loose
    // `[id*="gvItemMaster" i]` pattern, which matches ~430 elements
    // (every grid cell, context-menu node and column header) — its
    // `.first()` is a HIDDEN element, so `isVisible()` always returned
    // false and the frame was never matched. Use the exact grid id (a
    // single visible element) and the filter box id instead. Also wait for
    // the frame first: after the nav click the module iframe's URL starts
    // as an empty string and only becomes m_ItemMaster.aspx after ~3s.
    //
    // CONFIRMED LIVE (2026-08-16): the CREATE form does NOT toggle inside
    // this listing frame. Clicking New navigates to a SEPARATE iframe
    // (`.../Modules/Inventory/m_ItemCreationDetails.aspx?EncData=...`).
    // This frame resolver only ever resolves the LISTING frame; the form
    // frame is resolved separately in _resolveFormFrame() after New.
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      const frame = await findFrame(p, async (f) => {
        const exactGrid = f.locator('#ctl00_MainContent_ItemMaster_cpnlItemMaster_formItemMaster_gvItemMaster');
        const filterBox = f.locator('[id*="FilterTextBoxGridView_txtFilterGridView_I" i]');
        const gridVisible = (await exactGrid.count().catch(() => 0)) > 0 && (await exactGrid.first().isVisible().catch(() => false));
        const filterVisible = (await filterBox.count().catch(() => 0)) > 0 && (await filterBox.first().isVisible().catch(() => false));
        return gridVisible || filterVisible;
      }, { timeout: 4000 });
      if (frame) {
        this.frame = frame;
        return;
      }
      await p.waitForTimeout(500);
    }
    await p.screenshot({ path: 'test-results/debug-item-frame-not-found.png', fullPage: true }).catch(() => {});
    throw new Error(
      'Could not find the Item Master iframe (listing grid gvItemMaster or ' +
      'filter box). Saved test-results/debug-item-frame-not-found.png for inspection.'
    );
  }

  /**
   * Resolves the CREATE/edit form iframe
   * (`.../Modules/Inventory/m_ItemCreationDetails.aspx?EncData=...` — the
   * EncData query string is per-session, never hardcode it; the frame name
   * is likewise unstable). Matches by the creation form's root control id,
   * which is the SAME one confirmed in the Katalon Object Repository
   * (`..._ItemCreationDetails_cbpItemCreationDetails_...`). This form is a
   * SEPARATE iframe from the listing (confirmed live 2026-08-16).
   */
  async _resolveFormFrame() {
    const p = this.page;
    this.formFrame = await findFrame(p, async (f) => {
      const form = f.locator('#ctl00_MainContent_ItemCreationDetails_cbpItemCreationDetails');
      return (await form.count().catch(() => 0)) > 0 && (await form.first().isVisible().catch(() => false));
    });
    if (!this.formFrame) {
      await p.screenshot({ path: 'test-results/debug-item-form-frame-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Item create form iframe (ItemCreationDetails). ' +
        'Saved test-results/debug-item-form-frame-not-found.png for inspection.'
      );
    }
  }

  /**
   * Clicks the listing grid's own "New" icon, toggling the Item
   * creation form into view inside the SAME iframe.
   *
   * CONFIRMED (2026-07-27, Customer) that the grid header's add button is
   * the stable `..._header0_Add` id. For Item the equivalent is
   * `..._gvItemMaster_header0_Add` — UNCONFIRMED (no Katalon entry), so
   * the img accessible-name fallback (identical title pattern, confirmed
   * on every listing grid in this app) covers it.
   */
  async clickNew() {
    let addIcon;
    try {
      const { locator } = await heal(this.frame, {
        id: 'item.newIcon',
        label: 'New',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_ItemMaster_cpnlItemMaster_formItemMaster_gvItemMaster_header38_Add' }, // confirmed live on UAT
        ],
        timeout: 5000,
      });
      addIcon = locator;
    } catch {
      addIcon = this.frame.getByRole('img', { name: /Click Here Or Press \[Insert\]/i }).first();
      await addIcon.waitFor({ state: 'visible', timeout: 5000 });
    }
    await addIcon.click();
    await this._waitForFormVisible();
    await this._resolveFormFrame();
  }

  async _waitForFormVisible(timeout = 15000) {
    // After New, the listing frame detaches and a NEW iframe
    // (m_ItemCreationDetails.aspx) loads — polling for the form content
    // in the stale frame throws "Frame was detached". Just wait for the
    // new iframe to exist and be resolvable via findFrame (which reads
    // page.frames() fresh each poll).
    const p = this.page;
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const frame = await findFrame(p, async (f) => {
        const form = f.locator('#ctl00_MainContent_ItemCreationDetails_cbpItemCreationDetails');
        return (await form.count().catch(() => 0)) > 0 && (await form.first().isVisible().catch(() => false));
      }, { timeout: 4000 });
      if (frame) return;
      await p.waitForTimeout(300);
    }
    throw new Error('Item create form iframe never appeared after clicking New.');
  }

  /**
   * Item Code. CONFIRMED live (2026-08-16): the input id is
   * `..._formItemCreationHeader_txtItemCode_I`, pre-filled with
   * `[DEFAULT]` (auto-numbered on save). Real keystrokes per the
   * documented ASPxClientEdit gotcha.
   */
  async fillItemCode(code) {
    const { locator: field } = await heal(this.formFrame, {
      id: 'item.itemCodeField',
      label: 'Item Code',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_ItemCreationDetails_cbpItemCreationDetails_formItemCreationHeader_txtItemCode_I' }, // CONFIRMED live
        { type: 'label', value: 'Item Code' },
      ],
      timeout: 5000,
    });
    await field.click({ clickCount: 3 });
    await field.pressSequentially(code, { delay: 30 });
  }

  /**
   * Item Type combo. CONFIRMED live (2026-08-16): the dropdown trigger is
   * `..._formItemCreationHeader_ddlItemType_B-1Img`; the dropdown is a
   * DevExpress dxeListBox under `..._ddlItemType_DDD_L_LBI...` rendering a
   * "Code / Description" two-column grid (both cells of the matching row
   * read "Stock Item", "Service Item", ... — confirmed live). Match is
   * case-insensitive so 'STOCK ITEM' / 'Stock Item' both work, scoped to
   * the dropdown's own list container (the promotionPage.js
   * selectPriority lesson).
   */
  async selectItemType(optionText) {
    const { locator: trigger } = await heal(this.formFrame, {
      id: 'item.itemTypeTrigger',
      label: 'Item Type',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_ItemCreationDetails_cbpItemCreationDetails_formItemCreationHeader_ddlItemType_B-1Img' }, // CONFIRMED live
      ],
      timeout: 5000,
    });
    await trigger.click();
    const listbox = this.formFrame.locator('[id*="ddlItemType" i][id$="_DDD_L"]');
    await listbox.waitFor({ state: 'visible', timeout: 5000 });
    const optionCell = listbox.getByRole('cell', { name: new RegExp(`^${optionText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
    await optionCell.first().waitFor({ state: 'visible', timeout: 5000 });
    await optionCell.first().click();
  }

  /**
   * Description. CONFIRMED live (2026-08-16): input id is
   * `..._formItemCreationHeader_txtDescription_I`.
   */
  async fillDescription(description) {
    const { locator: field } = await heal(this.formFrame, {
      id: 'item.descriptionField',
      label: 'Description',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_ItemCreationDetails_cbpItemCreationDetails_formItemCreationHeader_txtDescription_I' }, // CONFIRMED live
        { type: 'label', value: 'Description' },
      ],
      timeout: 5000,
    });
    await field.click();
    await field.pressSequentially(description, { delay: 20 });
  }

  /**
   * Item Group on the General tab — CONFIRMED in this repo's
   * knowledge-base.json (`createItem.itemGroupTrigger`):
   * `..._cbpDtl_formItemCreationDetails_tabs_formLayoutGeneral_ddlItemGroup_B-1Img`.
   * This is the mandatory group field (user decision, 2026-08-16: the
   * "Warehouse and Quantity" tab is NOT touched; only the General tab's
   * Item Group is selected). The first non-empty option cell is selected —
   * safe because the field is mandatory, so the popup always has options.
   */
  async selectItemGroup() {
    const { locator: trigger } = await heal(this.formFrame, {
      id: 'item.itemGroupTrigger',
      label: 'Item Group',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_ItemCreationDetails_cbpItemCreationDetails_cbpDtl_formItemCreationDetails_tabs_formLayoutGeneral_ddlItemGroup_B-1Img' }, // CONFIRMED (knowledge-base.json)
        { type: 'css', value: '[id*="formLayoutGeneral" i][id*="ItemGroup" i][id*="B-1Img" i]' },
      ],
      timeout: 5000,
    });
    await trigger.click();
    const listbox = this.formFrame.locator('[id*="ddlItemGroup" i][id$="_DDD_L"]').first();
    await listbox.waitFor({ state: 'visible', timeout: 5000 });
    // DevExpress dxeListBox layout (probed live 2026-08-16): the header
    // cells "Code"/"Description" have NO id and must be skipped; each
    // option row renders two cells `..._LBI<n>T0` (Code) / `..._LBI<n>T1`
    // (Description) carrying the option text (ids end in `T0`/`T1`). The
    // hidden `LBI-1T0` template row has empty text and is skipped. Select
    // the first non-empty Code cell.
    const optionCells = listbox.locator('td[id$="T0"]');
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const count = await optionCells.count().catch(() => 0);
      for (let i = 0; i < count; i += 1) {
        const text = (await optionCells.nth(i).innerText().catch(() => '')).trim();
        if (text) {
          await optionCells.nth(i).click();
          return;
        }
      }
      await this.page.waitForTimeout(300);
    }
    await this.page.screenshot({ path: 'test-results/debug-item-group-empty.png', fullPage: true }).catch(() => {});
    throw new Error('Item Group dropdown opened but no selectable option cell was found.');
  }

  /**
   * Save on the Item toolbar. CONFIRMED live (2026-08-16): the item
   * toolbar is `..._mItemCreationDetailsToolBar_mToolBars_DXI4_T`
   * (title "Save Draft [Alt + S]"). After a successful save the Item Code
   * field (left as `[DEFAULT]`) is replaced with the auto-generated code
   * (e.g. "526151") and the form shows "Saved Successfully" — returns the
   * generated code (trimmed, uppercased).
   */
  async clickSave() {
    const { locator } = await heal(this.formFrame, {
      id: 'item.saveButton',
      label: 'Save',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_ItemCreationDetails_mItemCreationDetailsToolBar_mToolBars_DXI4_T' }, // CONFIRMED live
        { type: 'css', value: '[title="Save Draft [Alt + S]"]' },
        { type: 'text', value: 'Save', options: { exact: true } },
      ],
      timeout: 5000,
    });
    await locator.first().click();
    await this.page.waitForTimeout(1200);
    const codeField = this.formFrame.locator('#ctl00_MainContent_ItemCreationDetails_cbpItemCreationDetails_formItemCreationHeader_txtItemCode_I');
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const value = (await codeField.inputValue().catch(() => '')).trim();
      if (value && value.toUpperCase() !== '[DEFAULT]') {
        return value.trim().toUpperCase();
      }
      await this.page.waitForTimeout(300);
    }
    await this.page.screenshot({ path: 'test-results/debug-item-save-no-code.png', fullPage: true }).catch(() => {});
    throw new Error('Save did not produce a generated Item Code (field still [DEFAULT] or empty).');
  }

  /**
   * Back to the listing grid. CONFIRMED live (2026-08-16):
   * `..._mItemCreationDetailsToolBar_mToolBars_DXI0_T`
   * (title "Back [Alt + B]").
   */
  async clickBack() {
    const { locator } = await heal(this.formFrame, {
      id: 'item.backButton',
      label: 'Back',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_ItemCreationDetails_mItemCreationDetailsToolBar_mToolBars_DXI0_T' }, // CONFIRMED live
        { type: 'css', value: '[title="Back [Alt + B]"]' },
        { type: 'text', value: 'Back', options: { exact: true } },
      ],
      timeout: 5000,
    });
    await locator.first().click();
    await this.page.waitForTimeout(1200);
    await this._resolveFrame();
  }

  /**
   * Defensive check (same rationale as customerPage.js): never act on the
   * grid while an unexplained stray confirm dialog might be open. Only
   * ever dismiss via "No", never "Yes".
   */
  async _dismissStrayDeleteDialogIfPresent() {
    const noButton = this.frame.locator('[id*="pcConfirmDel" i][id*="btnNo" i]');
    const present = await noButton.count().catch(() => 0);
    if (present > 0 && (await noButton.first().isVisible().catch(() => false))) {
      await noButton.first().click().catch(() => {});
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Fills the listing grid's live-filter textbox (same
   * `FilterTextBoxGridView_txtFilterGridView_I` id family confirmed on
   * Customer's grid) and waits for a genuine matching data row before
   * returning — the exact searchCustomer() lesson: never act on a stale,
   * unfiltered row. Real per-character keystrokes, never `.fill()`.
   */
  async searchItem(searchText) {
    await this._resolveFrame();
    await this._dismissStrayDeleteDialogIfPresent();
    const { locator: filterBox } = await heal(this.frame, {
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
    await filterBox.press('Space');
    await filterBox.press('Backspace');
    await this.frame.locator('#ctl00_LoadingPanel_LD').first()
      .waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});

    const matched = await this._waitForGridRowMatching(searchText, 10000);
    if (!matched) {
      await this.page.screenshot({
        path: `test-results/debug-item-search-not-found-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `Item grid never showed a row matching "${searchText}" after searching — ` +
        'refusing to proceed against a possibly-stale/unfiltered row.'
      );
    }
    await this.page.waitForTimeout(300);
  }

  /**
   * Polls until a genuine grid DATA ROW matching the search text is
   * visible. IMPORTANT (confirmed live 2026-08-16): the Item grid's row
   * accessible name is `Edit Delete CopyTo <Description> <Item Code> ...`
   * — unlike Customer's grid it has a THIRD "CopyTo" link and the
   * Description column precedes the Item Code column. So the row must
   * start with "Edit Delete CopyTo" and CONTAIN the code somewhere, not
   * start with it. The filter textbox's own cell ("Search: <text> Clear")
   * can never start with "Edit Delete", so it is not matched.
   */
  async _waitForGridRowMatching(searchText, timeout = 10000) {
    const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dataRowPattern = new RegExp(`^Edit\\s+Delete\\s+(?:CopyTo\\s+)?[\\s\\S]*\\b${escaped}\\b`, 'i');
    const row = this.frame.getByRole('row', { name: dataRowPattern });
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
   * Convenience assertion: after searching, the matching row is visible.
   * Call searchItem() first so the grid is genuinely filtered.
   */
  async isRowVisible(searchText) {
    return this._waitForGridRowMatching(searchText, 5000);
  }

  /**
   * Reads the "Qty Available" column straight off the LISTING grid's own
   * search result row — CONFIRMED live (2026-08-22) this column is shown
   * directly on the grid (no need to open the item form/tab at all). The
   * row's fixed column order (confirmed live) is: Edit/Delete/CopyTo links,
   * Description, Item Code, 2nd Description, Qty on Hand, Qty Reserved,
   * Qty Available, Item Group, ... — so the item code anchors the regex and
   * the THIRD decimal number after it is Qty Available.
   *
   * BUG FIXED (2026-08-22): searchItem()'s row-match check can return true
   * on the very FIRST poll even before the real filter postback completes,
   * if the target item's row happens to already be visible on the
   * UNFILTERED grid's default first page — confirmed live for item 526014,
   * whose short numeric code sorts ahead of most of this ~3,000-row item
   * master's long barcode-style codes. Reading immediately after risks a
   * mid-transition value. Guarded here by waiting for the grid's own
   * "Rec: N" record count to drop to a genuinely-filtered small number
   * before trusting the row's text.
   */
  async getQtyAvailable(itemCode) {
    await this.searchItem(itemCode);
    await this._waitForFilteredRecordCount(50, 8000);
    const escaped = itemCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const row = this.frame.getByRole('row', {
      name: new RegExp(`^Edit\\s+Delete\\s+(?:CopyTo\\s+)?[\\s\\S]*\\b${escaped}\\b`, 'i'),
    }).first();
    const text = await row.innerText();
    const match = text.match(new RegExp(`${escaped}\\D*?([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)`));
    if (!match) {
      await this.page.screenshot({
        path: `test-results/debug-item-qty-available-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(`Could not read Qty Available for item "${itemCode}" from row text: "${text}"`);
    }
    return parseFloat(match[3]);
  }

  /**
   * Polls the grid's own "Rec: N" record-count footer until it drops to at
   * most maxCount — confirmed live this reads e.g. "Rec: 2,967" while
   * genuinely unfiltered and "Rec: 1" once a specific-item filter has truly
   * taken effect. Best-effort: if the count never appears/settles, proceeds
   * anyway rather than failing the whole read on a footer-text quirk.
   */
  async _waitForFilteredRecordCount(maxCount, timeout) {
    const recCell = this.frame.getByText(/^Rec:\s*[\d,]+$/);
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const text = (await recCell.first().textContent().catch(() => '')) || '';
      const match = text.match(/Rec:\s*([\d,]+)/);
      if (match && parseInt(match[1].replace(/,/g, ''), 10) <= maxCount) {
        return;
      }
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * Switches to the already-open "Item" tab (rather than a fresh nav) and
   * forces a reload of its grid data — CONFIRMED live (2026-08-22) this is
   * required: after posting a document in another tab (e.g. Stock Receive)
   * that changes an item's stock levels, the Item tab's grid still shows
   * the STALE pre-post value until "Refresh Selected Tab" is clicked, even
   * though the tab itself is already open. `.last()` targets the top
   * in-app tab bar rather than the sidebar's identically-named menu link —
   * same pattern already used in stockReceivePage.js's
   * _switchBackToStockReceiveTab().
   */
  async _switchToOpenTabAndRefresh() {
    const p = this.page;
    await p.getByRole('link', { name: 'Item', exact: true }).last().click({ timeout: 3000 }).catch(() => {});
    await p.getByRole('button', { name: 'Refresh Selected Tab' }).click({ timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(1000);
    await this._resolveFrame();
  }

  /** Switches to the already-open Item tab, refreshes it, then reads Qty Available. */
  async refreshAndGetQtyAvailable(itemCode) {
    await this._switchToOpenTabAndRefresh();
    return this.getQtyAvailable(itemCode);
  }

  /** Clicks the (first/only) matching row's own "Delete" link. */
  async clickDelete() {
    await this._dismissStrayDeleteDialogIfPresent();
    const { locator } = await heal(this.frame, {
      id: 'item.deleteLink',
      label: 'Delete',
      strategies: [
        { type: 'role', role: 'link', options: { name: 'Delete', exact: true } },
      ],
      timeout: 5000,
    });
    await locator.first().click();
  }

  /**
   * Same app-wide delete-confirm dialog already confirmed safe in
   * customerPage.js/promotionPage.js — scoped to this.frame, `_CD` id.
   */
  async confirmDelete() {
    const { locator: yesButton } = await heal(this.frame, {
      id: 'item.deleteConfirmYesButton',
      label: 'Yes',
      strategies: [
        { type: 'css', value: '#ctl00_pcConfirmDel_btnYes_CD span:has-text("Yes")' },
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
   * Full create flow: New -> fill mandatory fields -> Save -> Back.
   *
   * Item Code is NOT filled (user decision, 2026-08-16): the form keeps
   * the `[DEFAULT]` placeholder and the system auto-numbers it on save
   * (hint on the form: "Next Possible No. ..."). Only Description and the
   * General tab's Item Group are set (the "Warehouse and Quantity" tab is
   * NOT touched — user decision). Returns the auto-generated Item Code
   * read back from the form field after save.
   */
  async createItem({ itemCode, description, itemType }) {
    await this.clickNew();
    await this.selectItemType(itemType);
    await this.fillDescription(description);
    await this.selectItemGroup();
    const generatedCode = await this.clickSave();
    await this.clickBack();
    return generatedCode;
  }

  /** Full cleanup flow: search -> Delete -> confirm Yes. */
  async deleteItem(searchText) {
    await this.searchItem(searchText);
    await this.clickDelete();
    await this.confirmDelete();
  }
}

module.exports = { ItemPage };