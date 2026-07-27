/**
 * DevExpress renders popups and dialogs (the Add-record grid toolbar icon,
 * the Create Item form itself) inside iframes. Their `name` attribute is
 * either a session-specific dynamic number (e.g. "3474") or literally the
 * string "undefined" — neither is safe to hardcode, since it can change
 * between sessions or even between runs. Instead, we scan all frames on the
 * page for one that contains a matching element, polling briefly since
 * these iframes can load asynchronously after a click.
 *
 * @param {import('@playwright/test').Page} page
 * @param {(frame: import('@playwright/test').Frame) => Promise<boolean>} checkFn
 * @returns {Promise<import('@playwright/test').Frame|null>}
 */
async function findFrame(page, checkFn, { timeout = 10000, interval = 300 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      try {
        if (await checkFn(frame)) return frame;
      } catch {
        // Frame may have been detached or mid-navigation — ignore and keep polling.
      }
    }
    await page.waitForTimeout(interval);
  }
  return null;
}

module.exports = { findFrame };
