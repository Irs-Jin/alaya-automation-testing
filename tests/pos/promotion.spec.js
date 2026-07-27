const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { PromotionPage } = require('../../framework/pages/promotionPage');

/**
 * Converted directly from Jin's own Playwright codegen recording
 * (2026-07-27): creates a Promotion (code "01", description
 * "testing001", type "Buy any item in Buy Item list to get a discount.",
 * priority 1, customer type "Customer"), saves it twice (the "Add
 * Promotion" popup's own Save, then the resulting detail page's own
 * Save, which triggers a confirm dialog), goes Back to the list, then
 * deletes the row it just created. Leaves no residual test data behind.
 */
test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('POS > Promotion Management > Promotion', () => {

  test('[Happy Path] creates then deletes a Promotion', async ({ page }) => {
    test.setTimeout(90000);
    const promotionPage = new PromotionPage(page);
    await promotionPage.goto();

    await promotionPage.createPromotion({
      code: '01',
      description: 'testing001',
      promotionType: 'Buy any item in Buy Item list to get a discount.',
      priority: 1,
      customerType: 'Customer',
    });

    await promotionPage.deletePromotion('testing001');

    const stillThere = await promotionPage.frame
      .getByRole('row', { name: /testing001/i })
      .count()
      .catch(() => 0);
    expect(stillThere).toBe(0);
  });
});
