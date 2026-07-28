const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { SalesReportPage } = require('../../../framework/pages/salesReportPage');

/**
 * templateName confirmed live: "Monthly Sales Analysis Summary by
 * Customer" (pre-highlighted first row, System owner; other options are
 * "...by Sales Branch/Item/Sales Agent") — a first guess matching just
 * the catalog name failed with a timeout.
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Sales > Monthly Sales Analysis', () => {

  test('[Happy Path] views, previews, and prints the Monthly Sales Analysis report', async ({ page }) => {
    test.setTimeout(120000);
    const salesReportPage = new SalesReportPage(page);
    await salesReportPage.goto('Monthly Sales Analysis');

    // OPTIMIZED (2026-07-28): confirmed live (screenshot) this report's
    // parameter form has ONLY a Customer field (From/To Date, Analysed By,
    // Customer, Customer Category/Label/Type, Document Type, Export To) —
    // no Item field at all. The switchItem.../selectFirstItem... calls
    // were unconditional no-ops adding real, visible delay between
    // Customer being selected and View Grid being clicked. Removed.
    await salesReportPage.switchCustomerToFilterBySelectionIfAll();
    await salesReportPage.selectFirstCustomerIfNeeded();
    await salesReportPage.viewGrid();
    await salesReportPage.previewReport('Monthly Sales Analysis Summary by Customer');
    await salesReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await salesReportPage.printReport();
    expect(salesReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/monthly-sales-analysis-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
