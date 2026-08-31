const { test, expect } = require('@playwright/test');
const { login } = require('../../framework/loginHelper');
const { ModuleEditorPage } = require('../../framework/pages/moduleEditorPage');

/**
 * PBI 21103: [Module editor] Allow 3rd party to use their URL to load on our website (Plug In)
 *
 * End-to-end coverage for the To-Do List Plugin (Module Editor child entry "jm6todo"
 * under parent "jinmenu6", External URL =
 * https://irs-jin.github.io/alaya-ar-plugin-demo/todo-list-plugin.html).
 *
 * CONFIRMED SIT FLOW (live verification 2026-08-31):
 *   Module Editor -> filter "jm6todo" -> click btnTableDetails on the child row
 *   -> opens the plugin editor iframe (m_UserDefinedFieldBlankEditor.aspx) which
 *   already holds the persisted External URL -> click "Test Load" -> the host
 *   injects the plugin into a new IFRAME (NOT a new browser tab) whose URL starts
 *   with the External URL (?EncData=...&sid=...&v=l appended). The host posts
 *   ALAYA_INIT into that iframe, so the plugin handshake completes end-to-end
 *   (badge flips to "ALAYA_INIT received" and the plugin replies ALAYA_READY).
 *
 * The plugin seeds 6 demo tasks on load (Total=6, Pending=4, Overdue=1, Done=1)
 * and renders them regardless of ALAYA_INIT, so UI assertions are deterministic.
 */
const CHILD_CODE = 'jm6todo';
const PLUGIN_URL_FRAGMENT = 'irs-jin.github.io/alaya-ar-plugin-demo/todo-list-plugin.html';

test.describe.configure({ retries: 1 });
test.setTimeout(180000);

let moduleEditor;

test.beforeEach(async ({ page }) => {
  // Auto-dismiss any JS alert()/confirm() from the plugin (empty-title validation
  // path, delete confirm) so tests never stall on a native dialog.
  page.on('dialog', async (d) => { try { await d.accept(); } catch {} });

  await login(page, {
    baseURL: process.env.ALAYA_BASE_URL,
    clientId: process.env.ALAYA_CLIENT_ID,
    username: process.env.ALAYA_USERNAME,
    password: process.env.ALAYA_PASSWORD,
  });
  moduleEditor = new ModuleEditorPage(page);
  await moduleEditor.goto();
  await moduleEditor.searchMenu(CHILD_CODE);
  // Opens the plugin editor iframe. The External URL is already persisted on
  // jm6todo from a prior run, so no fill/T&C/Save is needed here.
  await moduleEditor.clickPluginDetailsIcon();
});

/**
 * Clicks "Test Load" in the plugin editor iframe and resolves the plugin iframe
 * the host injects into the main page. Asserts the iframe actually navigated to
 * the To-Do plugin URL (catches a stale/wrong/missing External URL on jm6todo).
 */
async function openPluginViaTestLoad() {
  await moduleEditor.clickTestLoad();
  const plugin = await moduleEditor.getPluginFrame(PLUGIN_URL_FRAGMENT);

  // Plugin iframe URL must start with the configured External URL.
  expect(plugin.url()).toContain(PLUGIN_URL_FRAGMENT);

  // The list rendering proves the plugin HTML rendered and JS executed (a
  // text/plain URL would show raw source with no #task-tbody rows).
  await plugin.locator('#task-tbody tr').first().waitFor({ state: 'visible', timeout: 20000 });

  // Wait for the DB-load chain (ALAYA_INIT -> token -> tasks + users) to
  // finish BEFORE returning. loadTasksFromDb() REPLACES the tasks array, so
  // any test action that mutates a demo task before DB load completes will
  // be lost when the array is replaced mid-action (causing flaky KPI fails).
  await expect(plugin.locator('#log', { hasText: 'Loaded 6 tasks from DB table jm6data' }))
    .toBeVisible({ timeout: 40000 });
  await expect(plugin.locator('#log', { hasText: 'Loaded 53 users from DB table jm6usr' }))
    .toBeVisible({ timeout: 40000 });
  return plugin;
}

// ==================== TC-049: Test Load opens the plugin in an iframe ====================
test('TC-049: Test Load opens the To-Do List Plugin in an iframe @PBI21103 @happy-path', async ({ page }) => {
  const plugin = await openPluginViaTestLoad();

  // Tab title is set by the HTML <title> — only present when served as text/html
  // (a misconfigured text/plain URL would have no title / raw source).
  const title = await plugin.evaluate(() => document.title);
  expect(title).toMatch(/To-Do List Plugin/i);

  // KPI row present — proves the plugin shell rendered.
  await expect(plugin.locator('#kpi-total')).toBeVisible();

  await page.screenshot({ path: 'test-results/todo-plugin-iframe-opened.png', fullPage: true }).catch(() => {});
});

// ==================== TC-050: Plugin UI renders with seeded demo tasks ====================
test('TC-050: Plugin renders KPIs and task table with seeded demo data @PBI21103 @ui', async ({ page }) => {
  const plugin = await openPluginViaTestLoad();

  // KPIs reflect the 6 seeded demo tasks (deterministic regardless of ALAYA_INIT).
  await expect(plugin.locator('#kpi-total')).toHaveText('6', { timeout: 15000 });
  await expect(plugin.locator('#kpi-pending')).toHaveText('4');
  await expect(plugin.locator('#kpi-overdue')).toHaveText('1');
  await expect(plugin.locator('#kpi-done')).toHaveText('1');

  // List view is the default and shows all 6 tasks as rows.
  await expect(plugin.locator('.view-tab[data-view="list"]')).toHaveClass(/active/);
  await expect(plugin.locator('#task-tbody tr')).toHaveCount(6);

  // Three view tabs are present.
  await expect(plugin.locator('.view-tab')).toHaveCount(3);

  await page.screenshot({ path: 'test-results/todo-plugin-seeded-ui.png', fullPage: true }).catch(() => {});
});

// ==================== TC-051: ALAYA_INIT handshake completes in the Test Load iframe ====================
test('TC-051: Plugin shows ALAYA_INIT handshake completed and replies ALAYA_READY @PBI21103 @ui', async ({ page }) => {
  const plugin = await openPluginViaTestLoad();

  // In the Test Load iframe the host posts ALAYA_INIT to the plugin, so the
  // badge flips to "ALAYA_INIT received" and the plugin replies ALAYA_READY.
  const badge = plugin.locator('#badge');
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText(/ALAYA_INIT received/, { timeout: 15000 });

  // The handshake log must show both directions of the exchange.
  const logText = await plugin.locator('#log').innerText();
  expect(logText).toContain('Received <- ALAYA_INIT');
  expect(logText).toContain('Sent -> ALAYA_READY');

  await page.screenshot({ path: 'test-results/todo-plugin-alaya-init.png', fullPage: true }).catch(() => {});
});

// ==================== TC-052: Create a new task via modal ====================
test('TC-052: Create a new task increases KPI totals @PBI21103 @happy-path', async ({ page }) => {
  const plugin = await openPluginViaTestLoad();

  const newTaskTitle = `QA Auto Task ${Date.now()}`;
  await plugin.locator('#btn-new-task').click();
  await expect(plugin.locator('#task-modal')).toHaveClass(/show/);

  await plugin.locator('#inp-title').fill(newTaskTitle);
  await plugin.locator('#inp-group').selectOption('General');
  await plugin.locator('#inp-priority').selectOption('high');
  await plugin.locator('#inp-status').selectOption('pending');
  await plugin.locator('#btn-modal-save').click();

  // Modal closes after save.
  await expect(plugin.locator('#task-modal')).not.toHaveClass(/show/);

  // Total increased 6 -> 7; pending increased 4 -> 5 (new task is pending).
  await expect(plugin.locator('#kpi-total')).toHaveText('7', { timeout: 15000 });
  await expect(plugin.locator('#kpi-pending')).toHaveText('5');

  // The new task is present in the list (the list is sorted by priority then
  // dueDate with a stable sort, so we assert presence rather than position).
  await expect(plugin.locator('#task-tbody strong', { hasText: newTaskTitle })).toHaveCount(1);

  await page.screenshot({ path: 'test-results/todo-plugin-task-created.png', fullPage: true }).catch(() => {});
});

// ==================== TC-053: Mark a pending task complete via checkbox ====================
test('TC-053: Toggling task checkbox marks it completed @PBI21103 @happy-path', async ({ page }) => {
  const plugin = await openPluginViaTestLoad();

  // Pick the first pending (unchecked) task checkbox in the list.
  const firstCheckbox = plugin.locator('#task-tbody tr .task-checkbox').first();
  await expect(firstCheckbox).not.toBeChecked();

  await firstCheckbox.check();

  // Completed KPI goes 1 -> 2 (the change handler sets status='completed' and
  // calls renderAll(), which re-renders KPIs and the row with row-completed).
  await expect(plugin.locator('#kpi-done')).toHaveText('2', { timeout: 15000 });

  // The toggled row now carries the completed styling class.
  await expect(plugin.locator('#task-tbody tr').first()).toHaveClass(/row-completed/);

  await page.screenshot({ path: 'test-results/todo-plugin-task-completed.png', fullPage: true }).catch(() => {});
});

// ==================== TC-054: Switch between List / Calendar / Report views ====================
test('TC-054: View tabs switch between List, Calendar and Report views @PBI21103 @ui', async ({ page }) => {
  const plugin = await openPluginViaTestLoad();

  // List is active by default; Calendar and Report panes are hidden.
  await expect(plugin.locator('#view-list')).toBeVisible();
  await expect(plugin.locator('#view-calendar')).toBeHidden();
  await expect(plugin.locator('#view-report')).toBeHidden();

  // Switch to Calendar.
  await plugin.locator('.view-tab[data-view="calendar"]').click();
  await expect(plugin.locator('.view-tab[data-view="calendar"]')).toHaveClass(/active/);
  await expect(plugin.locator('#view-calendar')).toBeVisible();
  // Calendar grid is always a whole number of weeks (28/35/42 cells).
  const calCount = await plugin.locator('#cal-grid .calendar-day').count();
  expect([28, 35, 42]).toContain(calCount);

  // Switch to Report.
  await plugin.locator('.view-tab[data-view="report"]').click();
  await expect(plugin.locator('.view-tab[data-view="report"]')).toHaveClass(/active/);
  await expect(plugin.locator('#view-report')).toBeVisible();
  // Report renders one stat row per priority present in seeded data (high/medium/low).
  await expect(plugin.locator('#report-priority .report-stat')).toHaveCount(3);

  await page.screenshot({ path: 'test-results/todo-plugin-report-view.png', fullPage: true }).catch(() => {});
});

// ==================== TC-055: Plugin loads tasks from DB via ZZTGetDataTable ====================
// After ALAYA_INIT the plugin requests a token and auto-calls
// api/Udf/ZZTGetDataTable { tableName: 'jm6data' }. The 6 rows seeded into
// ZZT_jm6data via Module Query on jinmenu6 (T001..T006) replace the demo
// tasks. DB-specific task titles (e.g. "Review AR aging report") distinguish
// a real DB read from the static demo seed.
test('TC-055: Plugin reads 6 tasks from ZZT_jm6data via ZZTGetDataTable @PBI21103 @db', async ({ page }) => {
  const plugin = await openPluginViaTestLoad();

  // The DB load chain is: ALAYA_INIT -> requestToken -> loadTasksFromDb.
  // Wait for the success log line proving the API call returned 6 rows.
  await expect(plugin.locator('#log', { hasText: 'Loaded 6 tasks from DB table jm6data' }))
    .toBeVisible({ timeout: 40000 });

  // KPIs reflect the 6 DB rows: Pending=4 (T001,T002,T005,T006), Overdue=1
  // (T004, dueDate 2026-08-25 < today, not completed), Done=1 (T003).
  await expect(plugin.locator('#kpi-total')).toHaveText('6');
  await expect(plugin.locator('#kpi-pending')).toHaveText('4');
  await expect(plugin.locator('#kpi-overdue')).toHaveText('1');
  await expect(plugin.locator('#kpi-done')).toHaveText('1');

  // A DB-specific title (not present in the demo seed) proves the rows came
  // from ZZT_jm6data, not from seedDemoTasks().
  await expect(plugin.locator('#task-tbody strong', { hasText: 'Review AR aging report' })).toHaveCount(1);
  await expect(plugin.locator('#task-tbody strong', { hasText: 'Prepare GST return' })).toHaveCount(1);

  // The full log must show the read API was actually invoked.
  const logText = await plugin.locator('#log').innerText();
  expect(logText).toContain('ZZTGetDataTable');
  expect(logText).toContain('Loaded 6 tasks from DB table jm6data');

  await page.screenshot({ path: 'test-results/todo-plugin-db-loaded.png', fullPage: true }).catch(() => {});
});

// ==================== TC-056: Plugin loads users from ZZT_jm6usr (Manage Users) ====================
test('TC-056: Plugin loads 53 users from ZZT_jm6usr into Manage Users modal @PBI21103 @db @users', async ({ page }) => {
  const plugin = await openPluginViaTestLoad();

  // DB load chain: ALAYA_INIT -> requestToken -> loadUsersFromDb.
  await expect(plugin.locator('#log', { hasText: 'Loaded 53 users from DB table jm6usr' }))
    .toBeVisible({ timeout: 40000 });

  // Open the Manage Users modal.
  await plugin.locator('#btn-manage-users').click();
  await expect(plugin.locator('#user-modal')).toHaveClass(/show/);

  // Header row shows the loaded total; the seeded ZZT_jm6usr has 53 rows.
  await expect(plugin.locator('#user-list .report-stat', { hasText: '53 users' })).toBeVisible({ timeout: 10000 });

  // At least one seeded SIT user row is present (U001 = Admin/Admin1, U053 = STAFF).
  // Use the stable ZZC_Code as the disambiguator — hasText is case-insensitive,
  // so 'Admin1' would match both U001's "Admin1" and U002's lowercase "admin1".
  await expect(plugin.locator('#user-list .report-stat', { hasText: 'U001' })).toHaveCount(1);
  await expect(plugin.locator('#user-list .report-stat', { hasText: 'U053' })).toHaveCount(1);
  await expect(plugin.locator('#user-list .report-stat', { hasText: 'U001' })).toContainText('Admin1');
  await expect(plugin.locator('#user-list .report-stat', { hasText: 'U053' })).toContainText('STAFF');

  // The Assignee dropdown is now a <select> populated from the same users array.
  // Verify a few codes appear as <option> values.
  const options = await plugin.locator('#inp-assignee option').evaluateAll(els => els.map(o => o.value));
  expect(options).toContain('U001');
  expect(options).toContain('U053');
  expect(options.filter(v => v).length).toBeGreaterThanOrEqual(53);

  // Search filter narrows the visible rows. Use a unique term so the filtered
  // count is exactly 1 ("taxcom2" only appears in U039's code/name/email).
  await plugin.locator('#inp-user-search').fill('taxcom2');
  await expect(plugin.locator('#user-list')).toContainText('taxcom2');
  await expect(plugin.locator('#user-list .report-stat', { hasText: '1 users' })).toBeVisible();

  // Close the modal and verify it hides.
  await plugin.locator('#btn-user-close').click();
  await expect(plugin.locator('#user-modal')).not.toHaveClass(/show/);

  await page.screenshot({ path: 'test-results/todo-plugin-manage-users.png', fullPage: true }).catch(() => {});
});

// ==================== TC-057: Export SQL serialises tasks as DELETE + INSERTs ====================
test('TC-057: Export SQL button generates DELETE+INSERT statements for Module Query Execute @PBI21103 @db @persistence', async ({ page }) => {
  const plugin = await openPluginViaTestLoad();

  // Open the Export SQL modal.
  await plugin.locator('#btn-export-sql').click();
  await expect(plugin.locator('#export-sql-modal')).toHaveClass(/show/);

  // Header reflects current task count + target table.
  await expect(plugin.locator('#export-sql-count')).toHaveText('6');
  await expect(plugin.locator('#export-sql-table')).toHaveText('jm6data');

  // The textarea contains a DELETE followed by 6 INSERT statements.
  const sql = await plugin.locator('#export-sql-textarea').inputValue();
  expect(sql).toMatch(/^DELETE FROM ZZT_jm6data;/);
  const insertCount = (sql.match(/^INSERT INTO ZZT_jm6data \(ZZC_Code, ZZC_Description\) VALUES \(/gm) || []).length;
  expect(insertCount).toBe(6);

  // Each INSERT's ZZC_Code follows the T001..T006 pattern.
  for (let i = 1; i <= 6; i++) {
    const code = 'T' + String(i).padStart(3, '0');
    expect(sql).toContain("'" + code + "',");
  }

  // A DB-specific task title must appear inside one of the INSERT JSON payloads.
  expect(sql).toContain('Review AR aging report');
  expect(sql).toContain('Prepare GST return');

  // JSON payload is valid and the title round-trips. Pull the first INSERT's
  // JSON (after the comma following the code) and verify it parses.
  const firstInsert = sql.split('\n').find(l => l.startsWith('INSERT INTO'));
  expect(firstInsert).toBeTruthy();
  const jsonMatch = firstInsert.match(/'\{.+\}'\);$/);
  expect(jsonMatch).toBeTruthy();
  // Strip the surrounding SQL quotes (undo the doubled-quote escaping once
  // to confirm a single-quoted title survives the round-trip).
  const jsonStr = jsonMatch[0].slice(1, -3).replace(/''/g, "'");
  const parsed = JSON.parse(jsonStr);
  expect(parsed).toHaveProperty('title');
  expect(parsed).toHaveProperty('status');
  expect(parsed).toHaveProperty('dueDate');

  // Copy-to-clipboard button is wired (clipboard API may be blocked in
  // headless, so assert the click doesn't throw and the log records the attempt).
  await plugin.locator('#btn-export-sql-copy').click();
  const logText = await plugin.locator('#log').innerText();
  expect(logText).toMatch(/SQL copied to clipboard|Clipboard API failed/);

  // Close the modal.
  await plugin.locator('#btn-export-sql-close').click();
  await expect(plugin.locator('#export-sql-modal')).not.toHaveClass(/show/);

  await page.screenshot({ path: 'test-results/todo-plugin-export-sql.png', fullPage: true }).catch(() => {});
});
