const { heal } = require('../selfHealingLocator');
const { findFrame } = require('../frameHelper');

/**
 * Page object for Sales > Cash Sales > New.
 *
 * PILOT (Jin, 2026-07-24): converted from the old Katalon "CSN" test case
 * (Test Cases/Regression Test/Sales/Cash Sales/CSN.tc). PASSING end-to-end
 * (both spec cases) against client UAT (user admin) using the ORIGINAL
 * Katalon test data — "000001" (customer YEONG) / "BISKUT PLANTA" — which
 * turns out to be real data in UAT specifically (see spec file header).
 * Also cross-checked against client qa3 with different (qa3-specific) test
 * data; qa3 has since shown one flaky failure at the customer-cell-click
 * step unrelated to any fix below (not yet root-caused — may just be
 * server load) — the UAT run is the clean reference pass.
 *
 * CONFIRMED working (real runs + manual browser cross-checks):
 * - Nav (Sales / Cash Sales role="link"), the shared "Add" grid icon
 *   (same title text as Create Item's), and the form-opens-in-its-own-iframe
 *   pattern — all carried over from Katalon and still correct.
 * - Customer search: click `customerTrigger` → popup grid (paginated, ~1.5s
 *   load delay) → click matching row → OK. Selecting a customer auto-fills
 *   Sales Branch / Sales Agent / Warehouse / Price Level from that
 *   customer's defaults.
 * - Item search: click `itemTrigger` WHILE THE ITEM TEXTBOX IS EMPTY opens
 *   the same kind of browsable popup grid as Customer. (If you type text
 *   into that box first, it instead tries an exact-match lookup and shows
 *   an "Item ... not found" error dialog if there's no match — a different
 *   code path, not used here.)
 *
 * CORRECTED from the original pilot draft — verified live, NOT assumed:
 * - The "New" toolbar button does **not** save anything. It just clears the
 *   form back to a blank record (confirmed: clicking it after adding a
 *   customer+item reset both, and the Cash Sales list's record count didn't
 *   change). Katalon's own CSN.tc ends on this same "New" click, which means
 *   CSN was only ever exercising the fill-the-form path, not persistence.
 *
 * POST — now implemented and CONFIRMED (Jin, 2026-07-24), via
 * postCashSales() / clickPost() / completeMultiPayment():
 * - Post opens a MultiPayment dialog automatically (same trigger-free
 *   behavior confirmed for Save Draft). Ground truth for every control in
 *   it (the "+" add-row icon, the Payment Mode combo, its CASH option, the
 *   final OK) came directly from Katalon's CSP.tc Object Repository — see
 *   the method comments for exact ids.
 * - The Payment Mode picker is a plain DevExpress combo/listbox (click
 *   dropdown arrow → click option), NOT a big search-grid popup like
 *   Customer/Item — simpler, no OK-button ambiguity there.
 * - The final MultiPayment OK reuses the exact same dx-vam :visible fix as
 *   the Customer/Item popups (see RESOLVED section below) — same bug,
 *   same fix, no rediscovery needed.
 * - A successful Post takes noticeably longer to settle than item
 *   selection: ~5s for the document to actually get a real number assigned
 *   (Katalon itself used a 5s delay at this exact step), then it
 *   auto-opens a "Cash Sales Detail GST Report" preview (a FastReport PDF
 *   in its own iframe/tab — Katalon's CSP.tc clicks a "Print from Adobe
 *   Reader" button in it next, confirming what it is). That report keeps
 *   showing a loading spinner for a while — don't mistake it for a stuck
 *   post; the underlying document is already correctly numbered by then.
 * - **The reliable success signal is NOT a "Status" field** (there isn't a
 *   plain one holding "POSTED" text) — it's the hidden
 *   `...DocNoFormatControl...ValueInput` field going from no `CS-` prefix
 *   to a real one (e.g. `"5^CS-00001008"`). See expectPostSuccess().
 * - Visually confirmed end-to-end: posting produces a real "Simplified Tax
 *   Invoice" report (Cash Sales No. CS-00001008, customer YEONG, item
 *   BISKUT PLANTA) — this is the actual live UAT output, not a mock.
 *
 * RESOLVED — the popup "OK" button bug (root-caused, not guessed away):
 * this app keeps many hidden CLONES of the exact shape `<span
 * class="dx-vam">OK</span>` in the same frame's DOM (other collapsed
 * dialogs, e.g. a Purchase Transfer popup), and at any moment only ONE is
 * genuinely visible — confirmed via a live `getBoundingClientRect()` +
 * `getComputedStyle()` probe. `span.dx-vam:visible:text-is("OK")` correctly
 * isolates it. There's also a ~1.5s DevExpress callback after clicking OK
 * before the new row actually lands in the grid — check too early and it
 * still reads "No data to display".
 * IMPORTANT gotcha for the self-healing framework itself: `heal()` records
 * a strategy as "successful" once its locator ATTACHES — it has no idea
 * whether the caller's subsequent `.click()` actually worked. The wrong
 * hidden "OK" clone attaches instantly every time, so a bare `text: 'OK'`
 * fallback was silently accumulating false successCount in
 * knowledge-base.json every run, outranking the correct selector once it
 * was added. Had to manually clear the poisoned KB entry once; watch for
 * this pattern with any other "OK"/"Cancel"/generic-text fallback in this
 * app — prefer a strategy that's unambiguous by construction (like the
 * dx-vam :visible one) over one that merely happens to attach.
 *
 * STILL UNCONFIRMED (Katalon IDs kept as first-guess strategies, backed by
 * looser attribute-pattern fallbacks, fuzzy-by-label as last resort):
 * - saveDraftButton / newButton / backButton IDs themselves (the *behavior*
 *   of New vs. Save Draft is confirmed above; their exact selectors are
 *   not yet re-inspected).
 * - The MultiPayment dialog entirely (trigger icon, payment-mode popup,
 *   OK button) — not touched in this pass.
 * Caveat: the search-trigger icons have no visible text/aria-label, so
 * fuzzyDiscover() (matches only visible text) likely can't recover them if
 * their IDs go stale — that needs a real DevTools inspection, not just
 * fuzzy fallback.
 */
class CashSalesPage {
  constructor(page) {
    this.page = page;
    this.formFrame = null; // resolved by goto() once the Cash Sales detail form iframe is found
  }

  async goto() {
    const p = this.page;

    await p.getByRole('link', { name: 'Sales', exact: true }).click();
    await p.getByRole('link', { name: 'Cash Sales', exact: true }).click();
    await p.waitForLoadState('networkidle');

    const addIconName = /Click Here Or Press \[Insert\]/i;
    const listFrame = await findFrame(p, async (frame) => {
      const img = frame.getByRole('img', { name: addIconName });
      return (await img.count()) > 0 && (await img.first().isVisible().catch(() => false));
    });
    if (!listFrame) {
      await p.screenshot({ path: 'test-results/debug-cash-sales-list-page.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the frame containing the "Add" icon on the Cash Sales list page. ' +
        'Saved test-results/debug-cash-sales-list-page.png for inspection.'
      );
    }
    await listFrame.getByRole('img', { name: addIconName }).first().click();

    // TODO(Jin): confirm this distinguishing element still exists — pulled
    // from the Katalon repo's cbSelectCust_B1Img id (Customer search icon).
    this.formFrame = await findFrame(p, async (frame) => {
      const trigger = frame.locator('img[id*="cbSelectCust" i]');
      return (await trigger.count()) > 0 && (await trigger.first().isVisible().catch(() => false));
    });
    if (!this.formFrame) {
      await p.screenshot({ path: 'test-results/debug-after-cash-sales-add-click.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the New Cash Sales form frame after clicking Add. ' +
        'Saved test-results/debug-after-cash-sales-add-click.png for inspection.'
      );
    }
  }

  async fields() {
    if (!this.formFrame) {
      throw new Error('Call goto() before fields() — form frame has not been resolved yet.');
    }
    const f = this.formFrame;

    return {
      // TODO(Jin): confirm — Katalon id: cbCustomer_cbSelectCust_B1Img
      customerTrigger: (await heal(f, {
        id: 'cashSales.customerTrigger',
        label: 'Customer',
        strategies: [
          {
            type: 'css',
            value: '#ctl00_MainContent_CashSalesDetail_cbpCashSales_cbpSalesHeader_ASPxRoundPanel1_formCashSalesHeader_cbCustomer_cbSelectCust_B1Img',
          },
          { type: 'css', value: 'img[id*="cbSelectCust" i]' },
          { type: 'css', value: 'img[id*="SelectCust" i]' },
        ],
        timeout: 1500,
      }).catch(() => ({ locator: null }))).locator,

      // TODO(Jin): confirm — Katalon id: ItemAdvanceSearchControlCashSales_txtItemSearchUpdate_B0Img
      itemTrigger: (await heal(f, {
        id: 'cashSales.itemTrigger',
        label: 'Item',
        strategies: [
          {
            type: 'css',
            value: '#ctl00_MainContent_CashSalesDetail_cbpCashSales_cbpSalesDetails_formSalesDetails_PC_0_ItemAdvanceSearchControlCashSales_txtItemSearchUpdate_B0Img',
          },
          { type: 'css', value: 'img[id*="txtItemSearchUpdate" i]' },
          { type: 'css', value: 'img[id*="ItemSearch" i]' },
        ],
        timeout: 1500,
      }).catch(() => ({ locator: null }))).locator,

      // Confirmed (Jin, 2026-07-24 live run): this button does NOT save —
      // it clears the form back to a blank record. Do not use this as a
      // "create" terminal step; see saveDraftButton instead.
      // TODO(Jin): confirm exact selector — Katalon id ends in mToolBars_DXI10_T, title "New [Alt + F1]"
      newButton: (await heal(f, {
        id: 'cashSales.newButton',
        label: 'New',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_CashSalesDetail_cbpCashSales_mCashSalesDetailsToolBar_mToolBars_DXI10_T' },
          { type: 'css', value: '[title="New [Alt + F1]"]' },
          { type: 'text', value: 'New', options: { exact: true } },
        ],
        timeout: 1500,
      }).catch(() => ({ locator: null }))).locator,

      // Confirmed (Jin, 2026-07-24 live run): this is the actual persist
      // action — but it opens a MultiPayment dialog first (payment mode is
      // itself a searchable popup control) before the record is saved.
      // NOT wired up yet in createCashSales() — out of scope for this pass.
      // TODO(Jin): confirm exact selector — Katalon id ends in mToolBars_DXI4_T, text "Save Draft"
      saveDraftButton: (await heal(f, {
        id: 'cashSales.saveDraftButton',
        label: 'Save Draft',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_CashSalesDetail_cbpCashSales_mCashSalesDetailsToolBar_mToolBars_DXI4_T' },
          { type: 'css', value: '[title="Save Draft [Alt + S]"]' },
          { type: 'text', value: 'Save Draft', options: { exact: true } },
        ],
        timeout: 1500,
      }).catch(() => ({ locator: null }))).locator,

      // TODO(Jin): confirm — Katalon id ends in mToolBars_DXI0_T, title "Back [Alt + B]"
      backButton: (await heal(f, {
        id: 'cashSales.backButton',
        label: 'Back',
        strategies: [
          { type: 'css', value: '#ctl00_MainContent_CashSalesDetail_cbpCashSales_mCashSalesDetailsToolBar_mToolBars_DXI0_T' },
          { type: 'css', value: '[title="Back [Alt + B]"]' },
          { type: 'text', value: 'Back', options: { exact: true } },
        ],
        timeout: 1500,
      }).catch(() => ({ locator: null }))).locator,
    };
  }

  /**
   * Customer selection is a DevExpress popup-grid pick: click the
   * search-icon trigger, then click the grid row matching
   * `customerCode`, then confirm with OK. The OK button's id is only
   * known from Katalon (unconfirmed) — falls
   * back to matching visible "OK" text within whichever frame the popup
   * actually rendered in, since DevExpress may render it one iframe level
   * deeper than the trigger (seen in the Katalon ref_element metadata).
   */
  async selectCustomer(customerCode) {
    const f = this.formFrame;
    const { locator: trigger } = await heal(f, {
      id: 'cashSales.customerTrigger',
      label: 'Customer',
      strategies: [
        {
          type: 'css',
          value: '#ctl00_MainContent_CashSalesDetail_cbpCashSales_cbpSalesHeader_ASPxRoundPanel1_formCashSalesHeader_cbCustomer_cbSelectCust_B1Img',
        },
        { type: 'css', value: 'img[id*="cbSelectCust" i]' },
      ],
    });
    await trigger.click();

    const popupFrame = (await findFrame(this.page, async (frame) => {
      const cell = frame.getByRole('cell', { name: customerCode, exact: true });
      return (await cell.count()) > 0;
    }, { timeout: 20000 })) || f;

    // BUG FIXED (2026-07-27): confirmed live to fail deep into the full
    // suite run under sustained load — the customer-picker popup's grid
    // took longer than the global 10s action-timeout default to actually
    // render the matching row. Same class of issue as the report-print-
    // button and confirm-dialog timeouts elsewhere in this repo; widened
    // explicitly instead of relying on the global default.
    const customerCell = popupFrame.getByRole('cell', { name: customerCode, exact: true });
    await customerCell.waitFor({ state: 'visible', timeout: 30000 });
    await customerCell.click();

    // Root-caused via a live DOM probe (Jin, 2026-07-24): this app has MANY
    // hidden clones of `<span class="dx-vam">OK</span>` sitting elsewhere in
    // the DOM (other collapsed dialogs share the exact same class/text) —
    // at any moment only ONE is genuinely visible (real bounding box,
    // visibility:visible). A bare text-exact "OK" fallback grabs whichever
    // one is attached first regardless of visibility, which is unsafe. The
    // popup also needs a beat to finish rendering after the row click —
    // without it, heal() can time out on the correctly-scoped `:visible`
    // strategy before the span finishes appearing and fall through to a
    // wrong, already-attached hidden clone instead.
    // This popup's OK has been reliably matched by its Katalon id in every
    // live run so far — kept as the primary strategy. The dx-vam/id-substring
    // entries are fallbacks in case that id drifts later (see selectItem()'s
    // comment for why a bare text-exact fallback alone is unsafe).
    await popupFrame.waitForTimeout(800);
    const { locator: okButton } = await heal(popupFrame, {
      id: 'cashSales.customerPopupOkButton',
      label: 'OK',
      strategies: [
        {
          type: 'css',
          value: '#ctl00_MainContent_CashSalesDetail_cbpCashSales_cbpSalesHeader_ASPxRoundPanel1_formCashSalesHeader_cbCustomer_gsc_cbSelectCust_pcGeneralSearchControl_cpnlGeneralSearchControl_formGeneralSearchControl_btnOk_CD',
        },
        { type: 'css', value: 'span.dx-vam:visible:text-is("OK")' },
        { type: 'css', value: '[id*="GeneralSearchControl" i][id*="btnOk" i]:visible' },
        { type: 'text', value: 'OK', options: { exact: true } },
      ],
      timeout: 5000,
    });
    await okButton.click();
  }

  /**
   * Item selection — same popup-grid pick pattern as selectCustomer(), but
   * against the item search control. The Katalon OK button here is a
   * <span> (not a <div> like the customer popup's), rendered inside a
   * differently-scoped id — kept as-is rather than assumed equivalent.
   */
  async selectItem(itemDescription) {
    const f = this.formFrame;
    const { locator: trigger } = await heal(f, {
      id: 'cashSales.itemTrigger',
      label: 'Item',
      strategies: [
        {
          type: 'css',
          value: '#ctl00_MainContent_CashSalesDetail_cbpCashSales_cbpSalesDetails_formSalesDetails_PC_0_ItemAdvanceSearchControlCashSales_txtItemSearchUpdate_B0Img',
        },
        { type: 'css', value: 'img[id*="txtItemSearchUpdate" i]' },
      ],
    });
    await trigger.click();

    const popupFrame = (await findFrame(this.page, async (frame) => {
      const cell = frame.getByRole('cell', { name: itemDescription, exact: true });
      return (await cell.count()) > 0;
    })) || f;

    // .first() guards against ambiguous test data (e.g. this SIT env has
    // three separate items all described "RRR") — picks whichever matches
    // first rather than throwing a strict-mode violation.
    await popupFrame.getByRole('cell', { name: itemDescription, exact: true }).first().click();

    // Root-caused via a live DOM probe (Jin, 2026-07-24), not guessed: this
    // popup's OK genuinely IS `<span class="dx-vam">OK</span>`, exactly as
    // Katalon recorded — but the page also has several hidden CLONES of
    // that exact same tag/class/text elsewhere (other collapsed dialogs,
    // e.g. a Purchase Transfer popup's `input[value="OK"]`, and other
    // dx-vam "OK" spans belonging to different toolbars). At any moment
    // only ONE is genuinely visible (confirmed via getBoundingClientRect +
    // computed visibility on a live run). The popup also needs a beat to
    // finish rendering after the row click — without it, heal() can time
    // out on the correctly-scoped `:visible` strategy before the span
    // finishes appearing, and fall through to an already-attached hidden
    // clone instead (this was the actual bug, not a wrong selector).
    await popupFrame.waitForTimeout(800);
    const { locator: okButton } = await heal(popupFrame, {
      id: 'cashSales.itemPopupOkButton',
      label: 'OK',
      strategies: [
        { type: 'css', value: 'span.dx-vam:visible:text-is("OK")' },
        {
          type: 'css',
          value: '#ctl00_MainContent_CashSalesDetail_cbpCashSales_cbpSalesDetails_formSalesDetails_PC_0_ItemAdvanceSearchControlCashSales_pcItemSearchControl_cpnlItemSearchControl_formItemSearchControl_btnItemSearchOk_CD > span.dx-vam',
        },
        { type: 'css', value: '[id*="ItemSearchOk" i]:visible' },
        { type: 'text', value: 'OK', options: { exact: true } },
      ],
      timeout: 5000,
    });
    await okButton.click();

    // The grid runs a DevExpress callback to actually insert the new row
    // after OK is clicked — confirmed live: checking immediately can still
    // see "No data to display" mid-callback. Give it a beat to land.
    await this.page.waitForTimeout(1500);
  }

  /**
   * Fills the header (Customer) and adds one item line. Deliberately stops
   * there — it does NOT click Save Draft/Post, since both require the
   * MultiPayment dialog (out of scope for this pass; see class comment).
   * Use getItemRowDescriptions() to verify the item line landed correctly.
   */
  async createCashSales({ customerCode, itemDescription }) {
    if (customerCode) await this.selectCustomer(customerCode);
    if (itemDescription) await this.selectItem(itemDescription);
  }

  /**
   * Clicks the "Post" toolbar button. Confirmed live (Jin, 2026-07-24) that
   * this auto-opens the MultiPayment dialog — same behavior Katalon's
   * CSP.tc relied on (it clicks straight into the MultiPayment "Add" icon
   * right after Post, with no separate trigger click in between).
   */
  async clickPost() {
    const f = this.formFrame;
    const { locator: postButton } = await heal(f, {
      id: 'cashSales.postButton',
      label: 'Post',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_CashSalesDetail_cbpCashSales_mCashSalesDetailsToolBar_mToolBars_DXI2_T' },
        { type: 'css', value: '[title="Post [Alt + P]"]' },
        { type: 'text', value: 'Post', options: { exact: true } },
      ],
      timeout: 1500,
    });
    await postButton.click();
    // MultiPayment dialog opens via a DevExpress callback — give it a beat.
    await this.page.waitForTimeout(1500);
  }

  /**
   * Handles the MultiPayment dialog that Post/Save Draft opens: click the
   * "+" to add a payment row, pick the payment mode from its dropdown
   * (a plain DevExpress combo listbox — NOT a big search-grid popup like
   * Customer/Item), then confirm with the dialog's own OK button.
   *
   * Ground truth for all of this came directly from Katalon's CSP Object
   * Repository (`img_MultiPayment_..._17d86d`, `img_Loading_..._9ec45e`,
   * `td_CASH`, `span_OK (1)` — all under the `pcCSMultipayment` control
   * tree), not guessed. The final OK reuses the same dx-vam :visible fix
   * as Customer/Item — see the class header comment for why that's needed.
   */
  async completeMultiPayment(paymentMode = 'CASH') {
    const p = this.page;

    const dialogFrame = (await findFrame(p, async (frame) => {
      const addIcon = frame.locator('img[id*="CSMultipayment" i][id*="header0_Add" i]');
      return (await addIcon.count()) > 0 && (await addIcon.first().isVisible().catch(() => false));
    })) || this.formFrame;

    const { locator: addRow } = await heal(dialogFrame, {
      id: 'cashSales.multiPaymentAddRow',
      label: 'Add payment row',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_CashSalesDetail_cbpCashSales_pcCSMultipayment_formCSMultipayment_gvCSMultiPayment_header0_Add' },
        { type: 'css', value: 'img[id*="CSMultipayment" i][id*="header0_Add" i]' },
        { type: 'css', value: 'img[title="Add"]:visible' },
      ],
      timeout: 3000,
    });
    await addRow.click();
    await p.waitForTimeout(1000);

    const { locator: modeTrigger } = await heal(dialogFrame, {
      id: 'cashSales.multiPaymentModeTrigger',
      label: 'Payment Mode',
      strategies: [
        { type: 'css', value: '#ctl00_MainContent_CashSalesDetail_cbpCashSales_pcCSMultipayment_formCSMultipayment_gvCSMultiPayment_DXEditor3_B-1Img' },
        { type: 'css', value: 'img[id*="CSMultipayment" i][id*="DXEditor" i][id*="B-1Img" i]:visible' },
      ],
      timeout: 3000,
    });
    await modeTrigger.click();
    await p.waitForTimeout(800);

    const { locator: modeOption } = await heal(dialogFrame, {
      id: 'cashSales.multiPaymentModeOption',
      label: paymentMode,
      strategies: [
        { type: 'css', value: `td[id*="CSMultipayment" i][id*="DDD_L_LBI" i]:visible:text-is("${paymentMode}")` },
        { type: 'text', value: paymentMode, options: { exact: true } },
      ],
      timeout: 3000,
    });
    await modeOption.click();
    await p.waitForTimeout(500);

    // Same root-caused dx-vam ambiguity as Customer/Item OK buttons — see
    // class header comment. A settle wait first, then :visible-scoped OK.
    await p.waitForTimeout(800);
    const { locator: confirmButton } = await heal(dialogFrame, {
      id: 'cashSales.multiPaymentOkButton',
      label: 'OK',
      strategies: [
        { type: 'css', value: 'span.dx-vam:visible:text-is("OK")' },
        { type: 'css', value: '#ctl00_MainContent_CashSalesDetail_cbpCashSales_pcCSMultipayment_formCSMultipayment_btnMakePaymentClick_CD > span.dx-vam' },
        { type: 'css', value: '[id*="btnMakePaymentClick" i]:visible' },
      ],
      timeout: 5000,
    });
    await confirmButton.click();

    // Posting is itself a server round-trip (document numbering, GST, etc.)
    // — confirmed live (Jin, 2026-07-24) that 2.5s isn't enough: a screenshot
    // taken then still showed a loading overlay and Document No. "[DEFAULT]".
    // Katalon's own CSP.tc used a 5s delay at this exact step — match that.
    await p.waitForTimeout(5000);
  }

  /**
   * Full Post flow: select customer + item, click Post, complete
   * MultiPayment. Ground-truth IDs from Katalon's CSP.tc — see
   * clickPost()/completeMultiPayment() for the specifics.
   */
  async postCashSales({ customerCode, itemDescription, paymentMode = 'CASH' }) {
    await this.createCashSales({ customerCode, itemDescription });
    await this.clickPost();
    await this.completeMultiPayment(paymentMode);
  }

  /**
   * Checks whether the document actually posted. Root-caused via a live
   * diagnostic dump (Jin, 2026-07-24), not the field I originally guessed:
   * there's no plain `input[id*="Status"]` holding "POSTED" text. The real,
   * confirmed signal is the hidden `DocNoFormatControl...ValueInput` field —
   * its value goes from something with no "CS-" prefix (still "[DEFAULT]"
   * on screen) to e.g. "5^CS-00001003" once the document is actually
   * assigned a real number server-side. That field update is what a
   * successful Post (or Save Draft) actually produces here.
   */
  async expectPostSuccess() {
    const f = this.formFrame;
    const docNoField = f.locator('input[id*="DocNoFormat" i][id*="ValueInput" i]');
    if ((await docNoField.count().catch(() => 0)) > 0) {
      const value = (await docNoField.first().inputValue().catch(() => '')) || '';
      if (/CS-\d+/.test(value)) return true;
    }
    return false;
  }

  /**
   * Clicks "Print from Adobe Reader" inside the auto-opened GST report tab
   * and confirms a real print-preview page actually opens — the strongest,
   * most concrete proof a Post succeeded (this is Katalon CSP.tc's own
   * final verification step, not something added independently). Ground
   * truth, not guessed: Katalon's `input_Description_nav print_button`
   * object — misleadingly named by Katalon's auto-naming, but its real
   * selector is `input.nav.print_button` / title "Print from Adobe Reader",
   * living inside the "Cash Sales Detail GST Report" iframe, and its
   * onclick does `window.open('/FastReport.Export.axd?...')` — i.e. it
   * opens a genuinely separate browser tab, confirmed visually by Jin
   * (screenshot showed a real PDF.js viewer on a FastReport.Export.axd
   * URL). Returns the new Page so the caller can assert on it directly.
   */
  async printReport() {
    const p = this.page;
    const printSelector = 'input.nav.print_button, input[title="Print from Adobe Reader" i]';

    // BUG FIXED (2026-07-27): findFrame()'s default 10s timeout was only
    // ever tight enough when this test ran standalone, against a fresh/
    // fast server. Confirmed live: running it as part of the full ~100-
    // test suite (over an hour of sustained load), the SAME report
    // occasionally took longer than 10s to finish rendering — the first
    // attempt failed with this exact error, and only the retry (once
    // retries:1 was enabled suite-wide) passed. Widened to give slow
    // rendering under load room to finish, matching the longer timeouts
    // already used for report generation elsewhere in this app.
    const reportFrame = await findFrame(p, async (frame) => {
      const btn = frame.locator(printSelector);
      return (await btn.count()) > 0 && (await btn.first().isVisible().catch(() => false));
    }, { timeout: 30000 });
    if (!reportFrame) {
      await p.screenshot({ path: 'test-results/debug-gst-report-not-found.png', fullPage: true }).catch(() => {});
      throw new Error(
        'Could not find the GST report\'s print button — the report may not have finished ' +
        'rendering yet. Saved test-results/debug-gst-report-not-found.png for inspection.'
      );
    }

    // BUG FIXED (2026-07-27): the original version only listened for a new
    // `page` event and then checked its URL for `FastReport.Export.axd`.
    // Confirmed live via a diagnostic dump of every open page's url/title:
    // the "new page" Playwright captures here has url `""`/title `""` —
    // because clicking this button doesn't navigate a page to a viewable
    // URL at all, it triggers a genuine file **download** (the export
    // serves a PDF with a download disposition). A `page` event still
    // fires (Chromium opens a transient page object for the popup target
    // before immediately turning it into a download), but its URL never
    // resolves to anything meaningful — so the old check failed 100% of
    // the time despite the report having rendered correctly (confirmed by
    // screenshots showing a real, correct invoice). Listen for BOTH event
    // types and accept whichever one actually fires; a real `download`
    // event is at least as strong a proof of success as a navigated page.
    const eventPromise = Promise.race([
      p.context().waitForEvent('page', { timeout: 15000 }).then((value) => ({ kind: 'page', value })),
      p.context().waitForEvent('download', { timeout: 15000 }).then((value) => ({ kind: 'download', value })),
    ]);
    const [{ kind, value }] = await Promise.all([
      eventPromise,
      reportFrame.locator(printSelector).first().click(),
    ]);

    if (kind === 'download') {
      return value; // Playwright Download object
    }

    const reportPage = value;
    await reportPage.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline && !/FastReport\.Export\.axd/i.test(reportPage.url())) {
      await reportPage.waitForTimeout(300).catch(() => {});
    }
    return reportPage;
  }

  /**
   * True if printReport() got either a genuine file download (the common
   * case — see printReport()'s comment) or a page that actually navigated
   * to the FastReport PDF endpoint. False for anything else (e.g. an
   * empty/blank page object, or an error page).
   */
  isReportPageValid(reportPageOrDownload) {
    if (typeof reportPageOrDownload.suggestedFilename === 'function') {
      return true; // a Download object firing at all IS the proof
    }
    return /FastReport\.Export\.axd/i.test(reportPageOrDownload.url());
  }

  /**
   * Confirmed (Jin, 2026-07-24 live run): after selectItem() completes, the
   * chosen item's Description reappears as a plain grid cell in the Items
   * section (screenshot-verified) — there's no save/toast step in scope yet
   * to check instead, so this is the reliable "did the line actually get
   * added" signal for this pass.
   */
  async hasItemRow(itemDescription) {
    const f = this.formFrame;
    return f.getByRole('cell', { name: itemDescription, exact: true }).first().isVisible().catch(() => false);
  }

  /** Visible-only filtering — DevExpress keeps a hidden validation-summary template in the DOM. */
  async getValidationErrors() {
    const scope = this.formFrame || this.page;
    const candidates = scope.locator('[class*="error" i], [class*="validation" i]');
    const count = await candidates.count();
    const visibleTexts = [];
    for (let i = 0; i < count; i++) {
      const el = candidates.nth(i);
      if (await el.isVisible().catch(() => false)) {
        const text = (await el.innerText()).trim();
        if (text) visibleTexts.push(text);
      }
    }
    return visibleTexts;
  }
}

module.exports = { CashSalesPage };
