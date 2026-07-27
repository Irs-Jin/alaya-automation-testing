const fs = require('fs');
const path = require('path');
const { bestFuzzyMatch } = require('./fuzzyMatch');

const KB_PATH = process.env.KNOWLEDGE_BASE_PATH
  ? path.resolve(process.cwd(), process.env.KNOWLEDGE_BASE_PATH)
  : path.resolve(__dirname, 'knowledge-base.json');

function loadKB() {
  try {
    return JSON.parse(fs.readFileSync(KB_PATH, 'utf-8'));
  } catch {
    return { _meta: { description: 'Locator knowledge base', lastUpdated: null }, elements: {} };
  }
}

function saveKB(kb) {
  kb._meta.lastUpdated = new Date().toISOString();
  fs.writeFileSync(KB_PATH, JSON.stringify(kb, null, 2), 'utf-8');
}

function strategyToLocator(page, strategy) {
  switch (strategy.type) {
    case 'testid':
      return page.getByTestId(strategy.value);
    case 'label':
      return page.getByLabel(strategy.value);
    case 'placeholder':
      return page.getByPlaceholder(strategy.value);
    case 'role':
      return page.getByRole(strategy.role, strategy.options || {});
    case 'text':
      return page.getByText(strategy.value, strategy.options || {});
    case 'css':
      return page.locator(strategy.value);
    default:
      throw new Error(`Unknown strategy type: ${strategy.type}`);
  }
}

function strategyKey(strategy) {
  return `${strategy.type}::${strategy.value || strategy.role}`;
}

/**
 * Merge KB-known strategies (ordered by confidence) with the strategies
 * defined in the test/page-object. KB strategies that no longer appear
 * in the definition are kept (in case the definition regresses) but new
 * ones from the definition are appended if not already known.
 */
function orderedStrategies(kb, elementId, definedStrategies) {
  const known = kb.elements[elementId]?.strategies || [];
  const knownKeys = new Set(known.map((s) => strategyKey(s)));
  const merged = [...known];
  for (const def of definedStrategies) {
    if (!knownKeys.has(strategyKey(def))) {
      merged.push({ ...def, successCount: 0, failureCount: 0 });
    }
  }
  // Sort by confidence descending; ties keep original (defined) order.
  return merged.sort((a, b) => (b.successCount - b.failureCount) - (a.successCount - a.failureCount));
}

function recordResult(kb, elementId, strategy, success, discovered = false) {
  if (!kb.elements[elementId]) {
    kb.elements[elementId] = { label: strategy.label || elementId, strategies: [] };
  }
  const bucket = kb.elements[elementId];
  let entry = bucket.strategies.find((s) => strategyKey(s) === strategyKey(strategy));
  if (!entry) {
    entry = { ...strategy, successCount: 0, failureCount: 0, discovered };
    bucket.strategies.push(entry);
  }
  if (success) entry.successCount += 1;
  else entry.failureCount += 1;
  entry.lastUsed = new Date().toISOString();
}

/**
 * Attempts to find an element defined by `spec`:
 * {
 *   id: 'createItem.itemCodeInput',   // stable logical name, used as KB key
 *   label: 'Item Code',               // semantic label, used for fuzzy fallback
 *   strategies: [ {type, value/role, options} ... ],  // ordered preference if KB has no history
 *   timeout: 5000,                    // per-strategy timeout in ms
 * }
 * Returns { locator, strategyUsed, healed } — throws if nothing works, including fuzzy fallback.
 */
async function heal(page, spec) {
  const kb = loadKB();
  const candidates = orderedStrategies(kb, spec.id, spec.strategies);
  const timeout = spec.timeout || 3000;

  for (const strategy of candidates) {
    try {
      const locator = strategyToLocator(page, strategy);
      await locator.first().waitFor({ state: 'attached', timeout });
      recordResult(kb, spec.id, strategy, true, strategy.discovered);
      saveKB(kb);
      return { locator: locator.first(), strategyUsed: strategy, healed: strategy.discovered === true };
    } catch {
      recordResult(kb, spec.id, strategy, false, strategy.discovered);
      // continue to next candidate
    }
  }

  // All known strategies failed — attempt fuzzy discovery by semantic label.
  if (spec.label) {
    const healedLocator = await fuzzyDiscover(page, spec, kb);
    if (healedLocator) return healedLocator;
  }

  saveKB(kb);
  throw new Error(
    `Self-healing locator failed for "${spec.id}" (label: "${spec.label || 'n/a'}"). ` +
    `Tried ${candidates.length} known strategies and fuzzy discovery. ` +
    `The page structure may have changed significantly — update framework/pageDefinitions or knowledge-base.json manually.`
  );
}

/**
 * Last-resort strategy: scan interactive elements on the page (inputs,
 * buttons, links with visible text/label/placeholder) and fuzzy-match
 * against spec.label. If a good match is found, record it as a new
 * discovered strategy in the KB so future runs try it directly.
 */
async function fuzzyDiscover(page, spec, kb) {
  const candidateElements = await page.evaluate(() => {
    const selectorPool = 'input, textarea, select, button, [role="button"], a, [contenteditable="true"], img, [onclick]';
    return Array.from(document.querySelectorAll(selectorPool))
      .filter((el) => el.offsetParent !== null) // visible only
      .map((el, idx) => {
        el.setAttribute('data-heal-idx', String(idx));
        const label =
          el.getAttribute('aria-label') ||
          el.getAttribute('title') ||
          el.getAttribute('alt') ||
          el.getAttribute('placeholder') ||
          el.getAttribute('name') ||
          el.innerText ||
          el.value ||
          '';
        return { idx, text: label.trim() };
      })
      .filter((c) => c.text.length > 0);
  });

  const match = bestFuzzyMatch(spec.label, candidateElements, spec.fuzzyThreshold || 0.6);
  if (!match) return null;

  const discoveredStrategy = {
    type: 'css',
    value: `[data-heal-idx="${match.idx}"]`,
    label: spec.label,
    discovered: true,
    discoveredScore: match.score,
  };

  const locator = page.locator(discoveredStrategy.value);
  recordResult(kb, spec.id, discoveredStrategy, true, true);
  saveKB(kb);

  return { locator, strategyUsed: discoveredStrategy, healed: true };
}

module.exports = { heal, loadKB, saveKB, KB_PATH };
