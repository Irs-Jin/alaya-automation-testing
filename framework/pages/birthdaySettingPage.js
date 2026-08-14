const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for POS > Promotion Management > Birthday Setting.
 *
 * SOURCE: built directly from Jin's own Playwright codegen recording
 * (2026-07-27) plus his screenshot of the settings form (Company,
 * Promotion Type, Before Bday (day), After Bday (day), Item Point
 * Multiply, Member Type, single Save button — no Back/New, this is a
 * single persistent settings record, not a list).
 *
 * SHAPE: nav (POS > Promotion Management > Birthday Setting) > a single
 * settings form inside its own iframe (recorded as "212" — as with every
 * other DevExpress screen in this app, iframe names are unstable, so
 * still resolved via findFrame() by content, never hardcoded) > three
 * DevExpress ASPxSpinEdit numeric fields (Before Bday, Item Point
 * Multiply/"PointBenefit", After Bday), each with its own up/down spin
 * buttons (`_B-2Img` confirmed up, `_B-3Img` confirmed down, per the
 * recording's click order followed by value changes matching that
 * direction) > Save commits the whole form (no Back button — this is a
 * single-record settings screen, not a create/edit/list flow).
 */
class BirthdaySettingPage {
  constructor(page) {
    this.page = page;
    this.formFrame = null;
  }

  async goto() {
    const p = this.page;
    await p.getByRole('link', { name: 'POS', exact: true }).click();
    await p.getByRole('link', { name: 'Promotion Management', exact: true }).click();
    await p.getByRole('link', { name: 'Birthday Setting', exact: true }).click();
    await p.waitForLoadState('domcontentloaded');
    await this._resolveFormFrame();
  }

  async _resolveFormFrame() {
    const p = this.page;
    this.formFrame = await findFrame(p, async (frame) => {
      const field = frame.locator('[id$="_SEBeforeBday_I" i]');
      return (await field.count().catch(() => 0)) > 0 && (await field.first().isVisible().catch(() => false));
    });
    if (!this.formFrame) {
      await p.screenshot({ path: 'test-results/debug-birthday-setting-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Birthday Setting form frame (Before Bday field). ' +
        'Saved test-results/debug-birthday-setting-not-found.png for inspection.'
      );
    }
  }

  /**
   * Reads a spin-edit field's current numeric value.
   * @param {'BeforeBday'|'PointBenefit'|'AfterBday'} fieldName
   *
   * BUG FIXED (2026-08-14): the field being attached/visible (which
   * _resolveFormFrame() already confirms) is not proof the postback that
   * populates its actual value has finished — confirmed live via the `yew`
   * account: the very first read right after goto(), before any
   * interaction, intermittently returned "" (parseFloat -> NaN) on
   * PointBenefit specifically, while every later read of the same field,
   * after any spin click, read a real number. Poll for a genuinely
   * non-empty value instead of trusting the first read, same pattern as
   * customerPage.js's _waitForGridRowMatching.
   */
  async getFieldValue(fieldName) {
    const input = this.formFrame.locator(`[id$="_SE${fieldName}_I" i]`).first();
    const value = await this._waitForNonEmptyValue(input, 5000);
    return parseFloat(value);
  }

  async _waitForNonEmptyValue(locator, timeout) {
    const deadline = Date.now() + timeout;
    let value = await locator.inputValue().catch(() => '');
    while (value.trim() === '' && Date.now() < deadline) {
      await this.page.waitForTimeout(200);
      value = await locator.inputValue().catch(() => '');
    }
    return value;
  }

  /**
   * Clicks a spin-edit field's up (increment) button.
   * CONFIRMED via recording: `_B-2Img` (Before Bday, After Bday) — Item
   * Point Multiply's own recording used `_B-2` (no "Img" suffix) for the
   * up click, so both are tried.
   */
  async clickSpinUp(fieldName) {
    const { locator } = await heal(this.formFrame, {
      id: `birthdaySetting.${fieldName}.spinUp`,
      label: `${fieldName} spin up`,
      strategies: [
        { type: 'css', value: `[id$="_SE${fieldName}_B-2Img" i]` },
        { type: 'css', value: `[id$="_SE${fieldName}_B-2" i]` },
      ],
      timeout: 5000,
    });
    await locator.click();
    await this.page.waitForTimeout(300);
  }

  /** Clicks a spin-edit field's down (decrement) button. CONFIRMED via recording: `_B-3Img`. */
  async clickSpinDown(fieldName) {
    const { locator } = await heal(this.formFrame, {
      id: `birthdaySetting.${fieldName}.spinDown`,
      label: `${fieldName} spin down`,
      strategies: [
        { type: 'css', value: `[id$="_SE${fieldName}_B-3Img" i]` },
        { type: 'css', value: `[id$="_SE${fieldName}_B-3" i]` },
      ],
      timeout: 5000,
    });
    await locator.click();
    await this.page.waitForTimeout(300);
  }

  async clickSave() {
    const { locator } = await heal(this.formFrame, {
      id: 'birthdaySetting.saveButton',
      label: 'Save',
      strategies: [
        { type: 'text', value: 'Save', options: { exact: true } },
      ],
      timeout: 5000,
    });
    await locator.click();
    await this.page.waitForTimeout(1000);
  }

  /** Full flow per Jin's recording: bump all three fields up, Save, then back down, Save. */
  async bumpAllFieldsUpThenSave() {
    await this.clickSpinUp('BeforeBday');
    await this.clickSpinUp('PointBenefit');
    await this.clickSpinUp('AfterBday');
    await this.clickSave();
  }

  async bumpAllFieldsDownThenSave() {
    await this.clickSpinDown('BeforeBday');
    await this.clickSpinDown('PointBenefit');
    await this.clickSpinDown('AfterBday');
    await this.clickSave();
  }
}

module.exports = { BirthdaySettingPage };
