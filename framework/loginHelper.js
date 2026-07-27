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
    kbFile: 'login',
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
  await clientIdField.fill(clientId);

  const { locator: usernameField } = await heal(page, {
    id: 'login.username',
    kbFile: 'login',
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
  await usernameField.fill(username);

  const { locator: passwordField } = await heal(page, {
    id: 'login.password',
    kbFile: 'login',
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
    kbFile: 'login',
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

  // TODO(Jin): Replace with an actual post-login landing element (e.g. dashboard header).
  await page.waitForLoadState('networkidle');
}

module.exports = { login };
