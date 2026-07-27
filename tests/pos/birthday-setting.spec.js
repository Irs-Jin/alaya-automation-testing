const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { BirthdaySettingPage } = require('../../framework/pages/birthdaySettingPage');

/**
 * Converted directly from Jin's own Playwright codegen recording
 * (2026-07-27): bump Before Bday / Item Point Multiply / After Bday up by
 * one click each, Save, then back down by one click each, Save. Asserts
 * the round trip — verifies each field actually incremented after the
 * first Save, then returned to its original value after the second —
 * proving a real persisted change, not just client-side state.
 */
test.beforeEach(async ({ page }) => {
  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
});

test.describe('POS > Promotion Management > Birthday Setting', () => {

  test('[Happy Path] bumps Before/After Bday and Point Multiply up then back down', async ({ page }) => {
    test.setTimeout(90000);
    const birthdaySettingPage = new BirthdaySettingPage(page);
    await birthdaySettingPage.goto();

    const before = {
      BeforeBday: await birthdaySettingPage.getFieldValue('BeforeBday'),
      PointBenefit: await birthdaySettingPage.getFieldValue('PointBenefit'),
      AfterBday: await birthdaySettingPage.getFieldValue('AfterBday'),
    };

    await birthdaySettingPage.bumpAllFieldsUpThenSave();

    const afterUp = {
      BeforeBday: await birthdaySettingPage.getFieldValue('BeforeBday'),
      PointBenefit: await birthdaySettingPage.getFieldValue('PointBenefit'),
      AfterBday: await birthdaySettingPage.getFieldValue('AfterBday'),
    };
    expect(afterUp.BeforeBday).toBe(before.BeforeBday + 1);
    expect(afterUp.PointBenefit).toBe(before.PointBenefit + 1);
    expect(afterUp.AfterBday).toBe(before.AfterBday + 1);

    await birthdaySettingPage.bumpAllFieldsDownThenSave();

    const afterDown = {
      BeforeBday: await birthdaySettingPage.getFieldValue('BeforeBday'),
      PointBenefit: await birthdaySettingPage.getFieldValue('PointBenefit'),
      AfterBday: await birthdaySettingPage.getFieldValue('AfterBday'),
    };
    expect(afterDown.BeforeBday).toBe(before.BeforeBday);
    expect(afterDown.PointBenefit).toBe(before.PointBenefit);
    expect(afterDown.AfterBday).toBe(before.AfterBday);
  });
});
