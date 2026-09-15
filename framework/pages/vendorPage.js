const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Account Payable (transactional module) > Vendor.
 *
 * SOURCE: NO Katalon Object Repository entry or Playwright codegen
 * recording available for this screen — built by close analogy to
 * customerPage.js (Account Receivable > Customer), the confirmed-working
 * A/R mirror of this exact screen shape in the same DevExpress app. Every
 * CSS id below is a GUESS formed by substituting "Customer" -> "Vendor" in
 * customerPage.js's own confirmed ids, following this app's consistent
 * per-module DevExpress control-naming convention (already independently
 * confirmed for the Vendor-selection combo used inside apPaymentPage.js:
 * `cbVendor`/`cbVendor_I`/`cbVendor_B1Img`, the same "cb<Entity>" pattern
 * customerPage.js's own combos would follow). UNCONFIRMED until this
 * file's first live headed run — every guessed CSS id has a role/text-
 * based fallback (identical to customerPage.js's own, since those don't
 * reference "Customer" and are expected to work unchanged) so a wrong
 * guess degrades to the working fallback rather than failing outright.
 * Per CONTRIBUTING.md's guidance for unconfirmed selectors: verify live on
 * first run and fix anything that doesn't match — do not trust the guessed
 * ids blindly.
 *
 * SHAPE (assumed identical to Customer): nav (Account Payable > Vendor) >
 * listing grid with a "Search" live-filter textbox and a "New" (Click Here
 * Or Press [Insert]) icon > New opens a create form in its own iframe >
 * fill Company Name > Save > Back returns to the listing grid > the filter
 * textbox filters the grid as you type > the matching row exposes its own
 * "Edit"/"Delete" links > Edit reopens the same form (fields editable) >
 * Delete triggers the app-wide delete-confirm dialog
 * (`pcConfirmDel_btnYes_CD` + inner `span:has-text('Yes')`) — the SAME
 * shared control already confirmed across this app (customerPage.js,
 * bankReconciliationPage.js, itemPage.js).
 *
 * As with every other DevExpress screen in this app, iframe names are
 * unstable across navigations — always re-resolved via findFrame() by
 * content, never hardcoded.
 */
class VendorPage {
  constructor(page) {
    this.page = page;
    this.listFrame = null; // listing grid iframe — re-resolved after every Back navigation
    this.formFrame = null; // create/edit form iframe — re-resolved after every New/Edit click
  }

  async goto() {
    const p = this.page;
    await p.getByRole('link', { name: 'Account Payable', exact: true }).click();
    await p.getByRole('link', { name: 'Vendor', exact: true }).click();
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
      await p.screenshot({ path: 'test-results/debug-vendor-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the frame containing the Vendor search filter box. ' +
        'Saved test-results/debug-vendor-list-page.png for inspection.'
      );
    }
  }

  async _resolveFormFrame() {
    const p = this.page;
    this.formFrame = await findFrame(p, async (frame) => {
      const field = frame.getByRole('textbox', { name: 'Company Name:', exact: true });
      return (await field.count().catch(() => 0)) > 0 && (await field.first().isVisible().catch(() => false));
    });
    if (!this.formFrame) {
      await p.screenshot({ path: 'test-results/debug-vendor-form-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Vendor create/edit form frame (Company Name field). ' +
        'Saved test-results/debug-vendor-form-not-found.png for inspection.'
      );
    }
  }

  /** UNCONFIRMED CSS id (Customer->Vendor substitution) — falls back to the generic "New"/Insert icon role match, identical to customerPage.js's own fallback. */
  async clickNew() {
    let addIcon;
    try {
      const { locator } = await heal(this.listFrame, {
        id: 'vendor.newIcon',
        label: 'New',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_Vendor_cbpVendorCreation_formVendorCreation_gvVendor_header0_Add' },
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

  /** UNCONFIRMED CSS id (Customer->Vendor substitution) — falls back to the accessible-label match. */
  async fillCompanyName(companyName) {
    const { locator: field } = await heal(this.formFrame, {
      id: 'vendor.companyNameField',
      label: 'Company Name',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_VendorDetails_cbpVendorDetails_formVendorHeader_txtName_I' },
        { type: 'css', value: '[id*="formVendorHeader_txtName_I" i]' },
      ],
      timeout: 5000,
    }).catch(async () => ({ locator: this.formFrame.getByRole('textbox', { name: 'Company Name:', exact: true }) }));
    await field.fill(companyName);
  }

  /** UNCONFIRMED CSS id (Customer->Vendor substitution) — falls back to exact text match "Save". */
  async clickSave() {
    const { locator } = await heal(this.formFrame, {
      id: 'vendor.saveButton',
      label: 'Save',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_VendorDetails_mVendorDetailsToolBar_mToolBars_DXI4_T' },
        { type: 'text', value: 'Save', options: { exact: true } },
      ],
      timeout: 5000,
    });
    await locator.click();
    await this.page.waitForTimeout(1000);
  }

  /** UNCONFIRMED CSS id (Customer->Vendor substitution) — falls back to text match "Back". */
  async clickBack() {
    const { locator } = await heal(this.formFrame, {
      id: 'vendor.backButton',
      label: 'Back',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_VendorDetails_mVendorDetailsToolBar_mToolBars_DXI0_T' },
        { type: 'text', value: 'Back' },
      ],
      timeout: 5000,
    });
    await locator.first().click();
    await this.page.waitForTimeout(1000);
    await this._resolveListFrame();
  }

  /** Full flow: New -> fill Company Name -> Save -> Back. */
  async createVendor(companyName) {
    await this.clickNew();
    await this.fillCompanyName(companyName);
    await this.clickSave();
    await this.clickBack();
  }

  /** Same defensive stray-dialog guard as customerPage.js — see its own comment for the incident this protects against. Safe by construction: only ever clicks "No". */
  async _dismissStrayDeleteDialogIfPresent() {
    const noButton = this.listFrame.locator('[id*="pcConfirmDel" i][id*="btnNo" i]');
    const present = await noButton.count().catch(() => 0);
    if (present > 0 && (await noButton.first().isVisible().catch(() => false))) {
      await noButton.first().click().catch(() => {});
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Fills the listing grid's own live-filter textbox and waits for a
   * genuine matching row before returning — same real-keystrokes-only
   * approach as customerPage.js's searchCustomer() (a plain `.fill()` or
   * synthetic event dispatch was proven NOT to trigger this app's
   * ASPxClientEdit-wrapped filter there; assumed to apply here too until
   * proven otherwise live).
   */
  async searchVendor(searchText) {
    await this._resolveListFrame();
    await this._dismissStrayDeleteDialogIfPresent();
    const { locator: filterBox } = await heal(this.listFrame, {
      id: 'vendor.searchFilterBox',
      label: 'Search',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_Vendor_cbpVendorCreation_formVendorCreation_FilterTextBoxGridView_txtFilterGridView_I' },
        { type: 'css', value: '[id*="FilterTextBoxGridView_txtFilterGridView_I" i]' },
      ],
      timeout: 5000,
    });
    await filterBox.click({ clickCount: 3 });
    await filterBox.pressSequentially(searchText, { delay: 60 });
    await filterBox.press('Space');
    await filterBox.press('Backspace');
    await this.listFrame.locator('#ctl00_LoadingPanel_LD').first()
      .waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});

    const matched = await this._waitForGridRowMatching(searchText, 10000);
    if (!matched) {
      await this.page.screenshot({
        path: `test-results/debug-vendor-search-not-found-${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
      throw new Error(
        `Vendor grid never showed a row matching "${searchText}" after searching — ` +
        'refusing to proceed with Edit/Delete against a possibly-stale/unfiltered row.'
      );
    }
    await this.page.waitForTimeout(300);
  }

  /** Same genuine-data-row verification principle as customerPage.js — require the match come from a row that also carries its own Edit/Delete links, not just the filter box's own cell. */
  async _waitForGridRowMatching(searchText, timeout = 10000) {
    const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dataRowPattern = new RegExp(`^Edit\\s+Delete\\s+${escaped}\\b`, 'i');
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

  /** Clicks the (first/only) matching row's own "Edit" link. */
  async clickEdit() {
    await this._dismissStrayDeleteDialogIfPresent();
    const { locator } = await heal(this.listFrame, {
      id: 'vendor.editLink',
      label: 'Edit',
      strategies: [
        { type: 'role', role: 'link', options: { name: 'Edit', exact: true } },
      ],
      timeout: 5000,
    });
    await locator.first().click();
    await this._resolveFormFrame();
  }

  /** Full flow: search -> Edit -> change Company Name -> Save -> Back. */
  async editVendor(searchText, newCompanyName) {
    await this.searchVendor(searchText);
    await this.clickEdit();
    await this.fillCompanyName(newCompanyName);
    await this.clickSave();
    await this.clickBack();
  }

  /** Clicks the (first/only) matching row's own "Delete" link. */
  async clickDelete() {
    await this._dismissStrayDeleteDialogIfPresent();
    const { locator } = await heal(this.listFrame, {
      id: 'vendor.deleteLink',
      label: 'Delete',
      strategies: [
        { type: 'role', role: 'link', options: { name: 'Delete', exact: true } },
      ],
      timeout: 5000,
    });
    await locator.first().click();
  }

  /** Same app-wide delete-confirm control already confirmed in customerPage.js/bankReconciliationPage.js/itemPage.js. Scoped to this.listFrame — never page-wide. */
  async confirmDelete() {
    const { locator: yesButton } = await heal(this.listFrame, {
      id: 'vendor.deleteConfirmYesButton',
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

  /** Full flow: search -> Delete -> confirm Yes. */
  async deleteVendor(searchText) {
    await this.searchVendor(searchText);
    await this.clickDelete();
    await this.confirmDelete();
  }

  /** Same "Deleted Successfully" banner text already confirmed in customerPage.js — assumed shared app-wide wording until proven otherwise live. */
  async isDeleteSuccessful() {
    const pattern = /delet\w*\s+success\w*/i;
    if (this.listFrame) {
      const text = this.listFrame.getByText(pattern);
      if ((await text.count().catch(() => 0)) > 0 && (await text.first().isVisible().catch(() => false))) {
        return true;
      }
    }
    const frame = await findFrame(this.page, async (f) => {
      const text = f.getByText(pattern);
      return (await text.count().catch(() => 0)) > 0 && (await text.first().isVisible().catch(() => false));
    }, { timeout: 3000 });
    return !!frame;
  }
}

module.exports = { VendorPage };
