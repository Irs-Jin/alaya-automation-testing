const { findFrame } = require('../frameHelper');

/**
 * Page object for POS > Promotion Management > Promotion.
 *
 * SOURCE: built directly from Jin's own Playwright codegen recording
 * (2026-07-27) plus his screenshot of the Promotion list (Company,
 * Search, New button, grid columns Promotion Code/Description/Promotion
 * Type/Priority/Birthday Promotion/Price Group..., currently empty —
 * "No data to display", Rec: 0).
 *
 * SHAPE: nav (POS > Promotion Management > Promotion — exact match
 * needed, "Promotion Reports" is a separate, similarly-named nav item
 * right below it) > list grid with a "New" icon > New opens an "Add
 * Promotion" POPUP dialog (`pcAddPromotion` — a DevExpress PopupControl,
 * NOT a separate page/iframe, unlike Account Receivable > Customer's New
 * form) in the SAME frame > fill Promotion Code + Description, pick
 * Promotion Type / Priority / Customer Type from their own popup-grid
 * pickers > the popup's own Save commits the quick-create and navigates
 * to a full Promotion DETAIL page (`PromotionDetail` — a different
 * control area, still the same iframe) > a SECOND Save on the detail
 * page's own toolbar triggers a generic confirm dialog
 * (`pcConfirmMessageBox_btnConfirmYes_CD` — NOT the delete-confirm
 * dialog, a different reusable "are you sure" control) > Back returns to
 * the list > the new row's own Delete link triggers the SAME app-wide
 * delete-confirm dialog (`pcConfirmDel_btnYes_CD`) already confirmed safe
 * in bankReconciliationPage.js/customerPage.js.
 *
 * Recorded as a single iframe (name "213") throughout — since this
 * screen never navigates to a genuinely separate iframe (the "detail
 * page" is still rendered inside the same popup-turned-page structure),
 * one frame reference is resolved once and reused, still via findFrame()
 * rather than the hardcoded name, consistent with every other screen in
 * this app where iframe names are confirmed unstable.
 */
class PromotionPage {
  constructor(page) {
    this.page = page;
    this.frame = null;
  }

  async goto() {
    const p = this.page;
    await p.getByRole('link', { name: 'POS', exact: true }).click();
    await p.getByRole('link', { name: 'Promotion Management', exact: true }).click();
    // exact:true is required here — "Promotion Reports" is a distinct,
    // separate nav item directly below "Promotion" in the same submenu.
    await p.getByRole('link', { name: 'Promotion', exact: true }).click();
    await p.waitForLoadState('domcontentloaded');
    await this._resolveFrame();
  }

  async _resolveFrame() {
    const p = this.page;
    this.frame = await findFrame(p, async (frame) => {
      const newIcon = frame.getByRole('img', { name: /Click Here Or Press \[Insert\]/i });
      return (await newIcon.count().catch(() => 0)) > 0 && (await newIcon.first().isVisible().catch(() => false));
    });
    if (!this.frame) {
      await p.screenshot({ path: 'test-results/debug-promotion-list-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Promotion list frame (New icon). ' +
        'Saved test-results/debug-promotion-list-not-found.png for inspection.'
      );
    }
  }

  async clickNew() {
    const addIcon = this.frame.getByRole('img', { name: /Click Here Or Press \[Insert\]/i }).first();
    await addIcon.waitFor({ state: 'visible', timeout: 5000 });
    await addIcon.click();
  }

  async fillPromotionCode(code) {
    const field = this.frame.getByRole('textbox', { name: 'Promotion Code:', exact: true });
    await field.click();
    await field.fill(code);
  }

  async fillDescription(description) {
    const field = this.frame.getByRole('textbox', { name: 'Description:', exact: true });
    await field.click();
    await field.fill(description);
  }

  /** Opens the Promotion Type popup-grid picker and clicks the matching option cell. */
  async selectPromotionType(optionText) {
    await this.frame.locator('#ctl00_MainContent_Promotion_pcAddPromotion_formAddPromotion_cbPromotionType_B-1Img').click();
    await this.frame.getByRole('cell', { name: optionText, exact: true }).click();
  }

  /**
   * Opens the Priority popup-grid picker and clicks the matching value cell.
   *
   * BUG FIXED (2026-07-27): the unscoped `getByRole('cell', {name: value,
   * exact:true})` matched TWO elements once the underlying Promotion list
   * grid also had a row whose own Priority column value happened to equal
   * the same number (a real "strict mode violation" seen live) — the
   * popup's own option cell AND a background data-row cell share the exact
   * same accessible text. Scoped to the dropdown's own list container
   * (`..._SEPriority_DDD_...`, confirmed via live DOM dump) so it can only
   * ever match the popup's own options.
   */
  async selectPriority(value) {
    await this.frame.locator('#ctl00_MainContent_Promotion_pcAddPromotion_formAddPromotion_SEPriority_B-1Img').click();
    await this.frame.locator('[id*="SEPriority_DDD" i]').getByRole('cell', { name: String(value), exact: true }).click();
  }

  /** Opens the Customer Type popup-grid picker and clicks the matching option cell. */
  async selectCustomerType(optionText) {
    await this.frame.locator('#ctl00_MainContent_Promotion_pcAddPromotion_formAddPromotion_cbCustomerType_B-1').click();
    await this.frame.getByRole('cell', { name: optionText, exact: true }).click();
  }

  /** The "Add Promotion" popup's own Save — commits the quick-create and opens the detail page. */
  async clickPopupSave() {
    await this.frame.locator('span').filter({ hasText: /^Save$/ }).click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * The Promotion Detail page's own toolbar Save.
   *
   * BUG FIXED (2026-07-27): the CSS id recorded (`...mToolBar_mToolBars_
   * DXI4_T`) didn't hold the Save button on this page — a live DOM dump
   * after a failure found the real element as a `listitem` with title
   * "Save [Alt + S]" (same title pattern already confirmed for other
   * toolbar Save buttons elsewhere in this app, e.g. Customer's), not
   * nested inside that specific container. Targets the title attribute
   * directly instead, with an explicit visibility wait so this doesn't
   * race the detail page still finishing its render after the popup's
   * own Save closed it.
   */
  async clickDetailSave() {
    const saveButton = this.frame.locator('[title="Save [Alt + S]"]').first();
    await saveButton.waitFor({ state: 'visible', timeout: 10000 });
    await saveButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Confirms the generic "are you sure" dialog that follows the detail
   * page's Save, IF it appears — CONFIRMED via recording to be
   * `pcConfirmMessageBox_btnConfirmYes_CD`, a DIFFERENT reusable control
   * from the delete confirm dialog (`pcConfirmDel`). Do not conflate the
   * two.
   *
   * BUG FIXED (2026-07-27): originally treated this dialog as mandatory
   * and waited up to 30s for it — but confirmed live, twice, that it does
   * NOT always appear after Save with the exact same data/flow (one run
   * showed it and passed, an immediately-following identical run never
   * showed it — 60+ retries over 30s all resolved to the same genuinely
   * hidden element, not a slow-render race). Whatever business condition
   * actually triggers this dialog isn't fully understood yet, so it's
   * treated as OPTIONAL: wait a bounded 8s, click Yes if it shows up,
   * otherwise assume Save completed without needing confirmation and move
   * on. This can only take an extra ~8s in the case where a real "Yes" was
   * needed but slow to render — investigate further if that turns out to
   * be a real gap, but don't hard-fail the whole test on it meanwhile.
   */
  async confirmSaveMessage() {
    const yesButton = this.frame.locator('#ctl00_pcConfirmMessageBox_btnConfirmYes_CD span').filter({ hasText: 'Yes' });
    const appeared = await yesButton.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
    if (!appeared) return;
    await yesButton.click();
    await yesButton.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    await this.page.waitForTimeout(1000);
  }

  async clickBack() {
    await this.frame.getByText('Back').click();
    await this.page.waitForTimeout(1000);
  }

  /** Full flow: New -> fill fields -> popup Save -> detail Save -> confirm -> Back. */
  async createPromotion({ code, description, promotionType, priority, customerType }) {
    await this.clickNew();
    await this.fillPromotionCode(code);
    await this.fillDescription(description);
    await this.selectPromotionType(promotionType);
    await this.selectPriority(priority);
    await this.selectCustomerType(customerType);
    await this.clickPopupSave();
    await this.clickDetailSave();
    await this.confirmSaveMessage();
    await this.clickBack();
  }

  /**
   * Waits for a genuine grid data row matching the given text (e.g. the
   * promotion's own Description) to appear after returning to the list —
   * the same "don't click Delete before the grid actually shows it"
   * safety lesson learned the hard way in customerPage.js's
   * searchCustomer(), applied here even though this screen has no search
   * box: Back navigation still needs a moment to repaint the grid.
   */
  async waitForRowMatching(text, timeout = 10000) {
    const row = this.frame.getByRole('row', { name: new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') });
    await row.first().waitFor({ state: 'visible', timeout });
  }

  async clickDelete() {
    await this.frame.getByRole('link', { name: 'Delete', exact: true }).first().click();
  }

  /** Same app-wide delete-confirm dialog already confirmed safe elsewhere in this app. */
  async confirmDelete() {
    const yesButton = this.frame.locator('#ctl00_pcConfirmDel_btnYes_CD span').filter({ hasText: 'Yes' });
    await yesButton.waitFor({ state: 'visible', timeout: 30000 });
    await yesButton.click();
    await yesButton.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    await this.page.waitForTimeout(1000);
  }

  /** Full flow: wait for the row -> Delete -> confirm Yes. */
  async deletePromotion(rowMatchText) {
    await this.waitForRowMatching(rowMatchText);
    await this.clickDelete();
    await this.confirmDelete();
  }
}

module.exports = { PromotionPage };
