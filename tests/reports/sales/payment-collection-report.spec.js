const { test, expect } = require('@playwright/test');
const { login } = require('../../../framework/loginHelper');
const { SalesReportPage } = require('../../../framework/pages/salesReportPage');

/**
 * templateName confirmed live: "Payment Collection Summary by Sales
 * Agent" (pre-highlighted first row, System owner; many other variants
 * exist — by Sales Branch/Date/Counter Code, Summary/Detail) — a first
 * guess matching just the catalog name failed with a timeout. This
 * report also has no Customer field (Document Type/Date only).
 */

test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('Reports > Sales > Payment Collection', () => {

  test('[Happy Path] views, previews, and prints the Payment Collection report', async ({ page }) => {
    test.setTimeout(90000);
    const salesReportPage = new SalesReportPage(page);
    await salesReportPage.goto('Payment Collection');

    // OPTIMIZED (2026-07-28): this report's own header comment already
    // confirmed no Customer field exists (Document Type/Date only) — the
    // switchCustomer.../selectFirstCustomer... calls were unconditional
    // no-ops adding real, visible delay. Removed.
    await salesReportPage.viewGrid();
    await salesReportPage.previewReport('Payment Collection Summary by Sales Agent');
    await salesReportPage.handleAsyncReportOutputIfPresent();

    const reportPage = await salesReportPage.printReport();
    expect(salesReportPage.isReportPageValid(reportPage)).toBe(true);

    await reportPage.screenshot({ path: 'test-results/payment-collection-report-print.png', fullPage: true }).catch(() => {});
    await reportPage.close().catch(() => {});
  });
});
