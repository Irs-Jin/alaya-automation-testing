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
    const frames = page.frames();
    // Confirmed live (2026-07-27, Inventory Item Consolidate): checking
    // frames one at a time in sequence let a single slow/heavy frame (a
    // report's own PDF viewer iframe) stall the WHOLE poll cycle on every
    // iteration, making a genuinely-ready target look "not found" for
    // 60-100s+ even though it existed within a couple seconds. Checking
    // all frames in parallel means one slow frame no longer blocks the
    // others — the frame order is still respected when picking a match.
    const results = await Promise.all(
      frames.map((frame) => checkFn(frame).catch(() => false))
    );
    const matchIndex = results.findIndex(Boolean);
    if (matchIndex !== -1) return frames[matchIndex];
    await page.waitForTimeout(interval);
  }
  return null;
}

module.exports = { findFrame };
