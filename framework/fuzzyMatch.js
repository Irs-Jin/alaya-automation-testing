/**
 * Lightweight fuzzy string matching — no external dependency needed.
 * Used when all known selector strategies fail and we need to guess
 * which visible element is closest to what we're looking for
 * (e.g. label text changed from "Item Code" to "Item No.").
 */

function levenshtein(a, b) {
  a = (a || '').toLowerCase().trim();
  b = (b || '').toLowerCase().trim();
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return dp[m][n];
}

/**
 * Returns a similarity score between 0 (no match) and 1 (identical).
 */
function similarity(a, b) {
  const longer = Math.max((a || '').length, (b || '').length);
  if (longer === 0) return 1;
  return 1 - levenshtein(a, b) / longer;
}

/**
 * Given a target label and a list of {text, handle} candidates,
 * returns the best match if it clears the threshold, else null.
 */
function bestFuzzyMatch(targetLabel, candidates, threshold = 0.6) {
  let best = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    const score = similarity(targetLabel, candidate.text);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  if (bestScore >= threshold) {
    return { ...best, score: bestScore };
  }
  return null;
}

module.exports = { levenshtein, similarity, bestFuzzyMatch };
