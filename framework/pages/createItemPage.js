const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Inventory > Item Master > Create New Item.
 *
 * Confirmed via Playwright codegen recording (Jin, 2026-07-23):
 * - Nav: Inventory / Item are plain role="link" elements — no menu-expand
 *   logic needed.
 * - The grid's "Add" icon lives inside an iframe with a dynamic/unstable
 *   name (e.g. "3474") — found by scanning frames for the icon instead.
 * - The Create Item form opens in its OWN iframe (name literally
 *   "undefined" in the recording — also unstable) — found by scanning
 *   frames for the "Description:" textbox.
 * - The main content field is labeled "Description:", not "Item Name".
 * - Item Group is a DevExpress dropdown: click an image trigger, then a
 *   popup grid appears with selectable cells.
 * - Save lives inside a specific toolbar container, found via text within it.
 *
 * TODO(Jin): Item Code, UOM, Unit Price, and the Serial Item checkbox are
 * still unconfirmed guesses (marked below) — the codegen recording didn't
 * touch them. Send their outerHTML (from inside the open Create Item form)
 * the same way you did for the login fields, and I'll wire up exact
 * selectors for these too.
 */
class CreateItemPage {
  constructor(page) {
    this.page = page;
    this.formFrame = null; // resolved by goto() once the Create Item form iframe is found
  }

  async goto() {
    const p = this.page;

    await p.getByRole('link', { name: 'Inventory', exact: true }).click();
    await p.getByRole('link', { name: 'Item', exact: true }).click();
    await p.waitForLoadState('networkidle');

    const addIconName = /Click Here Or Press \[Insert\]/i;
    const addFrame = await findFrame(p, async (frame) => {
      const img = frame.getByRole('img', { name: addIconName });
      return (await img.count()) > 0 && (await img.first().isVisible().catch(() => false));
    });
    if (!addFrame) {
      await p.screenshot({ path: 'test-results/debug-item-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the frame containing the "Add" icon on the Item list page. ' +
        'Saved test-results/debug-item-list-page.png for inspection.'
      );
    }
    await addFrame.getByRole('img', { name: addIconName }).first().click();

    this.formFrame = await findFrame(p, async (frame) => {
      const desc = frame.getByRole('textbox', { name: 'Description:', exact: true });
      return (await desc.count()) > 0 && (await desc.first().isVisible().catch(() => false));
    });
    if (!this.formFrame) {
      await p.screenshot({ path: 'test-results/debug-after-add-click.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the Create Item form frame after clicking Add. ' +
        'Saved test-results/debug-after-add-click.png for inspection.'
      );
    }
  }

  async fields() {
    if (!this.formFrame) {
      throw new Error('Call goto() before fields() — form frame has not been resolved yet.');
    }
    const f = this.formFrame;

    return {
      // Confirmed — this is the field ALAYA actually calls "Description",
      // functioning as the item's display name.
      description: f.getByRole('textbox', { name: 'Description:', exact: true }),

      // TODO(Jin): unconfirmed guesses below — send real HTML to replace these.
      itemCode: (await heal(f, {
        id: 'createItem.itemCode',
        label: 'Item Code',
        strategies: [
          { type: 'label', value: 'Item Code' },
          { type: 'placeholder', value: 'Item Code' },
          { type: 'css', value: 'input[id*="txtItemCode" i]' },
        ],
        timeout: 1500,
      }).catch(() => ({ locator: null }))).locator,

      unitPrice: (await heal(f, {
        id: 'createItem.unitPrice',
        label: 'Unit Price',
        strategies: [
          { type: 'label', value: 'Unit Price' },
          { type: 'placeholder', value: 'Unit Price' },
          { type: 'css', value: 'input[id*="txtUnitPrice" i]' },
        ],
        timeout: 1500,
      }).catch(() => ({ locator: null }))).locator,

      isSerialItem: (await heal(f, {
        id: 'createItem.isSerialItem',
        label: 'Serial Item',
        strategies: [
          { type: 'label', value: 'Serial Item' },
          { type: 'css', value: 'input[type="checkbox"][id*="chkSerial" i]' },
        ],
        timeout: 1500,
      }).catch(() => ({ locator: null }))).locator,

      // Confirmed — Save button lives inside this toolbar container.
      saveButton: f.locator(
        '#ctl00_MainContent_ItemCreationDetails_mItemCreationDetailsToolBar_mToolBars_DXI4_T'
      ).getByText('Save', { exact: true }),
    };
  }

  /**
   * Confirmed via codegen: Item Group is a DevExpress dropdown — click the
   * image trigger, wait for the popup grid, then click the matching cell.
   */
  async selectItemGroup(groupValue) {
    const f = this.formFrame;
    const { locator: trigger } = await heal(f, {
      id: 'createItem.itemGroupTrigger',
      label: 'Item Group',
      strategies: [
        {
          type: 'css',
          value: '#ctl00_MainContent_ItemCreationDetails_cbpItemCreationDetails_cbpDtl_formItemCreationDetails_tabs_formLayoutGeneral_ddlItemGroup_B-1Img',
        },
        { type: 'role', role: 'combobox', options: { name: /item group/i } },
      ],
    });
    await trigger.click();
    await f.getByRole('cell', { name: groupValue, exact: true }).click();
  }

  async createItem({ description, itemGroup, itemCode, unitPrice, isSerialItem = false }) {
    const f = await this.fields();

    if (description !== undefined) {
      await f.description.fill(description);
    }
    if (itemGroup) {
      await this.selectItemGroup(itemGroup);
    }
    if (itemCode !== undefined && f.itemCode) {
      await f.itemCode.fill(itemCode).catch(() => {});
    }
    if (unitPrice !== undefined && f.unitPrice) {
      await f.unitPrice.fill(String(unitPrice)).catch(() => {});
    }
    if (isSerialItem && f.isSerialItem) {
      await f.isSerialItem.check().catch(() => {});
    }

    await f.saveButton.click();
  }

  /**
   * TODO(Jin): confirm the actual success indicator (toast, redirect, grid
   * refresh, etc.) — this checks both the main page and the form frame
   * since it could render in either place.
   */
  async expectCreateSuccess() {
    const pattern = /successfully|created|saved/i;
    try {
      await this.page.waitForSelector(`text=${pattern}`, { timeout: 5000 });
    } catch {
      if (this.formFrame) {
        await this.formFrame.waitForSelector(`text=${pattern}`, { timeout: 5000 });
      } else {
        throw new Error('Could not confirm item creation success — no success indicator found.');
      }
    }
  }

  /**
   * TODO(Jin): confirm the actual validation error indicator, if different.
   */
  async getValidationErrors() {
    const scope = this.formFrame || this.page;
    return scope.locator('[class*="error" i], [class*="validation" i]').allTextContents();
  }
}

module.exports = { CreateItemPage };
