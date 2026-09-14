const { heal } = require('./selfHealingLocator');

/**
 * TODO(Jin): Adjust selectors/values below to match ALAYA's actual login page.
 * The 'strategies' arrays are ordered guesses based on common ERP login patterns
 * (DevExpress ASPxTextBox / ASPxButton naming conventions are included as fallbacks
 * since ALAYA uses DevExpress webforms). Confirmed from screenshot: login page has
 * three fields — Client ID (building icon), User ID, Password — at
 * sit.irsbizsuite.com.my/Account/Login.aspx.
 */
async function login(page, { baseURL, clientId, username, password } = {}) {
  await page.goto(baseURL || '/');

  const { locator: clientIdField } = await heal(page, {
    id: 'login.clientId',
    label: 'Client ID',
    strategies: [
      { type: 'css', value: '#cbpCallback_txtClientId_I' }, // confirmed via DevTools inspection
      { type: 'testid', value: 'client-id-input' },
      { type: 'label', value: 'Client ID' },
      { type: 'placeholder', value: 'Client ID' },
      { type: 'css', value: 'input[name*="ClientId" i]' },
      { type: 'css', value: 'input[id*="txtClientId" i]' },
    ],
  });
  // BUG FIXED (2026-08-27): under server load, the FIRST keystroke sent
  // immediately after .click() can be dropped (confirmed live via a
  // dedicated diagnostic run showing "uat" consistently landing as "at",
  // producing a real "Connection not found" login failure, not just a
  // cosmetic display glitch) — the field's ASPxClientEdit JS handler isn't
  // always attached yet at the moment Playwright's first keydown fires.
  // Verify the committed value and retry the full type once if it doesn't
  // match, same verify-then-retry principle already used throughout this
  // suite's grid Amount fields.
  await clientIdField.click();
  await clientIdField.pressSequentially(clientId, { delay: 30 });
  if ((await clientIdField.inputValue().catch(() => '')) !== clientId) {
    await clientIdField.click({ clickCount: 3 });
    await clientIdField.pressSequentially(clientId, { delay: 30 });
  }

  const { locator: usernameField } = await heal(page, {
    id: 'login.username',
    label: 'User ID',
    strategies: [
      { type: 'css', value: '#cbpCallback_txtUserName_I' }, // confirmed via DevTools inspection
      { type: 'testid', value: 'username-input' },
      { type: 'label', value: 'User ID' },
      { type: 'placeholder', value: 'User ID' },
      { type: 'css', value: 'input[name*="UserName" i]' },
      { type: 'css', value: 'input[id*="txtUserName" i]' },
    ],
  });
  // BUG FIXED (2026-07-27): `.fill()` sets the value directly via JS,
  // which sometimes never "took" on this field — confirmed live via a
  // screenshot showing Client ID filled but User ID still empty with a
  // "User ID Required" validation error, non-deterministically (passed on
  // retry with no code change). Same root cause already diagnosed on the
  // Customer search box: DevExpress's ASPxClientEdit wrapper tracks its
  // own focus/blur state and can miss a JS-direct value set, especially
  // under the timing pressure of a page that's still settling right after
  // Client ID's own postback. Real keystrokes (already used for Password,
  // just never extended to this field) don't have that gap.
  await usernameField.click();
  await usernameField.pressSequentially(username, { delay: 30 });

  const { locator: passwordField } = await heal(page, {
    id: 'login.password',
    label: 'Password',
    strategies: [
      { type: 'css', value: '#cbpCallback_txtPassword_I_CLND' }, // visible masking clone — the one you actually interact with
      { type: 'css', value: '#cbpCallback_txtPassword_I' }, // underlying real input, likely hidden — fallback only
      { type: 'testid', value: 'password-input' },
      { type: 'label', value: 'Password' },
      { type: 'placeholder', value: 'Password' },
      { type: 'css', value: 'input[type="password"]' },
      { type: 'css', value: 'input[id*="txtPassword" i]' },
    ],
  });
  await passwordField.click();
  await passwordField.pressSequentially(password, { delay: 30 });

  const { locator: loginButton } = await heal(page, {
    id: 'login.submitButton',
    label: 'Login',
    strategies: [
      { type: 'css', value: '#cbpCallback_btnLogin' }, // guess, following confirmed cbpCallback_xxx pattern (no _I suffix — buttons aren't edit areas)
      { type: 'testid', value: 'login-button' },
      { type: 'role', role: 'button', options: { name: /login|sign in/i } },
      { type: 'role', role: 'link', options: { name: /login|sign in/i } }, // DevExpress ASPxButton often renders as <a>, not <button>
      { type: 'text', value: 'Login', options: { exact: true } },
      { type: 'css', value: 'input[type="submit"]' },
      { type: 'css', value: 'input[id*="btnLogin" i]' },
      { type: 'css', value: 'a[id*="btnLogin" i]' },
    ],
  });
  await loginButton.click();

  // Some accounts see a "Select Default Company" popup right after login (others —
  // e.g. the original jin1 test account this suite was built against — apparently
  // never do, presumably because they belong to only one company that's auto-applied).
  // Confirmed live (2026-08-14) via the `yew` account: popup id contains
  // "pcPopupSelectDefaultCompany", pre-selects a company in its dropdown, and just
  // needs its own "OK" accepted.
  //
  // Same `_CD` vs `_I` gotcha already documented in customerPage.js's delete-confirm
  // dialog: a live DOM dump confirmed `#btnPopupSelectDefaultCompanyOk_CD` is the
  // real, properly-sized clickable div; `#btnPopupSelectDefaultCompanyOk_I` (what
  // `getByRole('button', {name:'OK'})` resolves to) is a hidden underlying <input>
  // that Playwright correctly refuses to click as "not visible". Scoped to this
  // popup's own container (not a page-wide button search) per this repo's
  // dialog-scoping safety rule, and waits for it to actually close as proof the
  // click registered exactly once.
  const companyPopup = page.locator('[id*="pcPopupSelectDefaultCompany" i]');
  const popupAppeared = await companyPopup.first()
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (popupAppeared) {
    await companyPopup.locator('[id$="Ok_CD" i]').first().click();
    await companyPopup.first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }

  // TODO(Jin): Replace with an actual post-login landing element (e.g. dashboard header).
  await page.waitForLoadState('networkidle');
}

module.exports = { login };
